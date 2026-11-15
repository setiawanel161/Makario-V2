'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { BlockType } from '@prisma/client';
import { generateKeyBetweenWithNormalization } from '@/lib/fractional-index';
import { useWorkspaceStore } from '@/lib/sync/workspace-store';
import type { JsonObject } from '@/types/workspace';
import { toJsonObject } from '@/lib/editor/block-content-schema';
import {
  contentWithText,
  compareBlockOrder,
  defaultBlockContent,
  getBlockText,
  markdownBlockShortcut,
  reorderBlocks,
  type EditorBlock,
} from './editor-utils';
import { BlockRenderer, type SlashMenuState } from './block-renderer';
import { SLASH_COMMANDS } from './slash-command-menu';

function commandCount(query: string): number {
  const normalized = query.trim().toLowerCase();
  return SLASH_COMMANDS.filter((command) =>
    `${command.label} ${command.description}`.toLowerCase().includes(normalized),
  ).length;
}

export function BlockEditor({
  workspaceId,
  pageId,
  initialBlocks,
}: {
  workspaceId: string;
  pageId: string;
  initialBlocks: EditorBlock[];
}): React.JSX.Element {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const store = useWorkspaceStore;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const orderedBlocks = useMemo(
    () => [...blocks].sort(compareBlockOrder),
    [blocks],
  );

  useEffect(() => {
    const updatedAt = new Date().toISOString();
    for (const block of initialBlocks) {
      store.getState().hydrateEntity('block', {
        ...block,
        workspaceId,
        content: toJsonObject(block.content),
        updatedAt,
      });
    }
  }, [initialBlocks, store, workspaceId]);

  const persistChanges = useCallback(
    (
      block: EditorBlock,
      changes: JsonObject,
      type: 'UPDATE_BLOCK' | 'MOVE_BLOCK' = 'UPDATE_BLOCK',
    ) => {
      const updatedAt = new Date().toISOString();
      store.getState().applyOptimisticMutation({
        workspaceId,
        entityType: 'block',
        entityId: block.id,
        changes,
        type,
        updatedAt,
      });
    },
    [store, workspaceId],
  );

  const updateBlock = useCallback(
    (blockId: string, type: BlockType, content: EditorBlock['content']) => {
      const current = blocks.find((block) => block.id === blockId);
      if (current === undefined) return;
      const changes: JsonObject = {
        type,
        content: toJsonObject(content),
      };
      setBlocks((previous) =>
        previous.map((block) =>
          block.id === blockId ? { ...block, type, content } : block,
        ),
      );
      persistChanges(current, changes);
    },
    [blocks, persistChanges],
  );

  const changeText = useCallback(
    (blockId: string, text: string) => {
      const block = blocks.find((item) => item.id === blockId);
      if (block === undefined) return;
      const shortcut = markdownBlockShortcut(text);
      const type = shortcut?.type ?? block.type;
      const nextText = shortcut?.text ?? text;
      updateBlock(blockId, type, contentWithText(type, block.content, nextText));
    },
    [blocks, updateBlock],
  );

  const createBlockAfter = useCallback(
    (afterId: string | null, type: BlockType = 'PARAGRAPH', initialText = '') => {
      const siblings = blocks
        .filter((block) => block.parentBlockId === (afterId === null
          ? null
          : blocks.find((item) => item.id === afterId)?.parentBlockId ?? null))
        .sort(compareBlockOrder);
      const anchorIndex = afterId === null ? -1 : siblings.findIndex((block) => block.id === afterId);
      const previous = anchorIndex < 0 ? null : siblings[anchorIndex];
      const next = anchorIndex < 0 ? siblings[0] : siblings[anchorIndex + 1];
      const generated = generateKeyBetweenWithNormalization(
        previous?.orderIndex ?? null,
        next?.orderIndex ?? null,
        siblings.map(({ id, orderIndex }) => ({ id, orderIndex })),
      );

      if (generated.normalized) {
        const normalizedById = new Map(
          generated.siblings.map((sibling) => [sibling.id, sibling.orderIndex]),
        );
        setBlocks((current) =>
          current.map((block) => {
            const orderIndex = normalizedById.get(block.id);
            return orderIndex === undefined ? block : { ...block, orderIndex };
          }),
        );
        for (const sibling of generated.siblings) {
          const current = siblings.find((item) => item.id === sibling.id);
          if (current !== undefined && current.orderIndex !== sibling.orderIndex) {
            persistChanges(
              current,
              { parentBlockId: current.parentBlockId, orderIndex: sibling.orderIndex },
              'MOVE_BLOCK',
            );
          }
        }
      }

      const id = crypto.randomUUID();
      const parentBlockId =
        afterId === null ? null : blocks.find((item) => item.id === afterId)?.parentBlockId ?? null;
      const content = contentWithText(type, defaultBlockContent(type), initialText);
      const newBlock: EditorBlock = {
        id,
        type,
        content,
        parentBlockId,
        orderIndex: generated.key,
        revision: '0',
      };
      setBlocks((previousBlocks) => {
        const index = afterId === null ? -1 : previousBlocks.findIndex((block) => block.id === afterId);
        const nextBlocks = [...previousBlocks];
        nextBlocks.splice(index < 0 ? nextBlocks.length : index + 1, 0, newBlock);
        return nextBlocks;
      });
      store.getState().applyOptimisticMutation({
        workspaceId,
        entityType: 'block',
        entityId: id,
        type: 'CREATE_BLOCK',
        changes: {
          pageId,
          parentBlockId,
          type,
          content: toJsonObject(content),
          orderIndex: generated.key,
        },
      });
      setSlashMenu(null);
      window.setTimeout(() => {
        const input = document.getElementById(`block-input-${id}`);
        if (input instanceof HTMLTextAreaElement) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    [blocks, pageId, persistChanges, store, workspaceId],
  );

  const deleteBlock = useCallback(
    (block: EditorBlock) => {
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      store.getState().applyOptimisticMutation({
        workspaceId,
        entityType: 'block',
        entityId: block.id,
        type: 'DELETE_BLOCK',
        changes: {},
      });
    },
    [store, workspaceId],
  );

  const selectBlockType = useCallback(
    (type: BlockType) => {
      if (slashMenu === null) return;
      const block = blocks.find((item) => item.id === slashMenu.blockId);
      if (block !== undefined) updateBlock(block.id, type, defaultBlockContent(type));
      setSlashMenu(null);
    },
    [blocks, slashMenu, updateBlock],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, block: EditorBlock) => {
      const target = event.currentTarget;
      if (slashMenu?.blockId === block.id) {
        const count = commandCount(slashMenu.query);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setSlashMenu({
            ...slashMenu,
            activeIndex:
              count === 0
                ? 0
                : (slashMenu.activeIndex + (event.key === 'ArrowDown' ? 1 : count - 1)) % count,
          });
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const command = SLASH_COMMANDS.filter((item) =>
            `${item.label} ${item.description}`.toLowerCase().includes(slashMenu.query.trim().toLowerCase()),
          )[slashMenu.activeIndex];
          if (command !== undefined) selectBlockType(command.type);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setSlashMenu(null);
          return;
        }
        if (event.key === 'Backspace') {
          event.preventDefault();
          if (slashMenu.query.length === 0) setSlashMenu(null);
          else setSlashMenu({ ...slashMenu, query: slashMenu.query.slice(0, -1), activeIndex: 0 });
          return;
        }
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          setSlashMenu({ ...slashMenu, query: `${slashMenu.query}${event.key}`, activeIndex: 0 });
          return;
        }
      }

      if (!(target instanceof HTMLTextAreaElement)) {
        if (event.key === 'Enter') {
          event.preventDefault();
          createBlockAfter(block.id);
        } else if (event.key === 'Backspace' && getBlockText(block.content).length === 0) {
          event.preventDefault();
          deleteBlock(block);
        }
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const before = target.value.slice(0, target.selectionStart);
        const after = target.value.slice(target.selectionEnd);
        changeText(block.id, before);
        createBlockAfter(block.id, 'PARAGRAPH', after);
        return;
      }
      if (
        event.key === 'Backspace' &&
        target.selectionStart === 0 &&
        target.selectionEnd === 0
      ) {
        if (target.value.length === 0) {
          event.preventDefault();
          deleteBlock(block);
          const previous = orderedBlocks
            .filter((item) => item.parentBlockId === block.parentBlockId)
            .sort(compareBlockOrder)
            .filter((item) => item.orderIndex < block.orderIndex)
            .at(-1);
          if (previous !== undefined) {
            window.setTimeout(() => document.getElementById(`block-input-${previous.id}`)?.focus(), 0);
          }
        } else {
          const siblings = orderedBlocks
            .filter((item) => item.parentBlockId === block.parentBlockId)
            .sort(compareBlockOrder);
          const index = siblings.findIndex((item) => item.id === block.id);
          const previous = siblings[index - 1];
          if (previous !== undefined) {
            event.preventDefault();
            const previousType = previous.type === 'DIVIDER' ? 'PARAGRAPH' : previous.type;
            const mergedText = `${getBlockText(previous.content)}${target.value}`;
            updateBlock(
              previous.id,
              previousType,
              contentWithText(previousType, previous.content, mergedText),
            );
            deleteBlock(block);
            window.setTimeout(() => {
              const input = document.getElementById(`block-input-${previous.id}`);
              if (input instanceof HTMLTextAreaElement) {
                input.focus();
                input.setSelectionRange(mergedText.length - target.value.length, mergedText.length - target.value.length);
              }
            }, 0);
          }
        }
      }
    },
    [
      changeText,
      createBlockAfter,
      deleteBlock,
      orderedBlocks,
      selectBlockType,
      slashMenu,
      updateBlock,
    ],
  );

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const activeBlock = blocks.find((block) => block.id === active.id);
    const overBlock = blocks.find((block) => block.id === over.id);
    if (
      activeBlock === undefined ||
      overBlock === undefined ||
      activeBlock.parentBlockId !== overBlock.parentBlockId
    ) {
      return;
    }
    const siblings = orderedBlocks.filter(
      (block) => block.parentBlockId === activeBlock.parentBlockId,
    );
    const reordered = reorderBlocks(siblings, String(active.id), String(over.id));
    if (reordered.changed.length === 0) return;

    const changedById = new Map(reordered.changed.map((change) => [change.id, change.orderIndex]));
    setBlocks((current) =>
      current.map((block) => {
        const orderIndex = changedById.get(block.id);
        return orderIndex === undefined ? block : { ...block, orderIndex };
      }),
    );
    for (const change of reordered.changed) {
      const block = siblings.find((item) => item.id === change.id);
      if (block !== undefined) {
        persistChanges(
          block,
          { parentBlockId: block.parentBlockId, orderIndex: change.orderIndex },
          'MOVE_BLOCK',
        );
      }
    }
  }

  function renderGroup(parentBlockId: string | null, depth: number): React.JSX.Element {
    const siblings = orderedBlocks.filter((block) => block.parentBlockId === parentBlockId);
    return (
      <SortableContext
        items={siblings.map((block) => block.id)}
        strategy={verticalListSortingStrategy}
      >
        {siblings.map((block) => (
          <div key={block.id}>
            <BlockRenderer
              id={block.id}
              type={block.type}
              content={block.content}
              text={getBlockText(block.content)}
              slashMenu={slashMenu}
              depth={depth}
              onTextChange={(text) => changeText(block.id, text)}
              onImageUrlChange={(url) => {
                if (block.content.kind !== 'image') return;
                updateBlock(block.id, block.type, { ...block.content, url });
              }}
              onTodoToggle={(checked) => {
                if (block.type !== 'TODO') return;
                const content = contentWithText('TODO', block.content, getBlockText(block.content));
                updateBlock(
                  block.id,
                  block.type,
                  content.kind === 'todo' ? { ...content, checked } : defaultBlockContent('TODO'),
                );
              }}
              onToggle={(isOpen) => {
                if (block.type !== 'TOGGLE') return;
                const content = contentWithText('TOGGLE', block.content, getBlockText(block.content));
                updateBlock(
                  block.id,
                  block.type,
                  content.kind === 'toggle' ? { ...content, isOpen } : defaultBlockContent('TOGGLE'),
                );
              }}
              onKeyDown={(event) => handleKeyDown(event, block)}
              onSlashOpen={() => setSlashMenu({ blockId: block.id, query: '', activeIndex: 0 })}
              onAddAfter={() => createBlockAfter(block.id)}
              onSelectCommand={selectBlockType}
            />
            {!(
              block.type === 'TOGGLE' &&
              block.content.kind === 'toggle' &&
              !block.content.isOpen
            ) && renderGroup(block.id, depth + 1)}
          </div>
        ))}
      </SortableContext>
    );
  }

  return (
    <section aria-label="Page blocks" className="relative">
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        sensors={sensors}
      >
        {renderGroup(null, 0)}
      </DndContext>
      <button
        type="button"
        className="ml-11 mt-3 rounded-md px-2 py-1 text-sm text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
        onClick={() => createBlockAfter(orderedBlocks.at(-1)?.id ?? null)}
      >
        + Add a block
      </button>
    </section>
  );
}
