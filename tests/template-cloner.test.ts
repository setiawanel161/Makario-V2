import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  cloneTemplateTree,
  type TemplateCloneRepository,
  type TemplateCloneTransaction,
} from '@/server/services/template-cloner';

describe('template cloner', () => {
  it('remaps a database subtree in four passes and degrades external relations', async () => {
    const root = {
      id: 'source-db',
      workspaceId: 'source-workspace',
      parentPageId: null,
      createdById: 'creator',
      title: 'Template',
      icon: '📚',
      coverUrl: null,
      fontFamily: 'sans',
      isFullWidth: false,
      orderIndex: 'a0',
      isDatabase: true,
      isFavorite: false,
      isPrivate: false,
      revision: BigInt(1),
      fieldTimestamps: {},
      deletedAt: null,
    };
    const child = {
      ...root,
      id: 'source-row',
      parentPageId: 'source-db',
      title: 'Example row',
      isDatabase: false,
    };
    const createdPages: Prisma.PageUncheckedCreateInput[] = [];
    const createdProperties: Prisma.DatabasePropertyUncheckedCreateInput[] = [];
    const createdViews: Prisma.DatabaseViewUncheckedCreateInput[] = [];
    const createdBlocks: Prisma.BlockUncheckedCreateInput[] = [];
    const createdRowProperties: Prisma.DatabaseRowPropertyUncheckedCreateInput[] = [];
    const incrementCloneCount = vi.fn(async () => undefined);
    const awardCreatorKarma = vi.fn(async () => ({ karmaScore: 25 }));
    let updatedWorkspaceRevision: bigint | null = null;
    const transaction: TemplateCloneTransaction = {
      findPage: async (pageId) => (pageId === root.id ? root : null),
      findChildren: async (parentIds) =>
        parentIds.includes(root.id) ? [child] : [],
      findBlocks: async () => [
        {
          id: 'source-block',
          pageId: root.id,
          parentBlockId: null,
          syncedSourceId: null,
          type: 'CHILD_DATABASE',
          content: { kind: 'child_database', databasePageId: root.id },
          orderIndex: 'a0',
        },
      ],
      findProperties: async () => [
        {
          id: 'external-relation',
          databasePageId: root.id,
          name: 'External relation',
          type: 'RELATION',
          config: { kind: 'relation', targetDatabaseId: 'outside-database' },
          orderIndex: 'a0',
        },
      ],
      findViews: async () => [
        {
          id: 'source-view',
          databasePageId: root.id,
          name: 'Default',
          layout: 'TABLE',
          filters: [{ id: 'filter', propertyId: 'external-relation', operator: 'is_not_empty' }],
          sorts: [{ propertyId: 'external-relation', direction: 'asc' }],
          visibleProperties: ['external-relation'],
          groupByPropertyId: 'external-relation',
          orderIndex: 'a0',
        },
      ],
      findRowProperties: async () => [
        {
          rowPageId: child.id,
          propertyId: 'external-relation',
          value: 'page-outside-tree',
        },
      ],
      getWorkspaceRevision: async () => BigInt(8),
      getLastOrderIndex: async () => 'a0',
      createPage: async (input) => {
        createdPages.push(input);
      },
      createProperty: async (input) => {
        createdProperties.push(input);
      },
      createView: async (input) => {
        createdViews.push(input);
      },
      createBlock: async (input) => {
        createdBlocks.push(input);
      },
      createRowProperty: async (input) => {
        createdRowProperties.push(input);
      },
      incrementCloneCount,
      setWorkspaceRevision: async (_workspaceId, revision) => {
        updatedWorkspaceRevision = revision;
      },
      awardCreatorKarma,
    };
    const repository: TemplateCloneRepository = {
      transaction: async (work) => work(transaction),
    };
    let nextId = 0;

    const result = await cloneTemplateTree(
      {
        sourcePageId: root.id,
        targetWorkspaceId: 'target-workspace',
        userId: 'copying-user',
        awardCreatorKarma: true,
      },
      repository,
      () => `new-id-${++nextId}`,
    );

    expect(result).toMatchObject({
      pageId: 'new-id-1',
      clonedPageCount: 2,
      serverRevision: '9',
      karmaScore: 25,
    });
    expect(createdPages).toHaveLength(2);
    expect(createdPages[1]?.parentPageId).toBe('new-id-1');
    expect(createdProperties[0]).toMatchObject({ type: 'TEXT', id: 'new-id-3' });
    expect(createdViews[0]?.visibleProperties).toEqual(['new-id-3']);
    expect(createdBlocks[0]?.pageId).toBe('new-id-1');
    expect(createdBlocks[0]?.content).toMatchObject({ databasePageId: 'new-id-1' });
    expect(createdRowProperties[0]?.rowPageId).toBe('new-id-2');
    expect(createdRowProperties[0]?.propertyId).toBe('new-id-3');
    expect(createdRowProperties[0]?.value).toBe('page-outside-tree');
    expect(updatedWorkspaceRevision).toBe(BigInt(9));
    expect(incrementCloneCount).toHaveBeenCalledWith(root.id);
    expect(awardCreatorKarma).toHaveBeenCalledWith('creator');
  });
});
