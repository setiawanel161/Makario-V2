import { Prisma, type DatabaseProperty, type DatabaseView, type PropertyType } from '@prisma/client';
import { z } from 'zod';
import type { PropertyConfigPayload, ViewFilterRule, ViewSortRule } from '@/types/workspace';
import { generateKeyBetween } from '@/lib/fractional-index';
import {
  defaultPropertyConfig,
  propertyConfigSchema,
  viewFilterRuleSchema,
  viewSortRuleSchema,
} from '@/server/validators/database';
import { prisma } from '@/server/db/prisma';

export class DatabaseServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'DatabaseServiceError';
  }
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new DatabaseServiceError('Database configuration must be valid JSON.', 400);
  }
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export function serializeDatabaseProperty(property: DatabaseProperty) {
  return {
    ...property,
    config: propertyConfigSchema.parse(property.config),
    revision: property.revision.toString(10),
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

export function serializeDatabaseView(view: DatabaseView) {
  return {
    ...view,
    filters: viewFilterRuleSchema.array().parse(view.filters),
    sorts: viewSortRuleSchema.array().parse(view.sorts),
    visibleProperties: z.string().array().parse(view.visibleProperties),
    revision: view.revision.toString(10),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

async function findDatabase(
  transaction: Prisma.TransactionClient,
  pageId: string,
): Promise<{ id: string; workspaceId: string } | null> {
  return transaction.page.findFirst({
    where: { id: pageId, isDatabase: true, deletedAt: null },
    select: { id: true, workspaceId: true },
  });
}

async function nextRevision(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
): Promise<bigint> {
  const workspace = await transaction.workspace.findUnique({
    where: { id: workspaceId },
    select: { serverRevision: true },
  });
  if (workspace === null) {
    throw new DatabaseServiceError('Workspace was not found.', 404);
  }
  const revision = workspace.serverRevision + BigInt(1);
  await transaction.workspace.update({
    where: { id: workspaceId },
    data: { serverRevision: revision },
  });
  return revision;
}

async function validatePropertyConfig(
  transaction: Prisma.TransactionClient,
  databasePageId: string,
  propertyType: PropertyType,
  config: PropertyConfigPayload,
): Promise<void> {
  if (propertyType === 'RELATION' && config.kind === 'relation') {
    const target = await transaction.page.findFirst({
      where: {
        id: config.targetDatabaseId,
        isDatabase: true,
        deletedAt: null,
        workspaceId: (
          await transaction.page.findUniqueOrThrow({
            where: { id: databasePageId },
            select: { workspaceId: true },
          })
        ).workspaceId,
      },
      select: { id: true },
    });
    if (target === null) {
      throw new DatabaseServiceError('Relation target must be an active database in this workspace.', 400);
    }
  }
  if (propertyType === 'ROLLUP' && config.kind === 'rollup') {
    const [relation, target] = await Promise.all([
      transaction.databaseProperty.findFirst({
        where: {
          id: config.relationPropertyId,
          databasePageId,
          type: 'RELATION',
        },
        select: { id: true },
      }),
      transaction.databaseProperty.findFirst({
        where: { id: config.targetPropertyId },
        select: { id: true },
      }),
    ]);
    if (relation === null || target === null) {
      throw new DatabaseServiceError('Rollup references must point to existing properties.', 400);
    }
  }
}

export async function createDatabaseProperty(input: {
  pageId: string;
  name: string;
  type: PropertyType;
  config?: PropertyConfigPayload;
}): Promise<ReturnType<typeof serializeDatabaseProperty>> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }

      const config = input.config ?? defaultPropertyConfig(input.type);
      await validatePropertyConfig(transaction, database.id, input.type, config);
      const [last, revision] = await Promise.all([
        transaction.databaseProperty.findFirst({
          where: { databasePageId: database.id },
          orderBy: { orderIndex: 'desc' },
          select: { orderIndex: true },
        }),
        nextRevision(transaction, database.workspaceId),
      ]);
      const property = await transaction.databaseProperty.create({
        data: {
          databasePageId: database.id,
          name: input.name,
          type: input.type,
          config: inputJson(config),
          orderIndex: generateKeyBetween(last?.orderIndex ?? null, null),
          revision,
          fieldTimestamps: { name: new Date().toISOString() },
        },
      });
      return serializeDatabaseProperty(property);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateDatabaseProperty(input: {
  pageId: string;
  id: string;
  name?: string;
  type?: PropertyType;
  config?: PropertyConfigPayload;
  orderIndex?: string;
}): Promise<ReturnType<typeof serializeDatabaseProperty>> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }
      const existing = await transaction.databaseProperty.findFirst({
        where: { id: input.id, databasePageId: database.id },
      });
      if (existing === null) {
        throw new DatabaseServiceError('Database property was not found.', 404);
      }

      const type = input.type ?? existing.type;
      const existingConfig = propertyConfigSchema.parse(existing.config);
      const config =
        input.config ??
        (input.type !== undefined && input.type !== existing.type
          ? defaultPropertyConfig(type)
          : existingConfig);
      await validatePropertyConfig(transaction, database.id, type, config);
      const revision = await nextRevision(transaction, database.workspaceId);
      const now = new Date().toISOString();
      const fieldTimestamps = {
        ...(existing.fieldTimestamps as Record<string, string>),
        ...(input.name === undefined ? {} : { name: now }),
        ...(input.type === undefined ? {} : { type: now }),
        ...(input.config === undefined ? {} : { config: now }),
        ...(input.orderIndex === undefined ? {} : { orderIndex: now }),
      };
      const property = await transaction.databaseProperty.update({
        where: { id: existing.id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.type === undefined ? {} : { type }),
          ...(input.config === undefined && input.type === undefined
            ? {}
            : { config: inputJson(config) }),
          ...(input.orderIndex === undefined ? {} : { orderIndex: input.orderIndex }),
          revision,
          fieldTimestamps,
        },
      });
      return serializeDatabaseProperty(property);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deleteDatabaseProperty(input: {
  pageId: string;
  id: string;
}): Promise<{ id: string; serverRevision: string }> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }
      const property = await transaction.databaseProperty.findFirst({
        where: { id: input.id, databasePageId: database.id },
        select: { id: true },
      });
      if (property === null) {
        throw new DatabaseServiceError('Database property was not found.', 404);
      }
      const revision = await nextRevision(transaction, database.workspaceId);
      const views = await transaction.databaseView.findMany({
        where: { databasePageId: database.id },
      });
      const now = new Date().toISOString();
      for (const view of views) {
        const existingFilters = viewFilterRuleSchema.array().parse(view.filters);
        const existingSorts = viewSortRuleSchema.array().parse(view.sorts);
        const existingVisibleProperties = z.string().array().parse(view.visibleProperties);
        const filters = existingFilters.filter((filter) => filter.propertyId !== property.id);
        const sorts = existingSorts.filter((sort) => sort.propertyId !== property.id);
        const visibleProperties = existingVisibleProperties.filter((id) => id !== property.id);
        if (
          filters.length === existingFilters.length &&
          sorts.length === existingSorts.length &&
          visibleProperties.length === existingVisibleProperties.length &&
          view.groupByPropertyId !== property.id
        ) {
          continue;
        }
        await transaction.databaseView.update({
          where: { id: view.id },
          data: {
            filters: inputJson(filters),
            sorts: inputJson(sorts),
            visibleProperties: inputJson(visibleProperties),
            ...(view.groupByPropertyId === property.id
              ? { groupByProperty: { disconnect: true } }
              : {}),
            revision,
            fieldTimestamps: {
              ...(view.fieldTimestamps as Record<string, string>),
              filters: now,
              sorts: now,
              visibleProperties: now,
              ...(view.groupByPropertyId === property.id ? { groupByPropertyId: now } : {}),
            },
          },
        });
      }
      await transaction.databaseProperty.delete({ where: { id: property.id } });
      return { id: property.id, serverRevision: revision.toString(10) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function validateViewReferences(
  transaction: Prisma.TransactionClient,
  databasePageId: string,
  input: {
    filters: ViewFilterRule[];
    sorts: ViewSortRule[];
    visibleProperties: string[];
    groupByPropertyId: string | null;
  },
): Promise<void> {
  const propertyIds = new Set([
    ...input.filters.map((filter) => filter.propertyId),
    ...input.sorts.map((sort) => sort.propertyId),
    ...input.visibleProperties,
    ...(input.groupByPropertyId === null ? [] : [input.groupByPropertyId]),
  ]);
  if (propertyIds.size === 0) return;

  const properties = await transaction.databaseProperty.findMany({
    where: { databasePageId, id: { in: [...propertyIds] } },
    select: { id: true },
  });
  if (properties.length !== propertyIds.size) {
    throw new DatabaseServiceError('View configuration references a property outside this database.', 400);
  }
}

export async function createDatabaseView(input: {
  pageId: string;
  name: string;
  layout: DatabaseView['layout'];
  filters: ViewFilterRule[];
  sorts: ViewSortRule[];
  visibleProperties: string[];
  groupByPropertyId: string | null;
}): Promise<ReturnType<typeof serializeDatabaseView>> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }
      await validateViewReferences(transaction, database.id, input);
      const [last, revision] = await Promise.all([
        transaction.databaseView.findFirst({
          where: { databasePageId: database.id },
          orderBy: { orderIndex: 'desc' },
          select: { orderIndex: true },
        }),
        nextRevision(transaction, database.workspaceId),
      ]);
      const view = await transaction.databaseView.create({
        data: {
          databasePageId: database.id,
          name: input.name,
          layout: input.layout,
          filters: inputJson(input.filters),
          sorts: inputJson(input.sorts),
          visibleProperties: inputJson(input.visibleProperties),
          groupByPropertyId: input.groupByPropertyId,
          orderIndex: generateKeyBetween(last?.orderIndex ?? null, null),
          revision,
          fieldTimestamps: { name: new Date().toISOString() },
        },
      });
      return serializeDatabaseView(view);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateDatabaseView(input: {
  pageId: string;
  id: string;
  name?: string;
  layout?: DatabaseView['layout'];
  filters?: ViewFilterRule[];
  sorts?: ViewSortRule[];
  visibleProperties?: string[];
  groupByPropertyId?: string | null;
  orderIndex?: string;
}): Promise<ReturnType<typeof serializeDatabaseView>> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }
      const existing = await transaction.databaseView.findFirst({
        where: { id: input.id, databasePageId: database.id },
      });
      if (existing === null) {
        throw new DatabaseServiceError('Database view was not found.', 404);
      }

      const filters =
        input.filters ?? viewFilterRuleSchema.array().parse(existing.filters);
      const sorts =
        input.sorts ?? viewSortRuleSchema.array().parse(existing.sorts);
      const visibleProperties =
        input.visibleProperties ?? z.string().array().parse(existing.visibleProperties);
      const groupByPropertyId =
        input.groupByPropertyId === undefined
          ? existing.groupByPropertyId
          : input.groupByPropertyId;
      await validateViewReferences(transaction, database.id, {
        filters,
        sorts,
        visibleProperties,
        groupByPropertyId,
      });
      const revision = await nextRevision(transaction, database.workspaceId);
      const now = new Date().toISOString();
      const fieldTimestamps = {
        ...(existing.fieldTimestamps as Record<string, string>),
        ...(input.name === undefined ? {} : { name: now }),
        ...(input.layout === undefined ? {} : { layout: now }),
        ...(input.filters === undefined ? {} : { filters: now }),
        ...(input.sorts === undefined ? {} : { sorts: now }),
        ...(input.visibleProperties === undefined ? {} : { visibleProperties: now }),
        ...(input.groupByPropertyId === undefined ? {} : { groupByPropertyId: now }),
        ...(input.orderIndex === undefined ? {} : { orderIndex: now }),
      };
      const view = await transaction.databaseView.update({
        where: { id: existing.id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.layout === undefined ? {} : { layout: input.layout }),
          ...(input.filters === undefined ? {} : { filters: inputJson(input.filters) }),
          ...(input.sorts === undefined ? {} : { sorts: inputJson(input.sorts) }),
          ...(input.visibleProperties === undefined
            ? {}
            : { visibleProperties: inputJson(input.visibleProperties) }),
          ...(input.groupByPropertyId === undefined
            ? {}
            : {
                groupByProperty:
                  groupByPropertyId === null
                    ? { disconnect: true }
                    : { connect: { id: groupByPropertyId } },
              }),
          ...(input.orderIndex === undefined ? {} : { orderIndex: input.orderIndex }),
          revision,
          fieldTimestamps,
        },
      });
      return serializeDatabaseView(view);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deleteDatabaseView(input: {
  pageId: string;
  id: string;
}): Promise<{ id: string; serverRevision: string }> {
  return prisma.$transaction(
    async (transaction) => {
      const database = await findDatabase(transaction, input.pageId);
      if (database === null) {
        throw new DatabaseServiceError('Database page was not found.', 404);
      }
      const view = await transaction.databaseView.findFirst({
        where: { id: input.id, databasePageId: database.id },
        select: { id: true },
      });
      if (view === null) {
        throw new DatabaseServiceError('Database view was not found.', 404);
      }
      const revision = await nextRevision(transaction, database.workspaceId);
      await transaction.databaseView.delete({ where: { id: view.id } });
      return { id: view.id, serverRevision: revision.toString(10) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
