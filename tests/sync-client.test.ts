import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { workspaceDb } from '../src/lib/sync/dexie-db';
import { pullWorkspaceDelta } from '../src/lib/sync/sync-client';

beforeEach(async () => {
  await workspaceDb.delete();
  await workspaceDb.open();
});

afterEach(async () => {
  await workspaceDb.delete();
});

describe('sync delta client', () => {
  it('persists the server revision and reconciles remote fields without overwriting newer local edits', async () => {
    await workspaceDb.pages.put({
      id: 'page-1',
      workspaceId: 'workspace-1',
      title: 'Local title',
      icon: null,
      revision: '4',
      updatedAt: '2026-01-03T00:00:00.000Z',
      fieldTimestamps: {
        title: '2026-01-03T00:00:00.000Z',
      },
    });
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          serverRevision: '8',
          pages: [
            {
              id: 'page-1',
              workspaceId: 'workspace-1',
              title: 'Older remote title',
              icon: 'sparkles',
              revision: '7',
              updatedAt: '2026-01-04T00:00:00.000Z',
              fieldTimestamps: {
                title: '2026-01-02T00:00:00.000Z',
                icon: '2026-01-04T00:00:00.000Z',
              },
            },
          ],
          blocks: [],
          properties: [],
          rowProperties: [],
          views: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    await expect(pullWorkspaceDelta('workspace-1', fetcher)).resolves.toBe('8');

    expect(await workspaceDb.pages.get('page-1')).toMatchObject({
      title: 'Local title',
      icon: 'sparkles',
      revision: '7',
      fieldTimestamps: {
        title: '2026-01-03T00:00:00.000Z',
        icon: '2026-01-04T00:00:00.000Z',
      },
    });
    expect(await workspaceDb.syncMetadata.get('workspace-1')).toEqual({
      workspaceId: 'workspace-1',
      serverRevision: '8',
    });
  });
});
