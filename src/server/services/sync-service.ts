import { BlockType, Prisma, type PlanTier } from '@prisma/client';
import { generateKeyBetween } from '@/lib/fractional-index';
import { blockContentMatchesType } from '@/lib/editor/block-content-schema';
import type { SyncMutationType } from '@/types/sync';
import type { JsonObject, JsonValue } from '@/types/workspace';
import { prisma } from '@/server/db/prisma';
import type { ParsedSyncMutation } from '@/server/validators/sync';
import {
  awardXpInTransaction,
  createPrismaGamificationTransaction,
  type AwardXpInput,
  type AwardXpResult,
  type XpActionType,
} from './gamify-engine';

export const FREE_BLOCK_LIMIT = 1000;

export class SyncBatchError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413,
    readonly code: string,
  ) {
    super(message);
    this.name = 'SyncBatchError';
  }
}

export interface SyncRecordSnapshot {
  id: string;
  workspaceId: string;
  fields: JsonObject;
  revision: bigint;
  fieldTimestamps: JsonObject;
  deletedAt: Date | null;
  pageId?: string;
  parentBlockId?: string | null;
}

export interface SyncPageFields {
  title?: string;
  parentPageId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
  fontFamily?: string;
  isFullWidth?: boolean;
  orderIndex?: string;
  isDatabase?: boolean;
  isFavorite?: boolean;
  isPrivate?: boolean;
}

export interface SyncBlockFields {
  type?: BlockType;
  content?: JsonObject;
  parentBlockId?: string | null;
  orderIndex?: string;
}

export interface SyncTransaction {
  getWorkspace(workspaceId: string): Promise<{ planTier: PlanTier; serverRevision: bigint } | null>;
  setServerRevision(workspaceId: string, revision: bigint): Promise<void>;
  getReceipt(idempotencyKey: string): Promise<{
    workspaceId: string;
    userId: string;
    mutationType: string;
    entityId: string;
  } | null>;
  createReceipt(input: {
    idempotencyKey: string;
    workspaceId: string;
    userId: string;
    mutationType: string;
    entityId: string;
  }): Promise<void>;
  countActiveBlocks(workspaceId: string): Promise<number>;
  getLastPageOrderIndex(workspaceId: string, parentPageId: string | null): Promise<string | null>;
  findPage(pageId: string, workspaceId: string, userId: string): Promise<SyncRecordSnapshot | null>;
  createPage(input: {
    id: string;
    workspaceId: string;
    createdById: string;
    fields: SyncPageFields & { title: string; orderIndex: string };
    revision: bigint;
    fieldTimestamps: JsonObject;
  }): Promise<void>;
  updatePage(input: {
    id: string;
    workspaceId: string;
    fields: SyncPageFields;
    revision: bigint;
    fieldTimestamps: JsonObject;
    deletedAt?: Date | null;
  }): Promise<void>;
  findBlock(blockId: string, workspaceId: string, userId: string): Promise<SyncRecordSnapshot | null>;
  createBlock(input: {
    id: string;
    workspaceId: string;
    pageId: string;
    userId: string;
    fields: SyncBlockFields & { type: BlockType; content: JsonObject; orderIndex: string };
    revision: bigint;
    fieldTimestamps: JsonObject;
  }): Promise<void>;
  updateBlock(input: {
    id: string;
    workspaceId: string;
    fields: SyncBlockFields;
    revision: bigint;
    fieldTimestamps: JsonObject;
    deletedAt?: Date | null;
  }): Promise<void>;
  isDatabaseRowPropertyInWorkspace(
    rowPageId: string,
    propertyId: string,
    workspaceId: string,
    userId: string,
  ): Promise<boolean>;
  findRowProperty(
    rowPageId: string,
    propertyId: string,
    workspaceId: string,
    userId: string,
  ): Promise<SyncRecordSnapshot | null>;
  upsertRowProperty(input: {
    rowPageId: string;
    propertyId: string;
    workspaceId: string;
    entityId: string;
    value: JsonValue;
    revision: bigint;
    fieldTimestamps: JsonObject;
  }): Promise<void>;
  awardXp(input: AwardXpInput): Promise<AwardXpResult>;
}

export interface SyncRepository {
  transaction<T>(work: (transaction: SyncTransaction) => Promise<T>): Promise<T>;
}

