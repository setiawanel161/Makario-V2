import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  pageFindFirst: vi.fn(),
  pageCreate: vi.fn(),
  blockFindMany: vi.fn(),
  workspaceFindUnique: vi.fn(),
  workspaceUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/server/auth/route-utils', () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
  authorizationErrorResponse: () => null,
}));
vi.mock('@/server/auth/rbac', () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
}));
vi.mock('@/server/db/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    page: { findFirst: mocks.pageFindFirst, create: mocks.pageCreate },
    block: { findMany: mocks.blockFindMany },
    workspace: {
      findUnique: mocks.workspaceFindUnique,
      update: mocks.workspaceUpdate,
    },
  },
}));

import { GET as getPage } from '@/app/api/pages/[pageId]/route';
import { POST as createWorkspacePage } from '@/app/api/workspaces/[id]/pages/route';
import {
  processSyncBatch,
  type SyncRecordSnapshot,
  type SyncRepository,
  type SyncTransaction,
} from '@/server/services/sync-service';
import { syncMutationSchema } from '@/server/validators/sync';

class FakeSyncRepository implements SyncRepository {
  workspaceRevision = BigInt(1);
  activeBlocks = 0;
  totalXp = 0;
  readonly pages = new Map<string, SyncRecordSnapshot>();
  readonly blocks = new Map<string, SyncRecordSnapshot>();
  readonly receipts = new Map<
    string,
    { workspaceId: string; userId: string; mutationType: string; entityId: string }
  >();
  readonly xpLedger = new Set<string>();

  async transaction<T>(work: (transaction: SyncTransaction) => Promise<T>): Promise<T> {
    const transaction: SyncTransaction = {
      getWorkspace: async () => ({ planTier: 'FREE', serverRevision: this.workspaceRevision }),
      setServerRevision: async (_workspaceId, revision) => {
        this.workspaceRevision = revision;
      },
      getReceipt: async (idempotencyKey) => this.receipts.get(idempotencyKey) ?? null,
      createReceipt: async (receipt) => {
        this.receipts.set(receipt.idempotencyKey, receipt);
      },
      countActiveBlocks: async () => this.activeBlocks,
      getLastPageOrderIndex: async () => null,
      findPage: async (id) => this.pages.get(id) ?? null,
      createPage: async ({ id, workspaceId, fields, revision, fieldTimestamps }) => {
        this.pages.set(id, {
          id,
          workspaceId,
          fields: { ...fields },
          revision,
          fieldTimestamps,
          deletedAt: null,
        });
      },
      updatePage: async ({ id, fields, revision, fieldTimestamps, deletedAt }) => {
        const page = this.pages.get(id);
        if (page === undefined) throw new Error('Missing fixture page.');
        this.pages.set(id, {
          ...page,
          fields: { ...page.fields, ...fields },
          revision,
          fieldTimestamps,
          ...(deletedAt === undefined ? {} : { deletedAt }),
        });
      },
      findBlock: async (id) => this.blocks.get(id) ?? null,
      createBlock: async ({ id, workspaceId, pageId, fields, revision, fieldTimestamps }) => {
        this.blocks.set(id, {
          id,
          workspaceId,
          pageId,
          parentBlockId: fields.parentBlockId ?? null,
          fields: { ...fields },
          revision,
          fieldTimestamps,
          deletedAt: null,
        });
        this.activeBlocks += 1;
      },
      updateBlock: async ({ id, fields, revision, fieldTimestamps, deletedAt }) => {
        const block = this.blocks.get(id);
        if (block === undefined) throw new Error('Missing fixture block.');
        this.blocks.set(id, {
          ...block,
          fields: { ...block.fields, ...fields },
          revision,
          fieldTimestamps,
          ...(deletedAt === undefined ? {} : { deletedAt }),
        });
      },
      isDatabaseRowPropertyInWorkspace: async () => false,
      findRowProperty: async () => null,
      upsertRowProperty: async () => undefined,
      awardXp: async (input) => {
        const key = `${input.userId}:${input.actionType}:${input.referenceId}`;
        if (this.xpLedger.has(key)) {
          return {
            status: 'duplicate',
            totalXp: this.totalXp,
            tier: this.totalXp >= 500 ? 'SYSTEMS_ARCHITECT' : 'APPRENTICE_SCRIBE',
          };
        }
        this.xpLedger.add(key);
        const xpDelta = input.actionType === 'COMPLETE_TODO' ? 10 : 15;
        this.totalXp += xpDelta;
        return {
          status: 'awarded',
          xpDelta,
          totalXp: this.totalXp,
          tier: this.totalXp >= 500 ? 'SYSTEMS_ARCHITECT' : 'APPRENTICE_SCRIBE',
        };
      },
    };
    return work(transaction);
  }
}

