import { z } from 'zod';
import type { SyncMutationType } from '@/types/sync';
import type { JsonObject, JsonValue } from '@/types/workspace';
import {
  type LocalEntityRecord,
  type OutboxMutation,
  type SyncEntityType,
  type WorkspaceDatabase,
  workspaceDb,
} from './dexie-db';

export const SYNC_BATCH_SIZE = 50;
export const SYNC_DEBOUNCE_MS = 300;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;

export interface VersionedField {
  value: JsonValue;
  updatedAt: string;
}

export type VersionedRecord = Record<string, VersionedField>;
export type SyncTransport = (
  mutations: readonly OutboxMutation[],
) => Promise<SyncTransportResult>;

export interface SyncTransportResult {
  acknowledged: readonly string[];
  awardedXp: readonly { actionType: string; xpDelta: number; referenceId: string }[];
}

export interface SyncEngineOptions {
  db?: WorkspaceDatabase;
  transport: SyncTransport;
  debounceMs?: number;
  onError?: (error: unknown) => void;
  onXpAwarded?: (awards: SyncTransportResult['awardedXp']) => void;
  isOnline?: () => boolean;
}

const syncPushResponseSchema = z.object({
  acknowledged: z.array(z.string()),
  awardedXp: z
    .array(
      z.object({
        actionType: z.string(),
        xpDelta: z.number().int().positive(),
        referenceId: z.string(),
      }),
    )
    .default([]),
});

export const pushSyncBatch: SyncTransport = async (mutations) => {
  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mutations }),
  });
  if (!response.ok) {
    throw new Error(`Sync push failed with HTTP ${response.status}.`);
  }

  const result = syncPushResponseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error('Sync push returned an invalid acknowledgement payload.');
  }
  return result.data;
};

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new RangeError(`Invalid LWW timestamp: ${value}`);
  }
  return parsed;
}

export function reconcileFieldLevelLww(
  local: VersionedRecord,
  remote: VersionedRecord,
): VersionedRecord {
  const fields = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const result: VersionedRecord = {};

  for (const field of fields) {
    const localField = local[field];
    const remoteField = remote[field];
    if (localField === undefined) {
      result[field] = remoteField;
    } else if (remoteField === undefined) {
      result[field] = localField;
    } else {
      result[field] =
        timestampValue(remoteField.updatedAt) >= timestampValue(localField.updatedAt)
          ? remoteField
          : localField;
    }
  }

  return result;
}

export class SyncEngine {
  private readonly db: WorkspaceDatabase;
  private readonly transport: SyncTransport;
  private readonly debounceMs: number;
  private readonly onError: (error: unknown) => void;
  private readonly onXpAwarded: (awards: SyncTransportResult['awardedXp']) => void;
  private readonly isOnline: () => boolean;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private activeFlush: Promise<number> | undefined;
  private started = false;
  private retryAttempt = 0;

  private readonly onlineListener = (): void => {
    void this.flushPending().catch(this.onError);
  };

