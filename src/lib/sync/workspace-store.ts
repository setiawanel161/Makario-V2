'use client';

import { create } from 'zustand';
import type { SyncMutationType } from '@/types/sync';
import type { JsonObject } from '@/types/workspace';
import { type LocalEntityRecord, type SyncEntityType, workspaceDb } from './dexie-db';
import {
  createMutation,
  pushSyncBatch,
  SyncEngine,
  type SyncTransportResult,
} from './sync-engine';

export type EntityKey = `${SyncEntityType}:${string}`;

export interface WorkspaceStoreState {
  entities: Record<EntityKey, JsonObject>;
  applyOptimisticMutation: (input: {
    workspaceId: string;
    entityType: SyncEntityType;
    entityId: string;
    changes: JsonObject;
    type?: SyncMutationType;
    fieldTimestamps?: Record<string, string>;
    updatedAt?: string;
  }) => void;
  hydrateEntity: (entityType: SyncEntityType, entity: LocalEntityRecord) => void;
}

interface WorkspaceStoreOptions {
  engine?: SyncEngine;
  createId?: () => string;
  onError?: (error: unknown) => void;
  onXpAwarded?: (awards: SyncTransportResult['awardedXp']) => void;
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
      onXpAwarded:
        options.onXpAwarded ??
        ((awards) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('makario:xp-awarded', { detail: awards }));
          }
        }),
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
        fieldTimestamps: {
          ...(typeof previous.fieldTimestamps === 'object' &&
          previous.fieldTimestamps !== null &&
          !Array.isArray(previous.fieldTimestamps)
            ? previous.fieldTimestamps
            : {}),
          ...Object.fromEntries(
            Object.keys(input.changes).map((field) => [
              field,
              input.fieldTimestamps?.[field] ?? updatedAt,
            ]),
          ),
        },
      };
      const mutation = createMutation({
        idempotencyKey: createId(),
        workspaceId: input.workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: input.changes,
        type: input.type,
        fieldTimestamps: input.fieldTimestamps,
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
