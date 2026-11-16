import type { PropertyType, ViewLayout } from '@prisma/client';
import type { JsonValue, PropertyConfigPayload, ViewFilterRule, ViewSortRule } from '@/types/workspace';

export interface DatabasePropertyData {
  id: string;
  name: string;
  type: PropertyType;
  config: PropertyConfigPayload;
  orderIndex: string;
  revision: string;
}

export interface DatabaseViewData {
  id: string;
  name: string;
  layout: ViewLayout;
  filters: ViewFilterRule[];
  sorts: ViewSortRule[];
  visibleProperties: string[];
  groupByPropertyId: string | null;
  orderIndex: string;
  revision: string;
}

export interface DatabaseRowData {
  id: string;
  title: string;
  icon: string | null;
  coverUrl?: string | null;
  orderIndex: string;
  revision: string;
  properties: Record<string, JsonValue>;
  propertyValueIds: Record<string, string>;
}

export interface DatabaseData {
  properties: DatabasePropertyData[];
  views: DatabaseViewData[];
  rows: DatabaseRowData[];
}
