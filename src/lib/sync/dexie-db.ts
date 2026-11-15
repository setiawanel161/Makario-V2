import Dexie, { type Table } from 'dexie';
import type { JsonValue } from '@/types/workspace';

export type SyncEntityType = 'page' | 'block' | 'property' | 'rowProperty' | 'view';

export interface LocalEntityRecord {
  [key: string]: JsonValue;
  id: string;
  workspaceId: string;
  updatedAt: string;
}

export interface OutboxMutation {
  seq?: number;
  idempotencyKey: string;
  workspaceId: string;
  entityType: SyncEntityType;
  entityId: string;
  changes: Record<string, JsonValue>;
  createdAt: string;
}

export class WorkspaceDatabase extends Dexie {
  pages!: Table<LocalEntityRecord, string>;
  blocks!: Table<LocalEntityRecord, string>;
  properties!: Table<LocalEntityRecord, string>;
  rowProperties!: Table<LocalEntityRecord, string>;
  views!: Table<LocalEntityRecord, string>;
  outbox!: Table<OutboxMutation, number>;

  constructor(name = 'makario-workspace') {
    super(name);

    this.version(1).stores({
      pages: '&id, workspaceId, parentPageId, isDatabase, updatedAt',
      blocks: '&id, pageId, parentBlockId, orderIndex',
      properties: '&id, databasePageId, orderIndex',
      rowProperties: '&id, rowPageId, propertyId, &[rowPageId+propertyId]',
      views: '&id, databasePageId, orderIndex',
      outbox: '++seq, &idempotencyKey, workspaceId, entityType, entityId, createdAt',
    });
  }

  entityTable(entityType: SyncEntityType): Table<LocalEntityRecord, string> {
    switch (entityType) {
      case 'page':
        return this.pages;
      case 'block':
        return this.blocks;
      case 'property':
        return this.properties;
      case 'rowProperty':
        return this.rowProperties;
      case 'view':
        return this.views;
    }
  }
}

export const workspaceDb = new WorkspaceDatabase();
