import { arrayMove } from '@dnd-kit/sortable';
import type { BlockType } from '@prisma/client';
import { generateKeyBetweenWithNormalization } from '@/lib/fractional-index';
import type { BlockContentPayload, RichTextSpan } from '@/types/workspace';

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: BlockContentPayload;
  parentBlockId: string | null;
  orderIndex: string;
  revision: string;
}

export function compareBlockOrder(left: EditorBlock, right: EditorBlock): number {
  return left.orderIndex < right.orderIndex ? -1 : left.orderIndex > right.orderIndex ? 1 : 0;
}

export function getBlockText(content: BlockContentPayload): string {
  if ('spans' in content) return content.spans.map((span) => span.text).join('');
  if (content.kind === 'code') return content.code;
  if (content.kind === 'image') return content.caption ?? content.url;
  if (content.kind === 'child_database' || content.kind === 'chart') {
    return content.databasePageId;
  }
  if (content.kind === 'synced') return content.originalBlockId;
  return '';
}

export function contentWithText(
  type: BlockType,
  previous: BlockContentPayload,
  text: string,
): BlockContentPayload {
  const spans: RichTextSpan[] = text.length === 0 ? [] : [{ text }];
  switch (type) {
    case 'TODO':
      return {
        kind: 'todo',
        spans,
        checked: previous.kind === 'todo' ? previous.checked : false,
      };
    case 'TOGGLE':
      return {
        kind: 'toggle',
        spans,
        isOpen: previous.kind === 'toggle' ? previous.isOpen : true,
      };
    case 'CALLOUT':
      return {
        kind: 'callout',
        spans,
        icon: previous.kind === 'callout' ? previous.icon : '💡',
        ...(previous.kind === 'callout' && previous.bgColor !== undefined
          ? { bgColor: previous.bgColor }
          : {}),
      };
    case 'CODE':
      return {
        kind: 'code',
        code: text,
        language: previous.kind === 'code' ? previous.language : 'plain',
      };
    case 'IMAGE':
      return previous.kind === 'image'
        ? { ...previous, caption: text }
        : { kind: 'image', url: '', caption: text };
    case 'DIVIDER':
      return { kind: 'divider' };
    case 'COLUMN_LIST':
    case 'COLUMN':
      return { kind: 'layout' };
    case 'CHILD_DATABASE':
      return {
        kind: 'child_database',
        databasePageId: text || (previous.kind === 'child_database' ? previous.databasePageId : ''),
      };
    case 'CHART_BLOCK':
      return {
        kind: 'chart',
        databasePageId: text || (previous.kind === 'chart' ? previous.databasePageId : ''),
        chartType: previous.kind === 'chart' ? previous.chartType : 'BAR',
        groupByPropertyId: previous.kind === 'chart' ? previous.groupByPropertyId : '',
        metric: previous.kind === 'chart' ? previous.metric : 'COUNT',
        ...(previous.kind === 'chart' && previous.metricPropertyId !== undefined
          ? { metricPropertyId: previous.metricPropertyId }
          : {}),
      };
    case 'SYNCED_BLOCK':
      return {
        kind: 'synced',
        originalBlockId: text || (previous.kind === 'synced' ? previous.originalBlockId : ''),
      };
    default:
      return { kind: 'text', spans };
  }
}

export function defaultBlockContent(type: BlockType): BlockContentPayload {
  return contentWithText(type, { kind: 'text', spans: [] }, '');
}

export function markdownBlockShortcut(
  value: string,
): { type: BlockType; text: string } | null {
  const shortcuts: Array<[RegExp, BlockType]> = [
    [/^###\s$/, 'HEADING_3'],
    [/^##\s$/, 'HEADING_2'],
    [/^#\s$/, 'HEADING_1'],
    [/^-\s$/, 'BULLETED_LIST'],
    [/^1\.\s$/, 'NUMBERED_LIST'],
    [/^\[\]\s$/, 'TODO'],
    [/^>\s$/, 'QUOTE'],
    [/^```\s$/, 'CODE'],
  ];
  for (const [pattern, type] of shortcuts) {
    if (pattern.test(value)) return { type, text: '' };
  }
  return null;
}

export function reorderBlocks(
  blocks: readonly EditorBlock[],
  activeId: string,
  overId: string,
): { blocks: EditorBlock[]; changed: Array<{ id: string; orderIndex: string }> } {
  const from = blocks.findIndex((block) => block.id === activeId);
  const to = blocks.findIndex((block) => block.id === overId);
  if (from < 0 || to < 0 || from === to) {
    return { blocks: [...blocks], changed: [] };
  }

  const reordered = arrayMove([...blocks], from, to);
  const moved = reordered[to];
  const previous = reordered[to - 1];
  const next = reordered[to + 1];
  const generated = generateKeyBetweenWithNormalization(
    previous?.orderIndex ?? null,
    next?.orderIndex ?? null,
    reordered.map(({ id, orderIndex }) => ({ id, orderIndex })),
  );
  const changed: Array<{ id: string; orderIndex: string }> = [];
  const nextBlocks = reordered.map((block) => {
    const normalized = generated.normalized
      ? generated.siblings.find((sibling) => sibling.id === block.id)?.orderIndex
      : undefined;
    const orderIndex = block.id === moved.id ? generated.key : normalized ?? block.orderIndex;
    if (orderIndex !== block.orderIndex) changed.push({ id: block.id, orderIndex });
    return { ...block, orderIndex };
  });
  return { blocks: nextBlocks, changed };
}