function makeMutation(input: {
  type: 'UPDATE_BLOCK' | 'CREATE_BLOCK';
  idempotencyKey: string;
  entityId: string;
  changes: Record<string, unknown>;
  createdAt?: string;
  fieldTimestamps?: Record<string, string>;
}) {
  const { createdAt, fieldTimestamps, ...mutation } = input;
  return syncMutationSchema.parse({
    workspaceId: 'workspace-1',
    createdAt: createdAt ?? '2026-01-02T00:00:00.000Z',
    ...mutation,
    ...(fieldTimestamps === undefined ? {} : { fieldTimestamps }),
  });
}

function seedPage(repository: FakeSyncRepository): void {
  repository.pages.set('page-1', {
    id: 'page-1',
    workspaceId: 'workspace-1',
    fields: { title: 'Page', orderIndex: 'a0', isPrivate: false },
    revision: BigInt(1),
    fieldTimestamps: {},
    deletedAt: null,
  });
}

describe('sync API and mutation service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1');
    mocks.requireWorkspaceRole.mockResolvedValue({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      role: 'MEMBER',
    });
    mocks.transaction.mockImplementation(async (operation) =>
      operation({
        workspace: {
          findUnique: mocks.workspaceFindUnique,
          update: mocks.workspaceUpdate,
        },
        page: {
          findFirst: mocks.pageFindFirst,
          create: mocks.pageCreate,
        },
      }),
    );
    mocks.workspaceFindUnique.mockResolvedValue({ serverRevision: BigInt(42) });
    mocks.workspaceUpdate.mockResolvedValue({});
    mocks.pageCreate.mockResolvedValue({
      id: 'page-new',
      workspaceId: 'workspace-1',
      parentPageId: null,
      title: 'Untitled',
      orderIndex: 'a0',
      isDatabase: false,
      isFavorite: false,
      isPrivate: false,
      revision: BigInt(43),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
  });

  it('serializes every page and block BigInt revision in the page response', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    mocks.pageFindFirst.mockResolvedValue({
      id: 'page-1',
      workspaceId: 'workspace-1',
      parentPageId: null,
      createdById: 'user-1',
      title: 'A page',
      icon: null,
      coverUrl: null,
      fontFamily: 'sans',
      isFullWidth: false,
      orderIndex: 'a0',
      isDatabase: false,
      isFavorite: false,
      isPrivate: false,
      isPublished: false,
      publicSlug: null,
      revision: BigInt('9007199254740993'),
      createdAt: now,
      updatedAt: now,
    });
    mocks.blockFindMany.mockResolvedValue([
      {
        id: 'block-1',
        pageId: 'page-1',
        parentBlockId: null,
        type: 'PARAGRAPH',
        content: { kind: 'text', spans: [] },
        orderIndex: 'a0',
        revision: BigInt('9007199254740995'),
        updatedAt: now,
      },
    ]);

    const response = await getPage(new Request('https://example.test/api/pages/page-1'), {
      params: Promise.resolve({ pageId: 'page-1' }),
    });
    const payload = (await response.json()) as {
      page: { revision: string };
      blocks: Array<{ revision: string }>;
    };

    expect(payload.page.revision).toBe('9007199254740993');
    expect(payload.blocks[0]?.revision).toBe('9007199254740995');
  });

  it('advances the workspace revision for pages created by the workspace sidebar API', async () => {
    const response = await createWorkspacePage(
      new Request('https://example.test/api/workspaces/workspace-1/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'A new page' }),
      }),
      { params: Promise.resolve({ id: 'workspace-1' }) },
    );
    const payload = (await response.json()) as { page: { revision: string } };

    expect(response.status).toBe(201);
    expect(payload.page.revision).toBe('43');
    expect(mocks.pageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revision: BigInt(43),
          fieldTimestamps: expect.objectContaining({ title: expect.any(String) }),
        }),
      }),
    );
    expect(mocks.workspaceUpdate).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
      data: { serverRevision: BigInt(43) },
    });
  });

  it('uses field-level LWW and awards TODO XP once across idempotent retries', async () => {
    const repository = new FakeSyncRepository();
    seedPage(repository);
    repository.blocks.set('block-1', {
      id: 'block-1',
      workspaceId: 'workspace-1',
      pageId: 'page-1',
      parentBlockId: null,
      fields: {
        type: 'TODO',
        content: { kind: 'todo', spans: [{ text: 'Task' }], checked: false },
        orderIndex: 'a0',
      },
      revision: BigInt(1),
      fieldTimestamps: { content: '2026-01-01T00:00:00.000Z' },
      deletedAt: null,
    });
    repository.activeBlocks = 1;
    const mutation = makeMutation({
      type: 'UPDATE_BLOCK',
      idempotencyKey: 'todo-check',
      entityId: 'block-1',
      changes: {
        content: { kind: 'todo', spans: [{ text: 'Task' }], checked: true },
      },
      fieldTimestamps: { content: '2026-01-02T00:00:00.000Z' },
    });

    const first = await processSyncBatch(
      { userId: 'user-1', workspaceId: 'workspace-1', mutations: [mutation] },
      repository,
      () => new Date('2026-01-03T00:00:00.000Z'),
    );
    const retry = await processSyncBatch(
      { userId: 'user-1', workspaceId: 'workspace-1', mutations: [mutation] },
      repository,
      () => new Date('2026-01-03T00:00:00.000Z'),
    );
    const stale = makeMutation({
      type: 'UPDATE_BLOCK',
      idempotencyKey: 'todo-stale-edit',
      entityId: 'block-1',
      changes: { content: { kind: 'todo', spans: [{ text: 'Old' }], checked: false } },
      fieldTimestamps: { content: '2026-01-01T12:00:00.000Z' },
    });
    await processSyncBatch(
      { userId: 'user-1', workspaceId: 'workspace-1', mutations: [stale] },
      repository,
      () => new Date('2026-01-03T00:00:00.000Z'),
    );

    expect(first.awardedXp).toEqual([
      { actionType: 'COMPLETE_TODO', referenceId: 'block-1', xpDelta: 10 },
    ]);
    expect(retry.awardedXp).toEqual([]);
    expect(repository.totalXp).toBe(10);
    expect(repository.blocks.get('block-1')?.fields.content).toMatchObject({ checked: true });
  });

  it('rejects free-plan block creation when the active-block quota is reached', async () => {
    const repository = new FakeSyncRepository();
    seedPage(repository);
    repository.activeBlocks = 1000;
    const create = makeMutation({
      type: 'CREATE_BLOCK',
      idempotencyKey: 'over-free-limit',
      entityId: 'new-block',
      changes: {
        pageId: 'page-1',
        type: 'PARAGRAPH',
        content: { kind: 'text', spans: [] },
        orderIndex: 'a1',
      },
    });

    await expect(
      processSyncBatch(
        { userId: 'user-1', workspaceId: 'workspace-1', mutations: [create] },
        repository,
      ),
    ).rejects.toMatchObject({
      status: 413,
      code: 'FREE_BLOCK_LIMIT',
    });
    expect(repository.blocks.has('new-block')).toBe(false);
  });

  it('rejects block payloads whose content discriminator does not match the block type', () => {
    const invalid = syncMutationSchema.safeParse({
      type: 'CREATE_BLOCK',
      workspaceId: 'workspace-1',
      entityId: 'block-1',
      idempotencyKey: 'invalid-content',
      createdAt: '2026-01-02T00:00:00.000Z',
      changes: {
        pageId: 'page-1',
        type: 'TODO',
        content: { kind: 'text', spans: [{ text: 'Not a todo payload' }] },
        orderIndex: 'a0',
      },
    });

    expect(invalid.success).toBe(false);
  });
});
