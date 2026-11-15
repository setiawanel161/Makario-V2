import { describe, expect, it } from 'vitest';
import {
  createWorkspaceWithPreset,
  type WorkspaceProvisioningRepository,
  type WorkspaceProvisioningTransaction,
} from '../src/server/services/workspace-service';

function fakeRepository(): {
  repository: WorkspaceProvisioningRepository;
  workspaces: Array<{ name: string; slug: string; ownerId: string }>;
  pages: Array<{
    workspaceId: string;
    createdById: string;
    title: string;
    parentPageId: null;
    isDatabase: boolean;
    orderIndex: string;
  }>;
  properties: Array<{ name: string; type: string; databasePageId: string }>;
  views: Array<{ databasePageId: string; visibleProperties: string[] }>;
  awards: Array<{ userId: string; workspaceId: string; referenceId: string }>;
} {
  const workspaces: Array<{ name: string; slug: string; ownerId: string }> = [];
  const pages: Array<{
    workspaceId: string;
    createdById: string;
    title: string;
    parentPageId: null;
    isDatabase: boolean;
    orderIndex: string;
  }> = [];
  const properties: Array<{ name: string; type: string; databasePageId: string }> = [];
  const views: Array<{ databasePageId: string; visibleProperties: string[] }> = [];
  const awards: Array<{ userId: string; workspaceId: string; referenceId: string }> = [];

  const repository: WorkspaceProvisioningRepository = {
    transaction: async <T>(
      work: (transaction: WorkspaceProvisioningTransaction) => Promise<T>,
    ): Promise<T> => {
      let nextId = 0;
      const transaction: WorkspaceProvisioningTransaction = {
        createWorkspace: async (input) => {
          workspaces.push(input);
          return {
            id: 'workspace-1',
            name: input.name,
            slug: input.slug,
            serverRevision: BigInt('15'),
            createdAt: new Date('2026-03-04T10:00:00.000Z'),
          };
        },
        createPage: async (input) => {
          pages.push(input);
          nextId += 1;
          return { id: `page-${nextId}` };
        },
        createDatabaseProperty: async (input) => {
          properties.push({
            name: input.name,
            type: input.type,
            databasePageId: input.databasePageId,
          });
          nextId += 1;
          return { id: `property-${nextId}` };
        },
        createDatabaseView: async (input) => {
          views.push({
            databasePageId: input.databasePageId,
            visibleProperties: input.visibleProperties,
          });
        },
        awardInitialXp: async (input) => {
          awards.push(input);
          return { status: 'awarded', xpDelta: 50, totalXp: 50, tier: 'APPRENTICE_SCRIBE' };
        },
      };
      return work(transaction);
    },
  };
  return { repository, workspaces, pages, properties, views, awards };
}

describe('workspace provisioning API service', () => {
  it('applies the selected Team preset, creates an owner, and serializes revisions', async () => {
    const fake = fakeRepository();
    const result = await createWorkspaceWithPreset(
      { ownerId: 'owner-1', name: 'North Studio', presetKey: 'TEAM' },
      fake.repository,
      () => 'fixed-id',
    );

    expect(fake.workspaces).toEqual([
      { name: 'North Studio', slug: 'north-studio-fixed-id', ownerId: 'owner-1' },
    ]);
    expect(fake.pages.filter((page) => !page.isDatabase).map((page) => page.title)).toEqual([
      'Team Home',
      'Projects',
      'Meeting Notes',
      'Handbook',
    ]);
    expect(fake.pages.filter((page) => page.isDatabase).map((page) => page.title)).toEqual([
      'Tasks',
      'Projects',
      'Meeting Notes',
    ]);
    expect(fake.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Status', type: 'STATUS' }),
        expect.objectContaining({ name: 'Assignee', type: 'PERSON' }),
        expect.objectContaining({ name: 'Due Date', type: 'DATE' }),
      ]),
    );
    expect(fake.views).toHaveLength(3);
    expect(fake.views.every((view) => view.visibleProperties.length > 0)).toBe(true);
    expect(fake.awards).toEqual([
      { userId: 'owner-1', workspaceId: 'workspace-1', referenceId: 'workspace-1' },
    ]);
    expect(result).toMatchObject({
      workspace: { slug: 'north-studio-fixed-id', serverRevision: '15' },
      preset: { key: 'TEAM', name: 'Team' },
      createdPageCount: 7,
      xpAward: { status: 'awarded', xpDelta: 50 },
    });
  });

  it('uses sequentially ordered root pages from the fractional index engine', async () => {
    const fake = fakeRepository();
    await createWorkspaceWithPreset(
      { ownerId: 'owner-1', name: 'Personal', presetKey: 'PERSONAL' },
      fake.repository,
      () => 'test',
    );
    const keys = fake.pages.map((page) => page.orderIndex);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort());
  });
});