  constructor(options: SyncEngineOptions) {
    this.db = options.db ?? workspaceDb;
    this.transport = options.transport;
    this.debounceMs = options.debounceMs ?? SYNC_DEBOUNCE_MS;
    this.onError = options.onError ?? ((error: unknown) => console.error('Sync operation failed:', error));
    this.onXpAwarded = options.onXpAwarded ?? (() => undefined);
    this.isOnline =
      options.isOnline ??
      (() => typeof window !== 'undefined' && navigator.onLine);
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineListener);
    }
    this.scheduleFlush();
  }

  stop(): void {
    this.started = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineListener);
    }
  }

  async enqueueMutation(mutation: OutboxMutation): Promise<OutboxMutation> {
    const stored = await this.insertMutation(mutation);
    this.scheduleFlush();
    return stored;
  }

  async persistOptimisticMutation(
    mutation: OutboxMutation,
    entity: LocalEntityRecord,
  ): Promise<OutboxMutation> {
    const table = this.db.entityTable(mutation.entityType);
    const stored = await this.db.transaction('rw', table, this.db.outbox, async () => {
      await table.put(entity);
      const existing = await this.db.outbox
        .where('idempotencyKey')
        .equals(mutation.idempotencyKey)
        .first();
      if (existing !== undefined) {
        return existing;
      }
      const seq = await this.db.outbox.add(mutation);
      return { ...mutation, seq };
    });
    this.scheduleFlush();
    return stored;
  }

  async flushPending(): Promise<number> {
    if (this.activeFlush !== undefined) {
      return this.activeFlush;
    }

    const flush = this.flushBatches();
    this.activeFlush = flush;
    void flush.then(
      () => {
        if (this.activeFlush === flush) {
          this.activeFlush = undefined;
        }
      },
      () => {
        if (this.activeFlush === flush) {
          this.activeFlush = undefined;
        }
        this.scheduleRetry();
      },
    );
    return flush;
  }

  private async insertMutation(mutation: OutboxMutation): Promise<OutboxMutation> {
    return this.db.transaction('rw', this.db.outbox, async () => {
      const existing = await this.db.outbox
        .where('idempotencyKey')
        .equals(mutation.idempotencyKey)
        .first();
      if (existing !== undefined) {
        return existing;
      }
      const seq = await this.db.outbox.add(mutation);
      return { ...mutation, seq };
    });
  }

  private scheduleFlush(): void {
    if (!this.isOnline()) {
      return;
    }
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flushPending().catch(this.onError);
    }, this.debounceMs);
  }

  private scheduleRetry(): void {
    if (!this.isOnline()) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** this.retryAttempt, RETRY_MAX_MS);
    this.retryAttempt = Math.min(this.retryAttempt + 1, 5);
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flushPending().catch(this.onError);
    }, delay);
  }

  private async flushBatches(): Promise<number> {
    if (!this.isOnline()) {
      return 0;
    }

    let acknowledgedCount = 0;
    while (true) {
      const batch = await this.db.outbox.orderBy('seq').limit(SYNC_BATCH_SIZE).toArray();
      if (batch.length === 0) {
        return acknowledgedCount;
      }

      const response = await this.transport(batch);
      const acknowledged = response.acknowledged;
      const batchKeys = new Set(batch.map((mutation) => mutation.idempotencyKey));
      const acknowledgedKeys = new Set(acknowledged);
      if (acknowledgedKeys.size !== acknowledged.length) {
        throw new Error('Sync transport returned duplicate acknowledgement keys.');
      }
      for (const key of acknowledgedKeys) {
        if (!batchKeys.has(key)) {
          throw new Error(`Sync transport acknowledged an unknown mutation: ${key}`);
        }
      }
      if (acknowledgedKeys.size > 0 && response.awardedXp.length > 0) {
        this.onXpAwarded(response.awardedXp);
      }
      if (acknowledgedKeys.size === 0) {
        throw new Error('Sync transport acknowledged no mutations.');
      }

      const acknowledgedSequences = batch
        .filter((mutation) => acknowledgedKeys.has(mutation.idempotencyKey))
        .map((mutation) => mutation.seq)
        .filter((seq): seq is number => seq !== undefined);
      await this.db.outbox.bulkDelete(acknowledgedSequences);
      acknowledgedCount += acknowledgedSequences.length;
      this.retryAttempt = 0;

      if (acknowledgedKeys.size < batch.length) {
        this.scheduleRetry();
        return acknowledgedCount;
      }
    }
  }
}

export function createMutation(input: {
  idempotencyKey: string;
  workspaceId: string;
  entityType: SyncEntityType;
  entityId: string;
  changes: JsonObject;
  type?: SyncMutationType;
  fieldTimestamps?: Record<string, string>;
  createdAt?: string;
}): OutboxMutation {
  const type =
    input.type ??
    (input.entityType === 'page'
      ? 'UPDATE_PAGE'
      : input.entityType === 'block'
        ? 'UPDATE_BLOCK'
        : input.entityType === 'rowProperty'
          ? 'UPSERT_ROW_PROP'
          : (() => {
              throw new RangeError(
                `A sync operation type is required for ${input.entityType} mutations.`,
              );
            })());
  return {
    ...input,
    type,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
