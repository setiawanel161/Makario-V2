import { Prisma, type Block, type DatabaseProperty, type DatabaseRowProperty, type DatabaseView, type Page } from '@prisma/client';
import type { JsonObject, PropertyConfigPayload, ViewFilterRule, ViewSortRule } from '@/types/workspace';
import { toJsonObject } from '@/lib/editor/block-content-schema';
import { generateKeyBetween } from '@/lib/fractional-index';
import { prisma } from '@/server/db/prisma';
import {
  propertyConfigSchema,
  viewFilterRuleSchema,
  viewSortRuleSchema,
} from '@/server/validators/database';
import {
  awardTemplateCreatorKarmaInTransaction,
  createPrismaGamificationTransaction,
} from './gamify-engine';

const MAX_PAGE_DEPTH = 10;

type ClonePageSource = Pick<
  Page,
  | 'id'
  | 'workspaceId'
  | 'parentPageId'
  | 'createdById'
  | 'title'
  | 'icon'
  | 'coverUrl'
  | 'fontFamily'
  | 'isFullWidth'
  | 'orderIndex'
  | 'isDatabase'
  | 'isFavorite'
  | 'isPrivate'
  | 'revision'
  | 'fieldTimestamps'
  | 'deletedAt'
>;

type CloneBlockSource = Pick<
  Block,
  | 'id'
  | 'pageId'
  | 'parentBlockId'
  | 'syncedSourceId'
  | 'type'
  | 'content'
  | 'orderIndex'
>;

type ClonePropertySource = Pick<
  DatabaseProperty,
  'id' | 'databasePageId' | 'name' | 'type' | 'config' | 'orderIndex'
>;

type CloneViewSource = Pick<
  DatabaseView,
  | 'id'
  | 'databasePageId'
  | 'name'
  | 'layout'
  | 'filters'
  | 'sorts'
  | 'visibleProperties'
  | 'groupByPropertyId'
  | 'orderIndex'
>;

type CloneRowPropertySource = Pick<
  DatabaseRowProperty,
  'rowPageId' | 'propertyId' | 'value'
>;

export interface TemplateCloneTransaction {
  findPage(pageId: string): Promise<ClonePageSource | null>;
  findChildren(
    parentPageIds: string[],
    workspaceId: string,
    includePrivate: boolean,
    userId: string,
  ): Promise<ClonePageSource[]>;
  findBlocks(pageIds: string[]): Promise<CloneBlockSource[]>;
  findProperties(databasePageIds: string[]): Promise<ClonePropertySource[]>;
  findViews(databasePageIds: string[]): Promise<CloneViewSource[]>;
  findRowProperties(rowPageIds: string[]): Promise<CloneRowPropertySource[]>;
  getWorkspaceRevision(workspaceId: string): Promise<bigint | null>;
  getLastOrderIndex(workspaceId: string, parentPageId: string | null): Promise<string | null>;
  createPage(input: Prisma.PageUncheckedCreateInput): Promise<void>;
  createProperty(input: Prisma.DatabasePropertyUncheckedCreateInput): Promise<void>;
  createView(input: Prisma.DatabaseViewUncheckedCreateInput): Promise<void>;
  createBlock(input: Prisma.BlockUncheckedCreateInput): Promise<void>;
  createRowProperty(input: Prisma.DatabaseRowPropertyUncheckedCreateInput): Promise<void>;
  incrementCloneCount(pageId: string): Promise<void>;
  setWorkspaceRevision(workspaceId: string, revision: bigint): Promise<void>;
  awardCreatorKarma(creatorUserId: string): Promise<{ karmaScore: number }>;
}

export interface TemplateCloneRepository {
  transaction<T>(work: (transaction: TemplateCloneTransaction) => Promise<T>): Promise<T>;
}

export class TemplateCloneError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'TemplateCloneError';
  }
}

function remapValue(value: unknown, maps: readonly Map<string, string>[]): unknown {
  if (typeof value === 'string') {
    for (const map of maps) {
      const replacement = map.get(value);
      if (replacement !== undefined) return replacement;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => remapValue(entry, maps));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, remapValue(entry, maps)]),
    );
  }
  return value;
}

