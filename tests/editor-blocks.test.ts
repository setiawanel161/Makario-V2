import { BlockType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { blockContentPayloadSchema } from '../src/lib/editor/block-content-schema';
import {
  compareBlockOrder,
  contentWithText,
  defaultBlockContent,
  markdownBlockShortcut,
  reorderBlocks,
  type EditorBlock,
} from '../src/components/editor/editor-utils';

function block(id: string, type: BlockType, orderIndex: string): EditorBlock {
  return {
    id,
    type,
    content: defaultBlockContent(type),
    parentBlockId: null,
    orderIndex,
    revision: '1',
  };
}

describe('block editor helpers', () => {
  it('creates valid default payloads for all block types', () => {
    for (const type of Object.values(BlockType)) {
      expect(blockContentPayloadSchema.safeParse(defaultBlockContent(type)).success).toBe(true);
    }
  });

  it('recognizes Markdown shortcuts and preserves ordinary text', () => {
    expect(markdownBlockShortcut('# ')).toEqual({ type: 'HEADING_1', text: '' });
    expect(markdownBlockShortcut('[] ')).toEqual({ type: 'TODO', text: '' });
    expect(markdownBlockShortcut('``` ')).toEqual({ type: 'CODE', text: '' });
    expect(markdownBlockShortcut('a heading')).toBeNull();
    expect(contentWithText('TODO', defaultBlockContent('TODO'), 'Ship this')).toMatchObject({
      kind: 'todo',
      spans: [{ text: 'Ship this' }],
      checked: false,
    });
  });

  it('reorders blocks using a fractional key between the new neighbors', () => {
    const original = [
      block('first', 'PARAGRAPH', 'a0'),
      block('second', 'PARAGRAPH', 'a2'),
      block('third', 'PARAGRAPH', 'a3'),
    ];
    const result = reorderBlocks(original, 'third', 'second');
    const sorted = [...result.blocks].sort(compareBlockOrder);

    expect(sorted.map((item) => item.id)).toEqual(['first', 'third', 'second']);
    expect(result.changed).toEqual([{ id: 'third', orderIndex: expect.any(String) }]);
    expect(sorted[0]!.orderIndex < sorted[1]!.orderIndex).toBe(true);
    expect(sorted[1]!.orderIndex < sorted[2]!.orderIndex).toBe(true);
  });
});