function toJsonValue(value: Prisma.JsonValue): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Stored JSON contains a non-finite number.');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }
  const result: JsonObject = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue !== undefined) {
      result[key] = toJsonValue(nestedValue);
    }
  }
  return result;
}

function toJsonObject(value: Prisma.JsonValue): JsonObject {
  const result = toJsonValue(value);
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new TypeError('Stored JSON object has an invalid shape.');
  }
  return result;
}

function serializePageRecord(page: {
  id: string;
  workspaceId: string;
  title: string;
  parentPageId: string | null;
  icon: string | null;
  coverUrl: string | null;
  fontFamily: string;
  isFullWidth: boolean;
  orderIndex: string;
  isDatabase: boolean;
  isFavorite: boolean;
  isPrivate: boolean;
  revision: bigint;
  fieldTimestamps: Prisma.JsonValue;
  deletedAt: Date | null;
}): SyncRecordSnapshot {
  return {
    id: page.id,
    workspaceId: page.workspaceId,
    fields: {
      title: page.title,
      parentPageId: page.parentPageId,
      icon: page.icon,
      coverUrl: page.coverUrl,
      fontFamily: page.fontFamily,
      isFullWidth: page.isFullWidth,
      orderIndex: page.orderIndex,
      isDatabase: page.isDatabase,
      isFavorite: page.isFavorite,
      isPrivate: page.isPrivate,
    },
    revision: page.revision,
    fieldTimestamps: toJsonObject(page.fieldTimestamps),
    deletedAt: page.deletedAt,
  };
}

function serializeBlockRecord(block: {
  id: string;
  pageId: string;
  type: BlockType;
  content: Prisma.JsonValue;
  parentBlockId: string | null;
  orderIndex: string;
  revision: bigint;
  fieldTimestamps: Prisma.JsonValue;
  deletedAt: Date | null;
  page: { workspaceId: string };
}): SyncRecordSnapshot {
  return {
    id: block.id,
    workspaceId: block.page.workspaceId,
    pageId: block.pageId,
    parentBlockId: block.parentBlockId,
    fields: {
      type: block.type,
      content: toJsonObject(block.content),
      parentBlockId: block.parentBlockId,
      orderIndex: block.orderIndex,
    },
    revision: block.revision,
    fieldTimestamps: toJsonObject(block.fieldTimestamps),
    deletedAt: block.deletedAt,
  };
}

function pageFieldsFromJson(fields: JsonObject): SyncPageFields {
  const result: SyncPageFields = {};
  if (typeof fields.title === 'string') result.title = fields.title;
  if (fields.parentPageId === null || typeof fields.parentPageId === 'string') {
    result.parentPageId = fields.parentPageId;
  }
  if (fields.icon === null || typeof fields.icon === 'string') result.icon = fields.icon;
  if (fields.coverUrl === null || typeof fields.coverUrl === 'string') {
    result.coverUrl = fields.coverUrl;
  }
  if (typeof fields.fontFamily === 'string') result.fontFamily = fields.fontFamily;
  if (typeof fields.isFullWidth === 'boolean') result.isFullWidth = fields.isFullWidth;
  if (typeof fields.orderIndex === 'string') result.orderIndex = fields.orderIndex;
  if (typeof fields.isDatabase === 'boolean') result.isDatabase = fields.isDatabase;
  if (typeof fields.isFavorite === 'boolean') result.isFavorite = fields.isFavorite;
  if (typeof fields.isPrivate === 'boolean') result.isPrivate = fields.isPrivate;
  return result;
}

function blockFieldsFromJson(fields: JsonObject): SyncBlockFields {
  const result: SyncBlockFields = {};
  if (isBlockType(fields.type)) {
    result.type = fields.type;
  }
  if (fields.content !== undefined) {
    if (typeof fields.content !== 'object' || fields.content === null || Array.isArray(fields.content)) {
      throw new SyncBatchError('Block content must be a JSON object.', 400, 'INVALID_CONTENT');
    }
    result.content = fields.content;
  }
  if (fields.parentBlockId === null || typeof fields.parentBlockId === 'string') {
    result.parentBlockId = fields.parentBlockId;
  }
  if (typeof fields.orderIndex === 'string') result.orderIndex = fields.orderIndex;
  return result;
}