function requiredMappedId(map: Map<string, string>, sourceId: string): string {
  const mappedId = map.get(sourceId);
  if (mappedId === undefined) {
    throw new TemplateCloneError('A source identifier could not be remapped.', 409);
  }
  return mappedId;
}

function remapBlockContent(
  content: JsonObject,
  pageIdMap: Map<string, string>,
  propertyIdMap: Map<string, string>,
  blockIdMap: Map<string, string>,
): JsonObject {
  const remapped = remapValue(content, [pageIdMap, propertyIdMap, blockIdMap]);
  if (typeof remapped !== 'object' || remapped === null || Array.isArray(remapped)) {
    throw new TemplateCloneError('A source block has invalid JSON content.', 409);
  }
  const result = { ...toJsonObject(remapped) };
  for (const field of ['databasePageId', 'targetDatabaseId'] as const) {
    const sourceId = content[field];
    if (typeof sourceId === 'string' && !pageIdMap.has(sourceId)) result[field] = '';
  }
  const originalBlockId = content.originalBlockId;
  if (typeof originalBlockId === 'string' && !blockIdMap.has(originalBlockId)) {
    result.originalBlockId = '';
  }
  return result;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TemplateCloneError('A source row value is not valid JSON.', 409);
  }
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function remapExpression(expression: string, propertyIdMap: Map<string, string>): string {
  return expression.replace(/\{([A-Za-z0-9_-]+)\}/g, (match, propertyId: string) => {
    const mapped = propertyIdMap.get(propertyId);
    return mapped === undefined ? match : `{${mapped}}`;
  });
}

function parsePropertyConfig(value: Prisma.JsonValue): PropertyConfigPayload {
  const parsed = propertyConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new TemplateCloneError('A source database property has an invalid configuration.', 409);
  }
  return parsed.data;
}

function remapPropertyConfig(
  property: ClonePropertySource,
  pageIdMap: Map<string, string>,
  propertyIdMap: Map<string, string>,
  databasePageIds: Set<string>,
): { type: ClonePropertySource['type']; config: PropertyConfigPayload } {
  const config = parsePropertyConfig(property.config);
  if (property.type === 'RELATION' && config.kind === 'relation') {
    if (!databasePageIds.has(config.targetDatabaseId)) {
      return { type: 'TEXT', config: { kind: 'none' } };
    }
    const targetDatabaseId = pageIdMap.get(config.targetDatabaseId);
    if (targetDatabaseId === undefined) {
      return { type: 'TEXT', config: { kind: 'none' } };
    }
    return {
      type: property.type,
      config: {
        ...config,
        targetDatabaseId,
        ...(config.syncedPropertyId === undefined ||
        propertyIdMap.get(config.syncedPropertyId) === undefined
          ? {}
          : { syncedPropertyId: propertyIdMap.get(config.syncedPropertyId) }),
      },
    };
  }
  if (property.type === 'ROLLUP' && config.kind === 'rollup') {
    const relationPropertyId = propertyIdMap.get(config.relationPropertyId);
    const targetPropertyId = propertyIdMap.get(config.targetPropertyId);
    if (relationPropertyId === undefined || targetPropertyId === undefined) {
      return { type: 'TEXT', config: { kind: 'none' } };
    }
    return {
      type: property.type,
      config: { ...config, relationPropertyId, targetPropertyId },
    };
  }
  if (property.type === 'FORMULA' && config.kind === 'formula') {
    return {
      type: property.type,
      config: { ...config, expression: remapExpression(config.expression, propertyIdMap) },
    };
  }
  return { type: property.type, config };
}

