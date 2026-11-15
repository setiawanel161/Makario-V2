import type { JsonObject } from './workspace';

export const SYNC_MUTATION_TYPES = [
  'CREATE_PAGE',
  'UPDATE_PAGE',
  'DELETE_PAGE',
  'CREATE_BLOCK',
  'UPDATE_BLOCK',
  'MOVE_BLOCK',
  'DELETE_BLOCK',
  'UPSERT_ROW_PROP',
] as const;

export type SyncMutationType = (typeof SYNC_MUTATION_TYPES)[number];

export interface SyncMutationBase {
  idempotencyKey: string;
  workspaceId: string;
  entityId: string;
  changes: JsonObject;
  createdAt: string;
  fieldTimestamps?: Record<string, string>;
}

export type SyncMutation = {
  [Type in SyncMutationType]: SyncMutationBase & { type: Type };
}[SyncMutationType];

export interface SyncMutationResult {
  acknowledged: string[];
  serverRevision: string;
  awardedXp: Array<{ actionType: string; xpDelta: number; referenceId: string }>;
}
