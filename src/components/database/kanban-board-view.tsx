'use client';

import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { JsonValue, PropertyConfigPayload } from '@/types/workspace';
import type { DatabasePropertyData, DatabaseRowData } from './database-types';

function BoardCard({
  row,
  property,
}: {
  row: DatabaseRowData;
  property: DatabasePropertyData;
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
    data: { rowId: row.id },
  });
  const selected = row.properties[property.id];
  const option =
    (property.config.kind === 'select' || property.config.kind === 'status') &&
    typeof selected === 'string'
      ? property.config.options.find((candidate) => candidate.id === selected)
      : undefined;
  return (
    <article
      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-card)]"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.6 : 1 }}
      {...listeners}
      {...attributes}
    >
      <h3 className="font-medium text-[var(--ink-primary)]">
        {row.icon && <span className="mr-2">{row.icon}</span>}
        {row.title}
      </h3>
      {option && (
        <p className="mt-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: `var(--pill-${option.color}-bg)`,
              color: `var(--pill-${option.color}-text)`,
            }}
          >
            {option.label}
          </span>
        </p>
      )}
    </article>
  );
}

function BoardColumn({
  id,
  title,
  color,
  property,
  rows,
}: {
  id: string;
  title: string;
  color: string;
  property: DatabasePropertyData;
  rows: DatabaseRowData[];
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      aria-label={`${title} column`}
      className={`min-h-72 w-[260px] shrink-0 rounded-lg p-2 ${
        isOver ? 'bg-[var(--bg-selected)]' : 'bg-[var(--bg-sidebar)]'
      }`}
      ref={setNodeRef}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h2>
        <span className="rounded-full px-2 py-0.5 text-xs text-[var(--ink-secondary)]" style={{
          backgroundColor: `var(--pill-${color}-bg)`,
          color: `var(--pill-${color}-text)`,
        }}>
          {rows.length}
        </span>
      </header>
      <div className="space-y-2">
        {rows.map((row) => (
          <BoardCard key={row.id} property={property} row={row} />
        ))}
        {rows.length === 0 && (
          <p className="px-2 py-4 text-xs text-[var(--ink-muted)]">Drop a page here.</p>
        )}
      </div>
    </section>
  );
}

function optionsFor(config: PropertyConfigPayload): Array<{ id: string; label: string; color: string }> {
  return config.kind === 'select' || config.kind === 'status' ? config.options : [];
}

export function KanbanBoardView({
  property,
  rows,
  onMove,
}: {
  property: DatabasePropertyData | null;
  rows: DatabaseRowData[];
  onMove: (row: DatabaseRowData, value: JsonValue) => void;
}): React.JSX.Element {
  if (
    property === null ||
    (property.type !== 'SELECT' && property.type !== 'STATUS') ||
    (property.config.kind !== 'select' && property.config.kind !== 'status')
  ) {
    return (
      <p className="rounded-lg border border-[var(--border-hairline)] p-6 text-sm text-[var(--ink-secondary)]">
        Choose a Select or Status property to group this board.
      </p>
    );
  }
  const options = optionsFor(property.config);
  const groupProperty = property;
  const columns = [
    ...options.map((option) => ({
      id: option.id,
      title: option.label,
      color: option.color,
      value: option.id,
    })),
    { id: '__unassigned__', title: 'No value', color: 'gray', value: '' },
  ];

  function handleDragEnd(event: DragEndEvent): void {
    const rowId = String(event.active.id);
    const targetId = event.over?.id;
    if (typeof targetId !== 'string') return;
    const row = rows.find((candidate) => candidate.id === rowId);
    const column = columns.find((candidate) => candidate.id === targetId);
    if (row === undefined || column === undefined) return;
    const currentValue = row.properties[groupProperty.id] ?? '';
    if (currentValue !== column.value) onMove(row, column.value);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <BoardColumn
            color={column.color}
            id={column.id}
            key={column.id}
            property={property}
            rows={rows.filter((row) => (row.properties[property.id] ?? '') === column.value)}
            title={column.title}
          />
        ))}
      </div>
    </DndContext>
  );
}
