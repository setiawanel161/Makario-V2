import { z } from 'zod';
import type { BlockType } from '@prisma/client';
import type { BlockContentPayload, JsonObject, JsonValue, RichTextSpan } from '@/types/workspace';

const richTextSpanSchema: z.ZodType<RichTextSpan> = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  code: z.boolean().optional(),
  color: z.string().optional(),
  href: z.string().optional(),
  mentionPageId: z.string().optional(),
  mentionUserId: z.string().optional(),
});
const spansSchema = z.array(richTextSpanSchema);

export const blockContentPayloadSchema: z.ZodType<BlockContentPayload> = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('text'), spans: spansSchema }),
    z.object({ kind: z.literal('todo'), spans: spansSchema, checked: z.boolean() }),
    z.object({ kind: z.literal('toggle'), spans: spansSchema, isOpen: z.boolean() }),
    z.object({
      kind: z.literal('callout'),
      spans: spansSchema,
      icon: z.string(),
      bgColor: z.string().optional(),
    }),
    z.object({ kind: z.literal('code'), code: z.string(), language: z.string() }),
    z.object({ kind: z.literal('divider') }),
    z.object({
      kind: z.literal('image'),
      url: z.string(),
      caption: z.string().optional(),
      widthPercent: z.number().min(1).max(100).optional(),
    }),
    z.object({ kind: z.literal('layout') }),
    z.object({ kind: z.literal('child_database'), databasePageId: z.string() }),
    z.object({
      kind: z.literal('chart'),
      databasePageId: z.string(),
      chartType: z.enum(['BAR', 'LINE', 'DONUT']),
      groupByPropertyId: z.string(),
      metric: z.enum(['COUNT', 'SUM', 'AVG']),
      metricPropertyId: z.string().optional(),
    }),
    z.object({ kind: z.literal('synced'), originalBlockId: z.string() }),
  ],
);

export function blockContentMatchesType(type: BlockType, content: unknown): boolean {
  const parsed = blockContentPayloadSchema.safeParse(content);
  if (!parsed.success) return false;
  const kind = parsed.data.kind;
  switch (type) {
    case 'PARAGRAPH':
    case 'HEADING_1':
    case 'HEADING_2':
    case 'HEADING_3':
    case 'BULLETED_LIST':
    case 'NUMBERED_LIST':
    case 'QUOTE':
      return kind === 'text';
    case 'TODO':
      return kind === 'todo';
    case 'TOGGLE':
      return kind === 'toggle';
    case 'CALLOUT':
      return kind === 'callout';
    case 'CODE':
      return kind === 'code';
    case 'DIVIDER':
      return kind === 'divider';
    case 'IMAGE':
      return kind === 'image';
    case 'COLUMN_LIST':
    case 'COLUMN':
      return kind === 'layout';
    case 'CHILD_DATABASE':
      return kind === 'child_database';
    case 'CHART_BLOCK':
      return kind === 'chart';
    case 'SYNCED_BLOCK':
      return kind === 'synced';
  }
}

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
const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

export function toJsonObject(value: unknown): JsonObject {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Block content must be serializable JSON.');
  }
  const decoded: unknown = JSON.parse(serialized);
  const parsed = jsonObjectSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new TypeError('Block content must be a JSON object.');
  }
  return parsed.data;
}
