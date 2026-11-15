'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import Image from 'next/image';
import type { BlockType } from '@prisma/client';
import type { BlockContentPayload } from '@/types/workspace';
import { SlashCommandMenu } from './slash-command-menu';

export interface SlashMenuState {
  blockId: string;
  query: string;
  activeIndex: number;
}

export function BlockRenderer({
  id,
  type,
  content,
  text,
  slashMenu,
  onTextChange,
  onImageUrlChange,
  onTodoToggle,
  onToggle,
  onKeyDown,
  onSlashOpen,
  onAddAfter,
  onSelectCommand,
  depth,
}: {
  id: string;
  type: BlockType;
  content: BlockContentPayload;
  text: string;
  slashMenu: SlashMenuState | null;
  onTextChange: (text: string) => void;
  onImageUrlChange: (url: string) => void;
  onTodoToggle: (checked: boolean) => void;
  onToggle: (isOpen: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onSlashOpen: () => void;
  onAddAfter: () => void;
  onSelectCommand: (type: BlockType) => void;
  depth: number;
}): React.JSX.Element {
  const { attributes, isDragging, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id });
  const styles: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  const isSlashOpen = slashMenu?.blockId === id;
  const inputStyle =
    type === 'HEADING_1'
      ? 'text-3xl font-semibold'
      : type === 'HEADING_2'
        ? 'text-2xl font-semibold'
        : type === 'HEADING_3'
          ? 'text-xl font-semibold'
          : type === 'CODE'
            ? 'rounded-md bg-[var(--bg-sidebar)] font-mono text-sm'
            : type === 'QUOTE'
              ? 'border-l-2 border-[var(--border-focus)] pl-4 italic'
              : 'text-base';

  function renderInput(): React.JSX.Element {
    if (type === 'DIVIDER') {
      return (
        <div
          aria-label="Divider block"
          className="flex min-h-9 items-center gap-3"
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
          <hr className="flex-1 border-[var(--border-hairline)]" />
          <span className="text-xs text-[var(--ink-muted)]">Divider</span>
        </div>
      );
    }

    if ((type === 'COLUMN' || type === 'COLUMN_LIST') && content.kind === 'layout') {
      return (
        <div
          aria-label={type === 'COLUMN_LIST' ? 'Column layout block' : 'Column block'}
          className="grid min-h-16 flex-1 grid-cols-2 gap-2 rounded-md border border-dashed border-[var(--border-hairline)] p-2"
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
          <span className="rounded bg-[var(--bg-sidebar)]" />
          {type === 'COLUMN_LIST' && <span className="rounded bg-[var(--bg-sidebar)]" />}
        </div>
      );
    }

    if (type === 'IMAGE' && content.kind === 'image') {
      return (
        <div className="w-full space-y-2">
          <input
            aria-label="Image URL"
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
            onChange={(event) => onImageUrlChange(event.target.value)}
            placeholder="Paste an image URL"
            type="url"
            value={content.url}
          />
          {/^https?:\/\//i.test(content.url) && (
            <Image
              alt=""
              className="max-h-96 max-w-full rounded-md object-contain"
              height={720}
              sizes="(max-width: 800px) 100vw, 800px"
              src={content.url}
              unoptimized
              width={1200}
            />
          )}
          <textarea
            id={`block-input-${id}`}
            aria-label="Image caption"
            className="min-h-8 w-full resize-none bg-transparent text-sm text-[var(--ink-secondary)] outline-none"
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a caption"
            value={content.caption ?? ''}
          />
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {type === 'TODO' && (
          <input
            aria-label="Mark to-do complete"
            checked={content.kind === 'todo' && content.checked}
            className="mt-2 accent-[var(--accent-primary)]"
            onChange={(event) => onTodoToggle(event.target.checked)}
            type="checkbox"
          />
        )}
        {type === 'BULLETED_LIST' && (
          <span aria-hidden="true" className="mt-1 text-[var(--ink-secondary)]">•</span>
        )}
        {type === 'NUMBERED_LIST' && (
          <span aria-hidden="true" className="mt-1 text-[var(--ink-secondary)]">1.</span>
        )}
        {type === 'TOGGLE' && (
          <button
            type="button"
            aria-label={content.kind === 'toggle' && content.isOpen ? 'Collapse toggle block' : 'Expand toggle block'}
            aria-expanded={content.kind === 'toggle' && content.isOpen}
            className="mt-1 text-xs text-[var(--ink-muted)]"
            onClick={() => onToggle(!(content.kind === 'toggle' && content.isOpen))}
          >
            {content.kind === 'toggle' && content.isOpen ? '▾' : '▸'}
          </button>
        )}
        <textarea
          id={`block-input-${id}`}
          aria-label={`${type.replaceAll('_', ' ').toLowerCase()} block content`}
          className={`min-h-8 w-full resize-none bg-transparent py-1 text-[var(--ink-primary)] outline-none placeholder:text-[var(--ink-muted)] ${inputStyle}`}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            type === 'CALLOUT'
              ? 'Add a helpful note...'
              : type === 'CHILD_DATABASE'
                ? 'Choose a database...'
                : type === 'CHART_BLOCK'
                  ? 'Configure a chart...'
                  : type === 'SYNCED_BLOCK'
                    ? 'Choose content to sync...'
                    : type === 'COLUMN' || type === 'COLUMN_LIST'
                      ? 'Column layout'
                      : 'Type something...'
          }
          rows={Math.max(1, text.split('\n').length)}
          value={text}
        />
      </div>
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === '/' && !isSlashOpen && event.currentTarget.value.length === 0) {
      event.preventDefault();
      onSlashOpen();
      return;
    }
    onKeyDown(event);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...styles, marginInlineStart: `${depth * 24}px` }}
      className={`group relative flex min-h-9 items-start rounded-md py-1 pr-2 ${
        type === 'CALLOUT' ? 'bg-[var(--bg-selected)] px-3' : ''
      } ${type === 'TOGGLE' && content.kind === 'toggle' && !content.isOpen ? 'opacity-70' : ''}`}
      data-block-id={id}
      data-block-type={type}
    >
      <div className="absolute -left-11 top-0 flex h-9 w-10 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          aria-label="Add block below"
          className="rounded p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
          onClick={onAddAfter}
        >
          <Plus aria-hidden="true" size={14} />
        </button>
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag to reorder block"
          className="cursor-grab rounded p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={14} />
        </button>
      </div>
      {type === 'TOGGLE' && content.kind === 'toggle' && !content.isOpen ? (
        <button
          type="button"
          className="min-h-8 flex-1 text-left text-sm text-[var(--ink-secondary)]"
          onClick={() => onToggle(true)}
        >
          {text || 'Expand toggle block'}
        </button>
      ) : (
        renderInput()
      )}
      {isSlashOpen && slashMenu && (
        <SlashCommandMenu
          query={slashMenu.query}
          activeIndex={slashMenu.activeIndex}
          onSelect={onSelectCommand}
        />
      )}
      {type === 'CALLOUT' && content.kind === 'callout' && (
        <span aria-hidden="true" className="mr-2 order-first">{content.icon}</span>
      )}
    </div>
  );
}
