import { randomUUID } from 'node:crypto';
import type { PropertyType } from '@prisma/client';
import type { JsonObject } from '@/types/workspace';
import { generateKeyBetween } from '@/lib/fractional-index';
import {
  awardXpInTransaction,
  createPrismaGamificationTransaction,
  type AwardXpResult,
} from './gamify-engine';
import {
  SMART_WORKFLOW_PRESETS,
  type SmartWorkflowPreset,
  type SmartWorkflowPresetKey,
} from '../workspaces/presets';
import { prisma } from '../db/prisma';

export interface ProvisionedWorkspace {
  id: string;
  name: string;
  slug: string;
  serverRevision: string;
  createdAt: string;
}

export interface WorkspaceProvisioningTransaction {
  createWorkspace(input: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<{ id: string; name: string; slug: string; serverRevision: bigint; createdAt: Date }>;
  createPage(input: {
    workspaceId: string;
    createdById: string;
    title: string;
    parentPageId: null;
    isDatabase: boolean;
    orderIndex: string;
  }): Promise<{ id: string }>;
  createDatabaseProperty(input: {
    databasePageId: string;
    name: string;
    type: PropertyType;
    config: JsonObject;
    orderIndex: string;
  }): Promise<{ id: string }>;
  createDatabaseView(input: {
    databasePageId: string;
    name: string;
    filters: JsonObject[];
    sorts: JsonObject[];
    visibleProperties: string[];
    orderIndex: string;
  }): Promise<void>;
  awardInitialXp(input: {
    userId: string;
    workspaceId: string;
    referenceId: string;
  }): Promise<AwardXpResult>;
}

export interface WorkspaceProvisioningRepository {
  transaction<T>(
    work: (transaction: WorkspaceProvisioningTransaction) => Promise<T>,
  ): Promise<T>;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'workspace';
}

function propertyDefinition(name: string): { type: PropertyType; config: JsonObject } {
  if (name === 'Status') {
    return {
      type: 'STATUS',
      config: {
        kind: 'status',
        options: [
          { id: 'todo', label: 'To do', color: 'gray' },
          { id: 'in-progress', label: 'In progress', color: 'blue' },
          { id: 'done', label: 'Done', color: 'green' },
        ],
        groups: { todo: ['todo'], inProgress: ['in-progress'], done: ['done'] },
      },
    };
  }
  if (name === 'Priority') {
    return {
      type: 'SELECT',
      config: {
        kind: 'select',
        options: [
          { id: 'low', label: 'Low', color: 'gray' },
          { id: 'medium', label: 'Medium', color: 'yellow' },
          { id: 'high', label: 'High', color: 'red' },
        ],
      },
    };
  }
  if (['Due Date', 'Start Date', 'Date', 'Created At'].includes(name)) {
    return { type: 'DATE', config: { kind: 'none' } };
  }
  if (['Assignee', 'Owner', 'Instructor'].includes(name)) {
    return { type: 'PERSON', config: { kind: 'none' } };
  }
  if (name === 'Attendees') {
    return { type: 'MULTI_SELECT', config: { kind: 'select', options: [] } };
  }
  if (name === 'Duration') {
    return { type: 'NUMBER', config: { kind: 'number', format: 'number' } };
  }
  if (name === 'Category') {
    return {
      type: 'SELECT',
      config: {
        kind: 'select',
        options: [
          { id: 'work', label: 'Work', color: 'blue' },
          { id: 'personal', label: 'Personal', color: 'purple' },
        ],
      },
    };
  }
  return { type: 'TEXT', config: { kind: 'none' } };
}

const prismaWorkspaceRepository: WorkspaceProvisioningRepository = {
  transaction: (work) =>
    prisma.$transaction(async (transaction) =>
      work({
        createWorkspace: async ({ name, slug, ownerId }) => {
          const workspace = await transaction.workspace.create({
            data: {
              name,
              slug,
              members: { create: { userId: ownerId, role: 'OWNER' } },
            },
            select: { id: true, name: true, slug: true, serverRevision: true, createdAt: true },
          });
          return workspace;
        },
        createPage: async (page) =>
          transaction.page.create({
            data: page,
            select: { id: true },
          }),
        createDatabaseProperty: async (property) =>
          transaction.databaseProperty.create({
            data: property,
            select: { id: true },
          }),
        createDatabaseView: async (view) => {
          await transaction.databaseView.create({ data: view });
        },
        awardInitialXp: async ({ userId, workspaceId, referenceId }) => {
          const result = await awardXpInTransaction(
            {
              userId,
              workspaceId,
              referenceId,
              actionType: 'CREATE_WORKSPACE',
            },
            createPrismaGamificationTransaction(transaction),
          );
          return result;
        },
      }),
    ),
};

export async function createWorkspaceWithPreset(
  input: {
    ownerId: string;
    name: string;
    presetKey: SmartWorkflowPresetKey;
  },
  repository: WorkspaceProvisioningRepository = prismaWorkspaceRepository,
  createSlugSuffix: () => string = () => randomUUID().slice(0, 8),
): Promise<{
  workspace: ProvisionedWorkspace;
  preset: Pick<SmartWorkflowPreset, 'key' | 'name' | 'description'>;
  createdPageCount: number;
  xpAward: AwardXpResult;
}> {
  const preset = SMART_WORKFLOW_PRESETS[input.presetKey];
  if (preset === undefined) {
    throw new RangeError(`Unknown workspace preset: ${input.presetKey}`);
  }
  const slug = `${slugify(input.name)}-${createSlugSuffix()}`;

  return repository.transaction(async (transaction) => {
    const workspace = await transaction.createWorkspace({
      name: input.name,
      slug,
      ownerId: input.ownerId,
    });
    let orderIndex: string | null = null;
    let createdPageCount = 0;

    const createRootPage = async (title: string, isDatabase: boolean) => {
      orderIndex = generateKeyBetween(orderIndex, null);
      const page = await transaction.createPage({
        workspaceId: workspace.id,
        createdById: input.ownerId,
        title,
        parentPageId: null,
        isDatabase,
        orderIndex,
      });
      createdPageCount += 1;
      return page;
    };

    for (const pageTitle of preset.pages) {
      await createRootPage(pageTitle, false);
    }

    for (const databasePreset of preset.databases) {
      const databasePage = await createRootPage(databasePreset.name, true);
      let propertyOrderIndex: string | null = null;
      const propertyIds: string[] = [];

      for (const propertyName of databasePreset.properties) {
        propertyOrderIndex = generateKeyBetween(propertyOrderIndex, null);
        const definition = propertyDefinition(propertyName);
        const property = await transaction.createDatabaseProperty({
          databasePageId: databasePage.id,
          name: propertyName,
          type: definition.type,
          config: definition.config,
          orderIndex: propertyOrderIndex,
        });
        propertyIds.push(property.id);
      }

      await transaction.createDatabaseView({
        databasePageId: databasePage.id,
        name: 'Table',
        filters: [],
        sorts: [],
        visibleProperties: propertyIds,
        orderIndex: 'a0',
      });
    }

    const xpAward = await transaction.awardInitialXp({
      userId: input.ownerId,
      workspaceId: workspace.id,
      referenceId: workspace.id,
    });
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        serverRevision: workspace.serverRevision.toString(10),
        createdAt: workspace.createdAt.toISOString(),
      },
      preset: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
      },
      createdPageCount,
      xpAward,
    };
  });
}