function isBlockType(value: JsonValue | undefined): value is BlockType {
  return typeof value === 'string' && Object.values(BlockType).some((type) => type === value);
}

function dateMillis(value: JsonValue | undefined, fieldName: string): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new TypeError(`The stored LWW timestamp for ${fieldName} is invalid.`);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`The stored LWW timestamp for ${fieldName} is invalid.`);
  }
  return parsed;
}

function mergeFields(
  current: JsonObject,
  currentTimestamps: JsonObject,
  changes: JsonObject,
  incomingTimestamps: Record<string, string> | undefined,
  fallbackTimestamp: string,
  now: Date,
): { fields: JsonObject; timestamps: JsonObject; changed: boolean } {
  const fields: JsonObject = { ...current };
  const timestamps: JsonObject = { ...currentTimestamps };
  let changed = false;

  for (const [key, value] of Object.entries(changes)) {
    const incomingTimestamp = incomingTimestamps?.[key] ?? fallbackTimestamp;
    const incomingMillis = Date.parse(incomingTimestamp);
    if (Number.isNaN(incomingMillis)) {
      throw new SyncBatchError('A field timestamp is invalid.', 400, 'INVALID_FIELD_TIMESTAMP');
    }
    if (incomingMillis > now.getTime() + 5 * 60_000) {
      throw new SyncBatchError(
        'Field timestamps cannot be more than five minutes in the future.',
        400,
        'FIELD_TIMESTAMP_IN_FUTURE',
      );
    }

    const currentMillis = dateMillis(timestamps[key], key);
    if (currentMillis === null || incomingMillis >= currentMillis) {
      fields[key] = value;
      timestamps[key] = new Date(incomingMillis).toISOString();
      changed = true;
    }
  }
  return { fields, timestamps, changed };
}

function isCompleteTodo(type: JsonValue | undefined, content: JsonValue | undefined): boolean {
  if (type !== 'TODO' || typeof content !== 'object' || content === null || Array.isArray(content)) {
    return false;
  }
  return content.kind === 'todo' && content.checked === true;
}

function emptyPageFields(changes: Record<string, unknown>): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) {
      if (
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        value === null ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        result[key] = value;
      } else {
        throw new SyncBatchError(`Page field "${key}" is invalid.`, 400, 'INVALID_PAGE_FIELD');
      }
    }
  }
  return result;
}

function blockCreationFields(
  changes: Extract<ParsedSyncMutation, { type: 'CREATE_BLOCK' }>['changes'],
): JsonObject {
  return {
    type: changes.type,
    content: changes.content,
    parentBlockId: changes.parentBlockId ?? null,
    orderIndex: changes.orderIndex,
  };
}

function pageCreationFields(
  changes: Extract<ParsedSyncMutation, { type: 'CREATE_PAGE' }>['changes'],
  orderIndex: string,
): JsonObject {
  return emptyPageFields({
    ...changes,
    title: changes.title ?? 'Untitled',
    parentPageId: changes.parentPageId ?? null,
    orderIndex: changes.orderIndex ?? orderIndex,
    isDatabase: changes.isDatabase ?? false,
  });
}

function blockUpdateFields(
  changes: Extract<ParsedSyncMutation, { type: 'UPDATE_BLOCK' }>['changes'],
): JsonObject {
  const result: JsonObject = {};
  if (changes.type !== undefined) result.type = changes.type;
  if (changes.content !== undefined) result.content = changes.content;
  return result;
}

function requirePageCreationFields(
  fields: SyncPageFields,
): asserts fields is SyncPageFields & { title: string; orderIndex: string } {
  if (fields.title === undefined || fields.orderIndex === undefined) {
    throw new SyncBatchError('A page title and order key are required.', 400, 'INVALID_PAGE');
  }
}

function requireBlockCreationFields(
  fields: SyncBlockFields,
): asserts fields is SyncBlockFields & { type: BlockType; content: JsonObject; orderIndex: string } {
  if (fields.type === undefined || fields.content === undefined || fields.orderIndex === undefined) {
    throw new SyncBatchError('A block type, content, and order key are required.', 400, 'INVALID_BLOCK');
  }
}

