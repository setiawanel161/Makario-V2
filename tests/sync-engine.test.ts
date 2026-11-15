import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore } from '../src/lib/sync/workspace-store';
import { WorkspaceDatabase, type OutboxMutation } from '../src/lib/sync/dexie-db';
import {
  createMutation,
  reconcileFieldLevelLww,
  SYNC_BATCH_SIZE,
  SyncEngine,
} from '../src/lib/sync/sync-engine';

let databaseSequence = 0;
let db: WorkspaceDatabase;
let engine: SyncEngine | undefined;

function makeMutation(id: number): OutboxMutation {
  return createMutation({
    idempotencyKey: `mutation-${id}`,
    workspaceId: 'workspace-1',
    entityType: 'page',
    entityId: `page-${id}`,
    changes: { title: `Page ${id}` },
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function acknowledge(batch: readonly OutboxMutation[]) {
  return {
    acknowledged: batch.map((mutation) => mutation.idempotencyKey),
    awardedXp: [],
  };
}

beforeEach(() => {
  databaseSequence += 1;
  db = new WorkspaceDatabase(`sync-engine-test-${databaseSequence}`);
});

afterEach(async () => {
  engine?.stop();
  db.close();
  await db.delete();
});

describe('local-first sync engine', () => {
  it('persists entity updates and deduplicates outbox entries by idempotency key', async () => {
    engine = new SyncEngine({
      db,
      transport: async () => ({ acknowledged: [], awardedXp: [] }),
      isOnline: () => false,
    });
    const mutation = makeMutation(1);
    const entity = {
      id: 'page-1',
      workspaceId: 'workspace-1',
      title: 'Updated page',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const first = await engine.persistOptimisticMutation(mutation, entity);
    const second = await engine.enqueueMutation(mutation);

    expect(first.seq).toBe(second.seq);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.pages.get('page-1')).toMatchObject(entity);
  });

  it('flushes acknowledged mutations in batches of no more than 50', async () => {
    const transport = vi.fn(async (batch: readonly OutboxMutation[]) =>
      acknowledge(batch),
    );
    engine = new SyncEngine({ db, transport, isOnline: () => true });

    for (let index = 0; index < SYNC_BATCH_SIZE + 1; index += 1) {
      await engine.enqueueMutation(makeMutation(index));
    }

    await expect(engine.flushPending()).resolves.toBe(SYNC_BATCH_SIZE + 1);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.map(([batch]) => batch.length)).toEqual([50, 1]);
    expect(await db.outbox.count()).toBe(0);
  });

  it('retains unacknowledged packets for an idempotent retry', async () => {
    engine = new SyncEngine({
      db,
      transport: async (batch) => ({
        acknowledged: [batch[0].idempotencyKey],
        awardedXp: [],
      }),
      isOnline: () => true,
    });
    await engine.enqueueMutation(makeMutation(1));
    await engine.enqueueMutation(makeMutation(2));

    await expect(engine.flushPending()).resolves.toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it('notifies the UI once when the server confirms newly awarded XP', async () => {
    const onXpAwarded = vi.fn();
    engine = new SyncEngine({
      db,
      transport: async (batch) => ({
        acknowledged: batch.map((mutation) => mutation.idempotencyKey),
        awardedXp: [{ actionType: 'COMPLETE_TODO', xpDelta: 10, referenceId: 'block-1' }],
      }),
      onXpAwarded,
      isOnline: () => true,
    });
    await engine.enqueueMutation(makeMutation(1));

    await engine.flushPending();

    expect(onXpAwarded).toHaveBeenCalledTimes(1);
    expect(onXpAwarded).toHaveBeenCalledWith([
      { actionType: 'COMPLETE_TODO', xpDelta: 10, referenceId: 'block-1' },
    ]);
  });

  it('retries failed network batches with a bounded delay', async () => {
    let attempts = 0;
    engine = new SyncEngine({
      db,
      transport: async (batch) => {
        attempts += 1;
        if (attempts === 1) throw new Error('Temporary service failure.');
        return acknowledge(batch);
      },
      debounceMs: 60_000,
      isOnline: () => true,
    });
    await engine.enqueueMutation(makeMutation(1));

    await expect(engine.flushPending()).rejects.toThrow('Temporary service failure.');
    await vi.waitFor(
      async () => expect(await db.outbox.count()).toBe(0),
      { timeout: 2500, interval: 20 },
    );

    expect(attempts).toBe(2);
  });

  it('waits for the debounce interval before flushing queued mutations', async () => {
    const transport = vi.fn(async (batch: readonly OutboxMutation[]) =>
      acknowledge(batch),
    );
    engine = new SyncEngine({
      db,
      transport,
      debounceMs: 40,
      isOnline: () => true,
    });

    await engine.enqueueMutation(makeMutation(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(transport).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('flushes queued changes when the browser returns online', async () => {
    let online = false;
    const transport = vi.fn(async (batch: readonly OutboxMutation[]) =>
      acknowledge(batch),
    );
    engine = new SyncEngine({
      db,
      transport,
      isOnline: () => online,
    });
    engine.start();
    await engine.enqueueMutation(makeMutation(1));
    expect(transport).not.toHaveBeenCalled();

    online = true;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    expect(await db.outbox.count()).toBe(0);
  });

  it('merges each field using its latest timestamp and rejects malformed timestamps', () => {
    const result = reconcileFieldLevelLww(
      {
        title: { value: 'local title', updatedAt: '2026-01-02T00:00:00.000Z' },
        status: { value: 'open', updatedAt: '2026-01-01T00:00:00.000Z' },
      },
      {
        title: { value: 'remote title', updatedAt: '2026-01-01T12:00:00.000Z' },
        status: { value: 'done', updatedAt: '2026-01-03T00:00:00.000Z' },
        icon: { value: 'sparkles', updatedAt: '2026-01-03T00:00:00.000Z' },
      },
    );

    expect(result.title.value).toBe('local title');
    expect(result.status.value).toBe('done');
    expect(result.icon.value).toBe('sparkles');
    expect(() =>
      reconcileFieldLevelLww(
        { title: { value: 'local', updatedAt: 'not-a-date' } },
        { title: { value: 'remote', updatedAt: '2026-01-03T00:00:00.000Z' } },
      ),
    ).toThrow(RangeError);
  });

  it('updates the Zustand state synchronously before the IndexedDB write resolves', async () => {
    engine = new SyncEngine({
      db,
      transport: async () => ({ acknowledged: [], awardedXp: [] }),
      isOnline: () => false,
    });
    const store = createWorkspaceStore({
      engine,
      createId: () => 'optimistic-key',
    });
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().applyOptimisticMutation({
      workspaceId: 'workspace-1',
      entityType: 'page',
      entityId: 'page-1',
      changes: { title: 'Instant title' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(store.getState().entities['page:page-1']?.title).toBe('Instant title');
    expect(listener).toHaveBeenCalledTimes(1);
    await vi.waitFor(async () => {
      expect(await db.pages.get('page-1')).toBeDefined();
      expect(await db.outbox.count()).toBe(1);
    });
  });
});
