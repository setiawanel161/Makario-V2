import { PropertyType, ViewLayout } from '@prisma/client';
import { z } from 'zod';
import type { PropertyConfigPayload, ViewFilterRule, ViewSortRule } from '@/types/workspace';

const optionColorSchema = z.enum([
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
]);

const selectOptionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  color: optionColorSchema,
});

export const propertyConfigSchema: z.ZodType<PropertyConfigPayload> = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('none') }),
    z.object({
      kind: z.literal('number'),
      format: z.enum(['number', 'currency_usd', 'currency_idr', 'percent']),
    }),
    z.object({ kind: z.literal('select'), options: z.array(selectOptionSchema).max(100) }),
    z.object({
      kind: z.literal('status'),
      options: z.array(selectOptionSchema).max(100),
      groups: z.object({
        todo: z.array(z.string()),
        inProgress: z.array(z.string()),
        done: z.array(z.string()),
      }),
    }),
    z.object({
      kind: z.literal('relation'),
      targetDatabaseId: z.string().min(1),
      syncedPropertyId: z.string().min(1).optional(),
    }),
    z.object({
      kind: z.literal('rollup'),
      relationPropertyId: z.string().min(1),
      targetPropertyId: z.string().min(1),
      aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'PERCENT_CHECKED']),
    }),
    z.object({ kind: z.literal('formula'), expression: z.string().trim().min(1).max(500) }),
  ],
);

const propertyTypeSchema = z.nativeEnum(PropertyType);
const viewLayoutSchema = z.nativeEnum(ViewLayout);

export const viewFilterRuleSchema: z.ZodType<ViewFilterRule> = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'is_empty',
    'is_not_empty',
    'gt',
    'lt',
  ]),
  value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string())]).optional(),
});

export const viewSortRuleSchema: z.ZodType<ViewSortRule> = z.object({
  propertyId: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

export const createPropertySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: propertyTypeSchema,
    config: propertyConfigSchema.optional(),
  })
  .superRefine((property, context) => {
    if (property.config && !configMatchesType(property.type, property.config)) {
      context.addIssue({
        code: 'custom',
        path: ['config'],
        message: 'Property configuration does not match its type.',
      });
    }
  });

export const updatePropertySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100).optional(),
    type: propertyTypeSchema.optional(),
    config: propertyConfigSchema.optional(),
    orderIndex: z.string().min(1).max(64).optional(),
  })
  .refine(
    (property) =>
      property.name !== undefined ||
      property.type !== undefined ||
      property.config !== undefined ||
      property.orderIndex !== undefined,
    'At least one property field must be provided.',
  )
  .superRefine((property, context) => {
    if (
      property.type !== undefined &&
      property.config !== undefined &&
      !configMatchesType(property.type, property.config)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['config'],
        message: 'Property configuration does not match its type.',
      });
    }
  });

export const deletePropertySchema = z.object({ id: z.string().min(1) });

export const createViewSchema = z.object({
  name: z.string().trim().min(1).max(100),
  layout: viewLayoutSchema,
  filters: z.array(viewFilterRuleSchema).max(100).default([]),
  sorts: z.array(viewSortRuleSchema).max(100).default([]),
  visibleProperties: z.array(z.string().min(1)).max(100).default([]),
  groupByPropertyId: z.string().min(1).nullable().default(null),
});

export const updateViewSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100).optional(),
    layout: viewLayoutSchema.optional(),
    filters: z.array(viewFilterRuleSchema).max(100).optional(),
    sorts: z.array(viewSortRuleSchema).max(100).optional(),
    visibleProperties: z.array(z.string().min(1)).max(100).optional(),
    groupByPropertyId: z.string().min(1).nullable().optional(),
    orderIndex: z.string().min(1).max(64).optional(),
  })
  .refine((view) => Object.keys(view).some((key) => key !== 'id'), {
    message: 'At least one view field must be provided.',
  });

export const deleteViewSchema = z.object({ id: z.string().min(1) });

export function configMatchesType(
  type: PropertyType,
  config: PropertyConfigPayload,
): boolean {
  switch (type) {
    case 'NUMBER':
      return config.kind === 'number';
    case 'SELECT':
    case 'MULTI_SELECT':
      return config.kind === 'select';
    case 'STATUS':
      return config.kind === 'status';
    case 'RELATION':
      return config.kind === 'relation';
    case 'ROLLUP':
      return config.kind === 'rollup';
    case 'FORMULA':
      return config.kind === 'formula';
    case 'TEXT':
    case 'DATE':
    case 'PERSON':
    case 'CHECKBOX':
    case 'URL':
      return config.kind === 'none';
  }
}

export function defaultPropertyConfig(type: PropertyType): PropertyConfigPayload {
  switch (type) {
    case 'NUMBER':
      return { kind: 'number', format: 'number' };
    case 'SELECT':
    case 'MULTI_SELECT':
      return { kind: 'select', options: [] };
    case 'STATUS':
      return {
        kind: 'status',
        options: [],
        groups: { todo: [], inProgress: [], done: [] },
      };
    case 'RELATION':
      return { kind: 'relation', targetDatabaseId: '' };
    case 'ROLLUP':
      return {
        kind: 'rollup',
        relationPropertyId: '',
        targetPropertyId: '',
        aggregation: 'COUNT',
      };
    case 'FORMULA':
      return { kind: 'formula', expression: '0' };
    case 'TEXT':
    case 'DATE':
    case 'PERSON':
    case 'CHECKBOX':
    case 'URL':
      return { kind: 'none' };
  }
}