function remapViewRules(
  filters: Prisma.JsonValue,
  sorts: Prisma.JsonValue,
  visibleProperties: Prisma.JsonValue,
  groupByPropertyId: string | null,
  propertyIdMap: Map<string, string>,
  pageIdMap: Map<string, string>,
): {
  filters: ViewFilterRule[];
  sorts: ViewSortRule[];
  visibleProperties: string[];
  groupByPropertyId: string | null;
} {
  const filterList = Array.isArray(filters) ? filters : [];
  const sortList = Array.isArray(sorts) ? sorts : [];
  const visibleList = Array.isArray(visibleProperties) ? visibleProperties : [];
  const mappedFilters = filterList.flatMap((rule) => {
    const parsed = viewFilterRuleSchema.safeParse(rule);
    if (!parsed.success) return [];
    const propertyId = propertyIdMap.get(parsed.data.propertyId);
    if (propertyId === undefined) return [];
    const value = parsed.data.value;
    const remappedValue =
      typeof value === 'string'
        ? pageIdMap.get(value) ?? value
        : Array.isArray(value)
          ? value.map((entry) => pageIdMap.get(entry) ?? entry)
          : value;
    return [{ ...parsed.data, propertyId, ...(remappedValue === undefined ? {} : { value: remappedValue }) }];
  });
  const mappedSorts = sortList.flatMap((rule) => {
    const parsed = viewSortRuleSchema.safeParse(rule);
    if (!parsed.success) return [];
    const propertyId = propertyIdMap.get(parsed.data.propertyId);
    return propertyId === undefined ? [] : [{ ...parsed.data, propertyId }];
  });
  const mappedVisible = visibleList.flatMap((propertyId) => {
    if (typeof propertyId !== 'string') return [];
    const mapped = propertyIdMap.get(propertyId);
    return mapped === undefined ? [] : [mapped];
  });
  return {
    filters: mappedFilters,
    sorts: mappedSorts,
    visibleProperties: mappedVisible,
    groupByPropertyId:
      groupByPropertyId === null ? null : propertyIdMap.get(groupByPropertyId) ?? null,
  };
}

