import type { BlockType, BuilderTier, PropertyType, ViewLayout } from '@prisma/client';

export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
  href?: string;
  mentionPageId?: string;
  mentionUserId?: string;
}

export type BlockContentPayload =
  | { kind: 'text'; spans: RichTextSpan[] }
  | { kind: 'todo'; spans: RichTextSpan[]; checked: boolean }
  | { kind: 'toggle'; spans: RichTextSpan[]; isOpen: boolean }
  | { kind: 'callout'; spans: RichTextSpan[]; icon: string; bgColor?: string }
  | { kind: 'code'; code: string; language: string }
  | { kind: 'divider' }
  | { kind: 'image'; url: string; caption?: string; widthPercent?: number }
  | { kind: 'layout' }
  | { kind: 'child_database'; databasePageId: string }
  | {
      kind: 'chart';
      databasePageId: string;
      chartType: 'BAR' | 'LINE' | 'DONUT';
      groupByPropertyId: string;
      metric: 'COUNT' | 'SUM' | 'AVG';
      metricPropertyId?: string;
    }
  | { kind: 'synced'; originalBlockId: string };

export interface SelectOption {
  id: string;
  label: string;
  color: 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

export type PropertyConfigPayload =
  | { kind: 'none' }
  | { kind: 'number'; format: 'number' | 'currency_usd' | 'currency_idr' | 'percent' }
  | { kind: 'select'; options: SelectOption[] }
  | {
      kind: 'status';
      options: SelectOption[];
      groups: { todo: string[]; inProgress: string[]; done: string[] };
    }
  | { kind: 'relation'; targetDatabaseId: string; syncedPropertyId?: string }
  | {
      kind: 'rollup';
      relationPropertyId: string;
      targetPropertyId: string;
      aggregation: 'COUNT' | 'SUM' | 'AVG' | 'PERCENT_CHECKED';
    }
  | { kind: 'formula'; expression: string };

export interface ViewFilterRule {
  id: string;
  propertyId: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'is_empty'
    | 'is_not_empty'
    | 'gt'
    | 'lt';
  value?: string | number | boolean | string[];
}

export interface ViewSortRule {
  propertyId: string;
  direction: 'asc' | 'desc';
}

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  serverRevision: string;
  updatedAt: string;
}

export interface PageDto {
  id: string;
  workspaceId: string;
  parentPageId: string | null;
  title: string;
  orderIndex: string;
  isDatabase: boolean;
  isFavorite: boolean;
  isPrivate: boolean;
  revision: string;
  updatedAt: string;
}

export interface BlockDto {
  id: string;
  pageId: string;
  parentBlockId: string | null;
  type: BlockType;
  content: BlockContentPayload;
  orderIndex: string;
  revision: string;
  updatedAt: string;
}

export interface DatabasePropertyDto {
  id: string;
  databasePageId: string;
  name: string;
  type: PropertyType;
  config: PropertyConfigPayload;
  orderIndex: string;
  updatedAt: string;
}

export interface DatabaseRowPropertyDto {
  id: string;
  rowPageId: string;
  propertyId: string;
  value: JsonValue;
  updatedAt: string;
}

export interface DatabaseViewDto {
  id: string;
  databasePageId: string;
  name: string;
  layout: ViewLayout;
  filters: ViewFilterRule[];
  sorts: ViewSortRule[];
  visibleProperties: string[];
  groupByPropertyId: string | null;
  orderIndex: string;
  updatedAt: string;
}

export type BuilderTierDto = BuilderTier;

export function serializeRevision(revision: bigint): string {
  return revision.toString(10);
}
