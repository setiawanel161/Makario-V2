'use client';

import { create } from 'zustand';
import type { JsonObject } from '@/types/workspace';
import { type LocalEntityRecord, type SyncEntityType, workspaceDb } from './dexie-db';
import { createMutation, pushSyncBatch, SyncEngine } from './sync-engine';

export type EntityKey = `${SyncEntityType}:${string}`;

export interface WorkspaceStoreState {
  entities: Record<EntityKey, JsonObject>;
  applyOptimisticMutation: (input: {
    workspaceId: string;
    entityType: SyncEntityType;
    entityId: string;
    changes: JsonObject;
    updatedAt?: string;
  }) => void;
  hydrateEntity: (entityType: SyncEntityType, entity: LocalEntityRecord) => void;
}

interface WorkspaceStoreOptions {
  engine?: SyncEngine;
  createId?: () => string;
  onError?: (error: unknown) => void;
}

function entityKey(entityType: SyncEntityType, entityId: string): EntityKey {
  return `${entityType}:${entityId}`;
}

export function createWorkspaceStore(options: WorkspaceStoreOptions = {}) {
  const engine =
    options.engine ??
    new SyncEngine({
      transport: pushSyncBatch,
      onError: options.onError,
    });
  const createId = options.createId ?? (() => crypto.randomUUID());
  const onError = options.onError ?? ((error: unknown) => console.error('Local mutation failed:', error));
  engine.start();

  return create<WorkspaceStoreState>()((set, get) => ({
    entities: {},
    hydrateEntity: (entityType, entity) => {
      set((state) => ({
        entities: {
          ...state.entities,
          [entityKey(entityType, entity.id)]: entity,
        },
      }));
    },
    applyOptimisticMutation: (input) => {
      const updatedAt = input.updatedAt ?? new Date().toISOString();
      const key = entityKey(input.entityType, input.entityId);
      const previous = get().entities[key] ?? {};
      const entity: LocalEntityRecord = {
        ...previous,
        ...input.changes,
        id: input.entityId,
        workspaceId: input.workspaceId,
        updatedAt,
      };
      const mutation = createMutation({
        idempotencyKey: createId(),
        workspaceId: input.workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: input.changes,
        createdAt: updatedAt,
      });

      set((state) => ({
        entities: {
          ...state.entities,
          [key]: entity,
        },
      }));

      void engine.persistOptimisticMutation(mutation, entity).catch(onError);
    },
  }));
}

export const useWorkspaceStore = createWorkspaceStore();

export const workspaceStoreDatabase = workspaceDb;