export async function cloneTemplateTree(
  input: {
    sourcePageId: string;
    targetWorkspaceId: string;
    targetParentPageId?: string | null;
    userId: string;
    awardCreatorKarma?: boolean;
  },
  repository: TemplateCloneRepository = prismaTemplateCloneRepository,
  createId: () => string = () => crypto.randomUUID(),
): Promise<{
  pageId: string;
  clonedPageCount: number;
  serverRevision: string;
  karmaScore: number | null;
}> {
  return repository.transaction(async (transaction) => {
    const root = await transaction.findPage(input.sourcePageId);
    if (root === null || root.deletedAt !== null) {
      throw new TemplateCloneError('Template page was not found.', 404);
    }

    const pageSources: ClonePageSource[] = [root];
    let parents = [root.id];
    for (let depth = 1; depth <= MAX_PAGE_DEPTH && parents.length > 0; depth += 1) {
      const children = await transaction.findChildren(
        parents,
        root.workspaceId,
        false,
        input.userId,
      );
      if (children.length === 0) break;
      pageSources.push(...children);
      parents = children.map((page) => page.id);
    }
    if (parents.length > 0) {
      const beyondLimit = await transaction.findChildren(
        parents,
        root.workspaceId,
        false,
        input.userId,
      );
      if (beyondLimit.length > 0) {
        throw new TemplateCloneError('Template nesting exceeds the supported depth of 10.', 409);
      }
    }

    const workspaceRevision = await transaction.getWorkspaceRevision(input.targetWorkspaceId);
    if (workspaceRevision === null) {
      throw new TemplateCloneError('Destination workspace was not found.', 404);
    }
    if (input.targetParentPageId) {
      const targetParent = pageSources.find((page) => page.id === input.targetParentPageId);
      if (
        targetParent !== undefined ||
        (await transaction.findPage(input.targetParentPageId))?.workspaceId !== input.targetWorkspaceId
      ) {
        throw new TemplateCloneError('Destination parent must belong to the destination workspace.', 400);
      }
    }

    const pageIds = pageSources.map((page) => page.id);
    const databaseSources = pageSources.filter((page) => page.isDatabase);
    const databaseIds = databaseSources.map((page) => page.id);
    const [blocks, properties, views, rowProperties, lastOrderIndex] = await Promise.all([
      transaction.findBlocks(pageIds),
      transaction.findProperties(databaseIds),
      transaction.findViews(databaseIds),
      transaction.findRowProperties(pageIds),
      transaction.getLastOrderIndex(input.targetWorkspaceId, input.targetParentPageId ?? null),
    ]);

    const pageIdMap = new Map(pageSources.map((page) => [page.id, createId()]));
    const revision = workspaceRevision + BigInt(1);
    const now = new Date().toISOString();
    for (const source of pageSources) {
      const parentPageId =
        source.id === root.id
          ? (input.targetParentPageId ?? null)
          : pageIdMap.get(source.parentPageId ?? '') ?? null;
      const orderIndex =
        source.id === root.id
          ? generateKeyBetween(lastOrderIndex, null)
          : source.orderIndex;
      await transaction.createPage({
        id: requiredMappedId(pageIdMap, source.id),
        workspaceId: input.targetWorkspaceId,
        parentPageId,
        createdById: input.userId,
        title: source.title,
        icon: source.icon,
        coverUrl: source.coverUrl,
        fontFamily: source.fontFamily,
        isFullWidth: source.isFullWidth,
        orderIndex,
        isDatabase: source.isDatabase,
        isFavorite: false,
        isPrivate: source.isPrivate,
        isPublished: false,
        publicSlug: null,
        allowTemplateClone: false,
        cloneCount: 0,
        revision,
        fieldTimestamps: {
          title: now,
          parentPageId: now,
          orderIndex: now,
          isPublished: now,
        },
      });
    }

    const propertyIdMap = new Map(properties.map((property) => [property.id, createId()]));
    const databasePageIdSet = new Set(databaseIds);
    for (const property of properties) {
      const remapped = remapPropertyConfig(
        property,
        pageIdMap,
        propertyIdMap,
        databasePageIdSet,
      );
      await transaction.createProperty({
        id: requiredMappedId(propertyIdMap, property.id),
        databasePageId: requiredMappedId(pageIdMap, property.databasePageId),
        name: property.name,
        type: remapped.type,
        config: toJsonValue(remapped.config),
        orderIndex: property.orderIndex,
        revision,
        fieldTimestamps: { name: now, type: now, config: now },
      });
    }

    for (const view of views) {
      const remapped = remapViewRules(
        view.filters,
        view.sorts,
        view.visibleProperties,
        view.groupByPropertyId,
        propertyIdMap,
        pageIdMap,
      );
      await transaction.createView({
        id: createId(),
        databasePageId: requiredMappedId(pageIdMap, view.databasePageId),
        name: view.name,
        layout: view.layout,
        filters: toJsonValue(remapped.filters),
        sorts: toJsonValue(remapped.sorts),
        visibleProperties: toJsonValue(remapped.visibleProperties),
        groupByPropertyId: remapped.groupByPropertyId,
        orderIndex: view.orderIndex,
        revision,
        fieldTimestamps: { name: now, filters: now, sorts: now },
      });
    }

    const blockIdMap = new Map(blocks.map((block) => [block.id, createId()]));
    for (const block of blocks) {
      const content = toJsonObject(
        remapBlockContent(toJsonObject(block.content), pageIdMap, propertyIdMap, blockIdMap),
      );
      await transaction.createBlock({
        id: requiredMappedId(blockIdMap, block.id),
        pageId: requiredMappedId(pageIdMap, block.pageId),
        parentBlockId:
          block.parentBlockId === null
            ? null
            : blockIdMap.get(block.parentBlockId) ?? null,
        syncedSourceId:
          block.syncedSourceId === null
            ? null
            : blockIdMap.get(block.syncedSourceId) ?? null,
        type: block.type,
        content,
        orderIndex: block.orderIndex,
        revision,
        fieldTimestamps: { content: now, orderIndex: now },
      });
    }

    const sourcePropertyTypes = new Map(properties.map((property) => [property.id, property.type]));
    const sourceProperties = new Map(properties.map((property) => [property.id, property]));
    for (const rowProperty of rowProperties) {
      const newRowPageId = pageIdMap.get(rowProperty.rowPageId);
      const newPropertyId = propertyIdMap.get(rowProperty.propertyId);
      if (newRowPageId === undefined || newPropertyId === undefined) continue;

      const sourceType = sourcePropertyTypes.get(rowProperty.propertyId);
      const sourceConfig = sourceProperties.get(rowProperty.propertyId);
      const remappedConfig =
        sourceConfig === undefined
          ? null
          : remapPropertyConfig(sourceConfig, pageIdMap, propertyIdMap, databasePageIdSet);
      let value: unknown = rowProperty.value;
      if (sourceType === 'RELATION' && remappedConfig?.type === 'TEXT') {
        value = typeof value === 'string' ? value : JSON.stringify(value);
      } else if (sourceType === 'RELATION') {
        value = remapValue(value, [pageIdMap]);
      }
      const jsonValue = value === null ? Prisma.JsonNull : toJsonValue(value);
      await transaction.createRowProperty({
        rowPageId: newRowPageId,
        propertyId: newPropertyId,
        value: jsonValue,
        revision,
        fieldTimestamps: { value: now },
      });
    }

    await transaction.incrementCloneCount(root.id);
    await transaction.setWorkspaceRevision(input.targetWorkspaceId, revision);
    const karma = input.awardCreatorKarma
      ? await transaction.awardCreatorKarma(root.createdById)
      : null;
    const clonedRootId = pageIdMap.get(root.id);
    if (clonedRootId === undefined) {
      throw new TemplateCloneError('The cloned template root could not be resolved.', 409);
    }

    return {
      pageId: clonedRootId,
      clonedPageCount: pageSources.length,
      serverRevision: revision.toString(10),
      karmaScore: karma?.karmaScore ?? null,
    };
  });
}

