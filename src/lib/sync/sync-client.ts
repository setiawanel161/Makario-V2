import { z } from 'zod';
import type { JsonObject, JsonValue } from '@/types/workspace';
import { workspaceDb, type LocalEntityRecord, type SyncEntityType } from './dexie-db';
import { reconcileFieldLevelLww, type VersionedRecord } from './sync-engine';
import { useWorkspaceStore } from './workspace-store';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
const pullResponseSchema = z.object({
  serverRevision: z.string().regex(/^\d+$/),
  pages: z.array(jsonObjectSchema),
  blocks: z.array(jsonObjectSchema),
  properties: z.array(jsonObjectSchema),
  rowProperties: z.array(jsonObjectSchema),
  views: z.array(jsonObjectSchema),
});

const metadataFields = new Set([
  'id',
  'workspaceId',
  'updatedAt',
  'revision',
  'fieldTimestamps',
  'createdAt',
]);

interface ServerEntity extends JsonObject {
  id: string;
  updatedAt: string;
}

function fieldClocks(entity: JsonObject): Record<string, string> {
  const clocks = entity.fieldTimestamps;
  if (typeof clocks !== 'object' || clocks === null || Array.isArray(clocks)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(clocks).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function versionedFields(entity: JsonObject): VersionedRecord {
  const clocks = fieldClocks(entity);
  const updatedAt = typeof entity.updatedAt === 'string' ? entity.updatedAt : '';
  return Object.fromEntries(
    Object.entries(entity)
      .filter(([field]) => !metadataFields.has(field))
      .map(([field, value]) => [
        field,
        { value, updatedAt: clocks[field] ?? updatedAt },
      ]),
  );
}

function mergeLocalAndRemote(
  local: LocalEntityRecord | undefined,
  remote: ServerEntity,
  workspaceId: string,
): LocalEntityRecord {
  const remoteEntity = { ...remote, workspaceId };
  if (local === undefined) {
    return remoteEntity;
  }

  const mergedFields = reconcileFieldLevelLww(versionedFields(local), versionedFields(remoteEntity));
  const clocks = Object.fromEntries(
    Object.entries(mergedFields).map(([field, versioned]) => [field, versioned.updatedAt]),
  );
  const merged: JsonObject = {
    ...local,
    ...remoteEntity,
    ...Object.fromEntries(Object.entries(mergedFields).map(([field, versioned]) => [field, versioned.value])),
    updatedAt:
      Date.parse(local.updatedAt) > Date.parse(remoteEntity.updatedAt)
        ? local.updatedAt
        : remoteEntity.updatedAt,
    fieldTimestamps: clocks,
  };
  return {
    ...merged,
    id: remote.id,
    workspaceId,
    updatedAt:
      Date.parse(local.updatedAt) > Date.parse(remoteEntity.updatedAt)
        ? local.updatedAt
        : remoteEntity.updatedAt,
  };
}

const entityTables: Array<{
  entityType: SyncEntityType;
  table: (typeof workspaceDb.pages);
}> = [
  { entityType: 'page', table: workspaceDb.pages },
  { entityType: 'block', table: workspaceDb.blocks },
  { entityType: 'property', table: workspaceDb.properties },
  { entityType: 'rowProperty', table: workspaceDb.rowProperties },
  { entityType: 'view', table: workspaceDb.views },
];

export async function pullWorkspaceDelta(
  workspaceId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const metadata = await workspaceDb.syncMetadata.get(workspaceId);
  const sinceRevision = metadata?.serverRevision ?? '0';
  const response = await fetcher(
    `/api/sync/pull?workspaceId=${encodeURIComponent(workspaceId)}&sinceRevision=${sinceRevision}`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    throw new Error(`Sync pull failed with HTTP ${response.status}.`);
  }

  const parsed = pullResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Sync pull returned an invalid delta payload.');
  }

  const delta = parsed.data;
  const hydrated: Array<{ entityType: SyncEntityType; entity: LocalEntityRecord }> = [];
  await workspaceDb.transaction(
    'rw',
    [
      workspaceDb.pages,
      workspaceDb.blocks,
      workspaceDb.properties,
      workspaceDb.rowProperties,
      workspaceDb.views,
      workspaceDb.syncMetadata,
    ],
    async () => {
      for (const { entityType, table } of entityTables) {
        const remoteRecords =
          entityType === 'page'
            ? delta.pages
            : entityType === 'block'
              ? delta.blocks
              : entityType === 'property'
                ? delta.properties
                : entityType === 'rowProperty'
                  ? delta.rowProperties
                  : delta.views;
        for (const remote of remoteRecords) {
          if (typeof remote.id !== 'string' || typeof remote.updatedAt !== 'string') {
            throw new Error(`Sync pull returned an invalid ${entityType} record.`);
          }
          const local = await table.get(remote.id);
          const serverEntity: ServerEntity = {
            ...remote,
            id: remote.id,
            updatedAt: remote.updatedAt,
          };
          const merged = mergeLocalAndRemote(local, serverEntity, workspaceId);
          await table.put(merged);
          hydrated.push({ entityType, entity: merged });
        }
      }
      await workspaceDb.syncMetadata.put({ workspaceId, serverRevision: delta.serverRevision });
    },
  );
  for (const record of hydrated) {
    useWorkspaceStore.getState().hydrateEntity(record.entityType, record.entity);
  }
  return delta.serverRevision;
}