function assertBlockContentType(type: BlockType, content: JsonObject): void {
  if (!blockContentMatchesType(type, content)) {
    throw new SyncBatchError(
      `Block content does not match the ${type} block type.`,
      400,
      'INVALID_BLOCK_CONTENT',
    );
  }
}

function statusAward(actionType: XpActionType, referenceId: string): { actionType: XpActionType; referenceId: string } {
  return { actionType, referenceId };
}

const prismaSyncRepository: SyncRepository = {
  transaction: (work) =>
    prisma.$transaction(async (client) => {
      const gamification = createPrismaGamificationTransaction(client);
      const transaction: SyncTransaction = {
        getWorkspace: async (workspaceId) =>
          client.workspace.findUnique({
            where: { id: workspaceId },
            select: { planTier: true, serverRevision: true },
          }),
        setServerRevision: async (workspaceId, revision) => {
          await client.workspace.update({
            where: { id: workspaceId },
            data: { serverRevision: revision },
          });
        },
        getReceipt: async (idempotencyKey) =>
          client.syncMutationReceipt.findUnique({
            where: { idempotencyKey },
            select: { workspaceId: true, userId: true, mutationType: true, entityId: true },
          }),
        createReceipt: async (receipt) => {
          await client.syncMutationReceipt.create({ data: receipt });
        },
        countActiveBlocks: (workspaceId) =>
          client.block.count({
            where: { deletedAt: null, page: { workspaceId, deletedAt: null } },
          }),
        getLastPageOrderIndex: async (workspaceId, parentPageId) => {
          const page = await client.page.findFirst({
            where: { workspaceId, parentPageId, deletedAt: null },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
          });
          return page?.orderIndex ?? null;
        },
        findPage: async (pageId, workspaceId, userId) => {
          const page = await client.page.findFirst({
            where: {
              id: pageId,
              workspaceId,
              OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
            },
            select: {
              id: true,
              workspaceId: true,
              title: true,
              parentPageId: true,
              icon: true,
              coverUrl: true,
              fontFamily: true,
              isFullWidth: true,
              orderIndex: true,
              isDatabase: true,
              isFavorite: true,
              isPrivate: true,
              revision: true,
              fieldTimestamps: true,
              deletedAt: true,
            },
          });
          return page === null ? null : serializePageRecord(page);
        },
        createPage: async ({ id, workspaceId, createdById, fields, revision, fieldTimestamps }) => {
          await client.page.create({
            data: {
              id,
              workspaceId,
              createdById,
              ...fields,
              revision,
              fieldTimestamps,
            },
          });
        },
        updatePage: async ({ id, workspaceId, fields, revision, fieldTimestamps, deletedAt }) => {
          await client.page.updateMany({
            where: { id, workspaceId },
            data: { ...fields, revision, fieldTimestamps, ...(deletedAt === undefined ? {} : { deletedAt }) },
          });
        },
        findBlock: async (blockId, workspaceId, userId) => {
          const block = await client.block.findFirst({
            where: {
              id: blockId,
              page: {
                workspaceId,
                deletedAt: null,
                OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
              },
            },
            select: {
              id: true,
              pageId: true,
              type: true,
              content: true,
              parentBlockId: true,
              orderIndex: true,
              revision: true,
              fieldTimestamps: true,
              deletedAt: true,
              page: { select: { workspaceId: true } },
            },
          });
          return block === null ? null : serializeBlockRecord(block);
        },
        createBlock: async ({
          id,
          workspaceId,
          userId,
          pageId,
          fields,
          revision,
          fieldTimestamps,
        }) => {
          const page = await client.page.findFirst({
            where: {
              id: pageId,
              workspaceId,
              deletedAt: null,
              OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
            },
            select: { id: true },
          });
          if (page === null) {
            throw new SyncBatchError('The target page is outside this workspace.', 404, 'PAGE_NOT_FOUND');
          }
          await client.block.create({
            data: { id, pageId, ...fields, revision, fieldTimestamps },
          });
        },
        updateBlock: async ({ id, workspaceId, fields, revision, fieldTimestamps, deletedAt }) => {
          const result = await client.block.updateMany({
            where: { id, page: { workspaceId } },
            data: { ...fields, revision, fieldTimestamps, ...(deletedAt === undefined ? {} : { deletedAt }) },
          });
          if (result.count !== 1) {
            throw new SyncBatchError('The block is outside this workspace.', 404, 'BLOCK_NOT_FOUND');
          }
        },
        isDatabaseRowPropertyInWorkspace: async (rowPageId, propertyId, workspaceId, userId) => {
          const property = await client.databaseProperty.findFirst({
            where: {
              id: propertyId,
              databasePage: {
                workspaceId,
                isDatabase: true,
                deletedAt: null,
                OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
                childPages: {
                  some: {
                    id: rowPageId,
                    deletedAt: null,
                    OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
                  },
                },
              },
            },
            select: { id: true },
          });
          return property !== null;
        },
        findRowProperty: async (rowPageId, propertyId, workspaceId, userId) => {
          const rowProperty = await client.databaseRowProperty.findFirst({
            where: {
              rowPageId,
              propertyId,
              rowPage: {
                workspaceId,
                deletedAt: null,
                OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
              },
              property: {
                databasePage: {
                  workspaceId,
                  OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
                },
              },
            },
            select: {
              id: true,
              value: true,
              revision: true,
              fieldTimestamps: true,
              rowPage: { select: { workspaceId: true } },
            },
          });
          if (rowProperty === null) return null;
          return {
            id: rowProperty.id,
            workspaceId: rowProperty.rowPage.workspaceId,
            fields: { value: toJsonValue(rowProperty.value) },
            revision: rowProperty.revision,
            fieldTimestamps: toJsonObject(rowProperty.fieldTimestamps),
            deletedAt: null,
          };
        },
        upsertRowProperty: async ({
          rowPageId,
          propertyId,
          entityId,
          value,
          revision,
          fieldTimestamps,
        }) => {
          const jsonValue = value === null ? Prisma.JsonNull : value;
          await client.databaseRowProperty.upsert({
            where: { rowPageId_propertyId: { rowPageId, propertyId } },
            create: {
              id: entityId,
              rowPageId,
              propertyId,
              value: jsonValue,
              revision,
              fieldTimestamps,
            },
            update: { value: jsonValue, revision, fieldTimestamps },
          });
        },
        awardXp: (input) => awardXpInTransaction(input, gamification),
      };
      return work(transaction);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
};

function jsonFieldClocks(
  changes: JsonObject,
  incoming: Record<string, string> | undefined,
  fallbackTimestamp: string,
): JsonObject {
  const result: JsonObject = {};
  for (const field of Object.keys(changes)) {
    result[field] = incoming?.[field] ?? fallbackTimestamp;
  }
  return result;
}

function assertWorkspaceParent(
  parent: SyncRecordSnapshot | null,
  workspaceId: string,
  entityLabel: string,
): asserts parent is SyncRecordSnapshot {
  if (parent === null || parent.workspaceId !== workspaceId || parent.deletedAt !== null) {
    throw new SyncBatchError(`${entityLabel} was not found in this workspace.`, 404, 'PARENT_NOT_FOUND');
  }
}

async function validateBlockParent(
  transaction: SyncTransaction,
  parentBlockId: string | null,
  workspaceId: string,
  userId: string,
  pageId: string,
  movingBlockId?: string,
): Promise<void> {
  let parentId = parentBlockId;
  const visited = new Set<string>();
  while (parentId !== null) {
    if (parentId === movingBlockId || visited.has(parentId)) {
      throw new SyncBatchError('Block nesting cannot contain a cycle.', 400, 'BLOCK_CYCLE');
    }
    visited.add(parentId);
    const parent = await transaction.findBlock(parentId, workspaceId, userId);
    if (parent === null || parent.pageId !== pageId || parent.deletedAt !== null) {
      throw new SyncBatchError('The parent block is not available in this page.', 404, 'PARENT_BLOCK_NOT_FOUND');
    }
    parentId = parent.parentBlockId ?? null;
  }
}

export async function processSyncBatch(
  input: {
    userId: string;
    workspaceId: string;
    mutations: readonly ParsedSyncMutation[];
  },
  repository: SyncRepository = prismaSyncRepository,
  now: () => Date = () => new Date(),
): Promise<{
  acknowledged: string[];
  serverRevision: string;
  awardedXp: Array<{ actionType: XpActionType; xpDelta: number; referenceId: string }>;
}> {
  if (input.mutations.some((mutation) => mutation.workspaceId !== input.workspaceId)) {
    throw new SyncBatchError('A batch may only contain mutations for one workspace.', 400, 'MIXED_WORKSPACES');
  }

  return repository.transaction(async (transaction) => {
    const workspace = await transaction.getWorkspace(input.workspaceId);
    if (workspace === null) {
      throw new SyncBatchError('Workspace was not found.', 404, 'WORKSPACE_NOT_FOUND');
    }
    let serverRevision = workspace.serverRevision;
    let activeBlockCount =
      workspace.planTier === 'FREE' ? await transaction.countActiveBlocks(input.workspaceId) : 0;
    const acknowledged: string[] = [];
    const awardedXp: Array<{ actionType: XpActionType; xpDelta: number; referenceId: string }> = [];

    for (const mutation of input.mutations) {
      const receipt = await transaction.getReceipt(mutation.idempotencyKey);
      if (receipt !== null) {
        if (
          receipt.workspaceId !== input.workspaceId ||
          receipt.userId !== input.userId ||
          receipt.mutationType !== mutation.type ||
          receipt.entityId !== mutation.entityId
        ) {
          throw new SyncBatchError(
            'An idempotency key was already used for a different mutation.',
            409,
            'IDEMPOTENCY_KEY_CONFLICT',
          );
        }
        acknowledged.push(mutation.idempotencyKey);
        continue;
      }

      const mutationTime = now();
      const nextRevision = serverRevision + BigInt(1);
      let changed = false;
      let reward: { actionType: XpActionType; referenceId: string } | null = null;

      switch (mutation.type) {
        case 'CREATE_PAGE': {
          const existingPage = await transaction.findPage(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (existingPage !== null) {
            throw new SyncBatchError('The page ID already exists.', 409, 'ENTITY_ID_CONFLICT');
          }
          const rawChanges = mutation.changes;
          const parentPageId =
            rawChanges.parentPageId === null || typeof rawChanges.parentPageId === 'string'
              ? rawChanges.parentPageId
              : null;
          if (parentPageId !== null) {
            assertWorkspaceParent(
              await transaction.findPage(parentPageId, input.workspaceId, input.userId),
              input.workspaceId,
              'Parent page',
            );
          }
          const lastOrder = await transaction.getLastPageOrderIndex(input.workspaceId, parentPageId);
          const fields = pageCreationFields(
            rawChanges,
            generateKeyBetween(lastOrder, null),
          );
          const typedFields = pageFieldsFromJson(fields);
          requirePageCreationFields(typedFields);
          const initialTimes = jsonFieldClocks(fields, mutation.fieldTimestamps, mutation.createdAt);
          await transaction.createPage({
            id: mutation.entityId,
            workspaceId: input.workspaceId,
            createdById: input.userId,
            fields: typedFields,
            revision: nextRevision,
            fieldTimestamps: initialTimes,
          });
          changed = true;
          reward = {
            actionType: fields.isDatabase === true ? 'CREATE_DATABASE' : 'CREATE_PAGE',
            referenceId: mutation.entityId,
          };
          break;
        }
        case 'UPDATE_PAGE': {
          const page = await transaction.findPage(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (page === null || page.deletedAt !== null) {
            throw new SyncBatchError('The page was not found in this workspace.', 404, 'PAGE_NOT_FOUND');
          }
          const changes = emptyPageFields(mutation.changes);
          const merged = mergeFields(
            page.fields,
            page.fieldTimestamps,
            changes,
            mutation.fieldTimestamps,
            mutation.createdAt,
            mutationTime,
          );
          if (merged.changed) {
            if (
              Object.hasOwn(changes, 'parentPageId') &&
              typeof merged.fields.parentPageId === 'string'
            ) {
              let parent = await transaction.findPage(
                merged.fields.parentPageId,
                input.workspaceId,
                input.userId,
              );
              assertWorkspaceParent(parent, input.workspaceId, 'Parent page');
              while (parent !== null) {
                if (parent.id === page.id || parent.deletedAt !== null) {
                  throw new SyncBatchError(
                    'Page nesting cannot contain a cycle or a deleted parent.',
                    400,
                    'PAGE_CYCLE',
                  );
                }
                const nextParentId: JsonValue | undefined = parent.fields.parentPageId;
                parent =
                  typeof nextParentId === 'string'
                    ? await transaction.findPage(nextParentId, input.workspaceId, input.userId)
                    : null;
              }
            }
            await transaction.updatePage({
              id: page.id,
              workspaceId: input.workspaceId,
              fields: pageFieldsFromJson(merged.fields),
              revision: nextRevision,
              fieldTimestamps: merged.timestamps,
            });
            changed = true;
          }
          break;
        }
        case 'DELETE_PAGE': {
          const page = await transaction.findPage(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (page === null) {
            throw new SyncBatchError('The page was not found in this workspace.', 404, 'PAGE_NOT_FOUND');
          }
          if (page.deletedAt === null) {
            const merged = mergeFields(
              {},
              page.fieldTimestamps,
              { deletedAt: mutation.createdAt },
              mutation.fieldTimestamps,
              mutation.createdAt,
              mutationTime,
            );
            if (merged.changed) {
              await transaction.updatePage({
                id: page.id,
                workspaceId: input.workspaceId,
                fields: {},
                revision: nextRevision,
                fieldTimestamps: merged.timestamps,
                deletedAt: new Date(mutation.createdAt),
              });
              changed = true;
            }
          }
          break;
        }
        case 'CREATE_BLOCK': {
          const existingBlock = await transaction.findBlock(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (existingBlock !== null) {
            throw new SyncBatchError('The block ID already exists.', 409, 'ENTITY_ID_CONFLICT');
          }
          const page = await transaction.findPage(
            String(mutation.changes.pageId),
            input.workspaceId,
            input.userId,
          );
          assertWorkspaceParent(page, input.workspaceId, 'Page');
          await validateBlockParent(
            transaction,
            mutation.changes.parentBlockId ?? null,
            input.workspaceId,
            input.userId,
            page.id,
          );
          if (workspace.planTier === 'FREE' && activeBlockCount >= FREE_BLOCK_LIMIT) {
            throw new SyncBatchError(
              `Free workspaces are limited to ${FREE_BLOCK_LIMIT} active blocks.`,
              413,
              'FREE_BLOCK_LIMIT',
            );
          }
          const fields = blockCreationFields(mutation.changes);
          const typedFields = blockFieldsFromJson(fields);
          requireBlockCreationFields(typedFields);
          assertBlockContentType(typedFields.type, typedFields.content);
          await transaction.createBlock({
            id: mutation.entityId,
            workspaceId: input.workspaceId,
            userId: input.userId,
            pageId: page.id,
            fields: typedFields,
            revision: nextRevision,
            fieldTimestamps: jsonFieldClocks(fields, mutation.fieldTimestamps, mutation.createdAt),
          });
          activeBlockCount += 1;
          changed = true;
          if (isCompleteTodo(fields.type, fields.content)) {
            reward = { actionType: 'COMPLETE_TODO', referenceId: mutation.entityId };
          }
          break;
        }
        case 'UPDATE_BLOCK': {
          const block = await transaction.findBlock(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (block === null || block.deletedAt !== null) {
            throw new SyncBatchError('The block was not found in this workspace.', 404, 'BLOCK_NOT_FOUND');
          }
          const changes = blockUpdateFields(mutation.changes);
          const merged = mergeFields(
            block.fields,
            block.fieldTimestamps,
            changes,
            mutation.fieldTimestamps,
            mutation.createdAt,
            mutationTime,
          );
          if (merged.changed) {
            const nextFields = blockFieldsFromJson(merged.fields);
            const nextType = nextFields.type ?? block.fields.type;
            const nextContent = nextFields.content ?? block.fields.content;
            if (!isBlockType(nextType) || typeof nextContent !== 'object' || nextContent === null || Array.isArray(nextContent)) {
              throw new SyncBatchError('Block content or type is invalid.', 400, 'INVALID_BLOCK_CONTENT');
            }
            assertBlockContentType(nextType, nextContent);
            await transaction.updateBlock({
              id: block.id,
              workspaceId: input.workspaceId,
              fields: nextFields,
              revision: nextRevision,
              fieldTimestamps: merged.timestamps,
            });
            changed = true;
            if (
              !isCompleteTodo(block.fields.type, block.fields.content) &&
              isCompleteTodo(merged.fields.type, merged.fields.content)
            ) {
              reward = { actionType: 'COMPLETE_TODO', referenceId: block.id };
            }
          }
          break;
        }
        case 'MOVE_BLOCK': {
          const block = await transaction.findBlock(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (block === null || block.deletedAt !== null) {
            throw new SyncBatchError('The block was not found in this workspace.', 404, 'BLOCK_NOT_FOUND');
          }
          const parentBlockId = mutation.changes.parentBlockId;
          await validateBlockParent(
            transaction,
            parentBlockId,
            input.workspaceId,
            input.userId,
            block.pageId ?? '',
            block.id,
          );
          const changes: JsonObject = {
            parentBlockId,
            orderIndex: mutation.changes.orderIndex,
          };
          const merged = mergeFields(
            block.fields,
            block.fieldTimestamps,
            changes,
            mutation.fieldTimestamps,
            mutation.createdAt,
            mutationTime,
          );
          if (merged.changed) {
            await transaction.updateBlock({
              id: block.id,
              workspaceId: input.workspaceId,
              fields: blockFieldsFromJson(merged.fields),
              revision: nextRevision,
              fieldTimestamps: merged.timestamps,
            });
            changed = true;
          }
          break;
        }
        case 'DELETE_BLOCK': {
          const block = await transaction.findBlock(
            mutation.entityId,
            input.workspaceId,
            input.userId,
          );
          if (block === null) {
            throw new SyncBatchError('The block was not found in this workspace.', 404, 'BLOCK_NOT_FOUND');
          }
          if (block.deletedAt === null) {
            const merged = mergeFields(
              {},
              block.fieldTimestamps,
              { deletedAt: mutation.createdAt },
              mutation.fieldTimestamps,
              mutation.createdAt,
              mutationTime,
            );
            if (merged.changed) {
              await transaction.updateBlock({
                id: block.id,
                workspaceId: input.workspaceId,
                fields: {},
                revision: nextRevision,
                fieldTimestamps: merged.timestamps,
                deletedAt: new Date(mutation.createdAt),
              });
              activeBlockCount = Math.max(0, activeBlockCount - 1);
              changed = true;
            }
          }
          break;
        }
        case 'UPSERT_ROW_PROP': {
          const { rowPageId, propertyId, value } = mutation.changes;
          if (
            !(await transaction.isDatabaseRowPropertyInWorkspace(
              rowPageId,
              propertyId,
              input.workspaceId,
              input.userId,
            ))
          ) {
            throw new SyncBatchError(
              'The row property is not available in this workspace.',
              404,
              'ROW_PROPERTY_NOT_FOUND',
            );
          }
          const property = await transaction.findRowProperty(
            rowPageId,
            propertyId,
            input.workspaceId,
            input.userId,
          );
          const merged = mergeFields(
            property?.fields ?? {},
            property?.fieldTimestamps ?? {},
            { value },
            mutation.fieldTimestamps,
            mutation.createdAt,
            mutationTime,
          );
          if (merged.changed) {
            await transaction.upsertRowProperty({
              rowPageId,
              propertyId,
              workspaceId: input.workspaceId,
              entityId: mutation.entityId,
              value: merged.fields.value,
              revision: nextRevision,
              fieldTimestamps: merged.timestamps,
            });
            changed = true;
          }
          break;
        }
      }

      if (changed) {
        serverRevision = nextRevision;
        await transaction.setServerRevision(input.workspaceId, serverRevision);
      }
      await transaction.createReceipt({
        idempotencyKey: mutation.idempotencyKey,
        workspaceId: input.workspaceId,
        userId: input.userId,
        mutationType: mutation.type satisfies SyncMutationType,
        entityId: mutation.entityId,
      });
      acknowledged.push(mutation.idempotencyKey);

      if (reward !== null) {
        const result = await transaction.awardXp({
          userId: input.userId,
          workspaceId: input.workspaceId,
          actionType: reward.actionType,
          referenceId: reward.referenceId,
        });
        if (result.status === 'awarded') {
          awardedXp.push({ ...statusAward(reward.actionType, reward.referenceId), xpDelta: result.xpDelta });
        }
      }
    }

    return {
      acknowledged,
      serverRevision: serverRevision.toString(10),
      awardedXp,
    };
  });
}