const prismaTemplateCloneRepository: TemplateCloneRepository = {
  transaction: <T>(work: (transaction: TemplateCloneTransaction) => Promise<T>) =>
    prisma.$transaction(
      async (transaction) =>
        work({
          findPage: (pageId) =>
            transaction.page.findUnique({ where: { id: pageId } }),
          findChildren: (parentPageIds, workspaceId, includePrivate, userId) =>
            transaction.page.findMany({
              where: {
                workspaceId,
                parentPageId: { in: parentPageIds },
                deletedAt: null,
                ...(includePrivate ? {} : { isPrivate: false }),
                ...(includePrivate ? { OR: [{ isPrivate: false }, { createdById: userId }] } : {}),
              },
              orderBy: [{ parentPageId: 'asc' }, { orderIndex: 'asc' }],
            }),
          findBlocks: (pageIds) =>
            transaction.block.findMany({
              where: { pageId: { in: pageIds }, deletedAt: null },
              orderBy: [{ pageId: 'asc' }, { orderIndex: 'asc' }],
            }),
          findProperties: (databasePageIds) =>
            transaction.databaseProperty.findMany({
              where: { databasePageId: { in: databasePageIds } },
              orderBy: [{ databasePageId: 'asc' }, { orderIndex: 'asc' }],
            }),
          findViews: (databasePageIds) =>
            transaction.databaseView.findMany({
              where: { databasePageId: { in: databasePageIds } },
              orderBy: [{ databasePageId: 'asc' }, { orderIndex: 'asc' }],
            }),
          findRowProperties: (rowPageIds) =>
            transaction.databaseRowProperty.findMany({
              where: { rowPageId: { in: rowPageIds } },
            }),
          getWorkspaceRevision: async (workspaceId) =>
            (
              await transaction.workspace.findUnique({
                where: { id: workspaceId },
                select: { serverRevision: true },
              })
            )?.serverRevision ?? null,
          getLastOrderIndex: async (workspaceId, parentPageId) =>
            (
              await transaction.page.findFirst({
                where: { workspaceId, parentPageId, deletedAt: null },
                orderBy: { orderIndex: 'desc' },
                select: { orderIndex: true },
              })
            )?.orderIndex ?? null,
          createPage: async (data) => {
            await transaction.page.create({ data });
          },
          createProperty: async (data) => {
            await transaction.databaseProperty.create({ data });
          },
          createView: async (data) => {
            await transaction.databaseView.create({ data });
          },
          createBlock: async (data) => {
            await transaction.block.create({ data });
          },
          createRowProperty: async (data) => {
            await transaction.databaseRowProperty.create({ data });
          },
          incrementCloneCount: async (pageId) => {
            await transaction.page.update({
              where: { id: pageId },
              data: { cloneCount: { increment: 1 } },
            });
          },
          setWorkspaceRevision: async (workspaceId, revision) => {
            await transaction.workspace.update({
              where: { id: workspaceId },
              data: { serverRevision: revision },
            });
          },
          awardCreatorKarma: (creatorUserId) =>
            awardTemplateCreatorKarmaInTransaction(
              creatorUserId,
              createPrismaGamificationTransaction(transaction),
            ),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
};
