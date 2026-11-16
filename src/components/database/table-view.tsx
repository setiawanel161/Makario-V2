'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JsonValue, PropertyConfigPayload } from '@/types/workspace';
import { calculateRollup, evaluateFormula, type DatabaseViewRow } from '@/lib/database/view-utils';
import type { DatabasePropertyData, DatabaseRowData } from './database-types';

function optionColor(
  config: PropertyConfigPayload,
  value: JsonValue,
): string {
  if (config.kind !== 'select' && config.kind !== 'status') return 'gray';
  const option = config.options.find(
    (candidate) => candidate.id === value || candidate.label === value,
  );
  return option?.color ?? 'gray';
}

function displayValue(value: JsonValue | number | null): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
}

function CellEditor({
  property,
  value,
  onChange,
}: {
  property: DatabasePropertyData;
  value: JsonValue;
  onChange: (value: JsonValue) => void;
}): React.JSX.Element {
  const inputClass =
    'w-full min-w-24 rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--ink-primary)] hover:border-[var(--border-hairline)] focus:border-[var(--border-focus)]';
  if (property.type === 'CHECKBOX') {
    return (
      <input
        aria-label={property.name}
        checked={value === true}
        className="accent-[var(--accent-primary)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    );
  }
  if (property.type === 'SELECT' || property.type === 'STATUS') {
    const options =
      property.config.kind === 'select' || property.config.kind === 'status'
        ? property.config.options
        : [];
    const color = optionColor(property.config, value);
    return (
      <select
        className={`${inputClass} rounded-md`}
        onChange={(event) => onChange(event.target.value)}
        style={{
          backgroundColor: `var(--pill-${color}-bg)`,
          color: `var(--pill-${color}-text)`,
        }}
        value={typeof value === 'string' ? value : ''}
      >
        <option value="">No value</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (property.type === 'MULTI_SELECT') {
    const options =
      property.config.kind === 'select' ? property.config.options : [];
    const selected = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
    return (
      <select
        className={inputClass}
        multiple
        onChange={(event) =>
          onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))
        }
        value={selected}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (property.type === 'ROLLUP' || property.type === 'FORMULA') {
    return (
      <span className="block min-w-24 px-2 py-1.5 text-sm text-[var(--ink-secondary)]">
        {displayValue(value)}
      </span>
    );
  }
  if (property.type === 'NUMBER') {
    return (
      <input
        className={inputClass}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
        type="number"
        value={typeof value === 'number' ? value : ''}
      />
    );
  }
  if (property.type === 'DATE') {
    return (
      <input
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={typeof value === 'string' ? value.slice(0, 10) : ''}
      />
    );
  }
  return (
    <input
      className={inputClass}
      onChange={(event) => onChange(event.target.value)}
      type={property.type === 'URL' ? 'url' : 'text'}
      value={displayValue(value)}
    />
  );
}

export function TableView({
  properties,
  visibleProperties,
  rows,
  calculationRows = rows,
  onCellChange,
  onTitleChange,
  onEditProperty,
}: {
  properties: DatabasePropertyData[];
  visibleProperties?: string[];
  rows: DatabaseRowData[];
  calculationRows?: DatabaseRowData[];
  onCellChange: (rowId: string, propertyId: string, value: JsonValue) => void;
  onTitleChange: (rowId: string, title: string) => void;
  onEditProperty: (property: DatabasePropertyData) => void;
}): React.JSX.Element {
  const displayedProperties =
    visibleProperties === undefined
      ? properties
      : properties.filter((property) => visibleProperties.includes(property.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualized = rows.length > 100;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    initialRect: { height: 600, width: 1024 },
    overscan: 8,
    enabled: virtualized,
  });
  const viewRows: DatabaseViewRow[] = calculationRows.map((row) => ({
    id: row.id,
    title: row.title,
    orderIndex: row.orderIndex,
    properties: row.properties,
  }));
  const viewRowsById = new Map(viewRows.map((row) => [row.id, row]));
  const gridTemplateColumns = `minmax(13rem, 1fr) repeat(${displayedProperties.length}, minmax(10rem, 1fr)) 3rem`;
  const renderedRows = virtualized
    ? virtualizer.getVirtualItems().flatMap((item) => {
        const row = rows[item.index];
        return row === undefined ? [] : [{ row, index: item.index, start: item.start }];
      })
    : rows.map((row, index) => ({ row, index, start: 0 }));

  return (
    <div
      className={`rounded-lg border border-[var(--border-hairline)] ${
        virtualized ? 'max-h-[70vh] overflow-auto' : 'overflow-x-auto'
      }`}
      ref={scrollRef}
    >
      <table
        className="w-full border-collapse text-left text-sm"
        style={virtualized ? { display: 'block', minWidth: '100%' } : undefined}
      >
        <thead
          className="bg-[var(--bg-sidebar)] text-[var(--ink-secondary)]"
          style={
            virtualized
              ? { display: 'block', position: 'sticky', top: 0, zIndex: 1 }
              : undefined
          }
        >
          <tr
            style={
              virtualized
                ? { display: 'grid', gridTemplateColumns, minWidth: 'max-content' }
                : undefined
            }
          >
            <th className="min-w-52 border-b border-[var(--border-hairline)] px-3 py-2 font-medium">
              Name
            </th>
            {displayedProperties.map((property) => (
              <th
                className="min-w-40 border-b border-l border-[var(--border-hairline)] px-3 py-2 font-medium"
                key={property.id}
              >
                <button
                  className="text-left hover:text-[var(--ink-primary)]"
                  onClick={() => onEditProperty(property)}
                  type="button"
                >
                  {property.name}
                </button>
              </th>
            ))}
            <th className="border-b border-l border-[var(--border-hairline)] px-3 py-2">
              <span className="sr-only">Add a property</span>+
            </th>
          </tr>
        </thead>
        <tbody
          style={
            virtualized
              ? {
                  display: 'block',
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                }
              : undefined
          }
        >
          {renderedRows.map(({ row, index, start }) => (
            <tr
              aria-rowindex={index + 2}
              className="border-b border-[var(--border-hairline)] last:border-0"
              key={row.id}
              style={
                virtualized
                  ? {
                      display: 'grid',
                      gridTemplateColumns,
                      left: 0,
                      minWidth: 'max-content',
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${start}px)`,
                      width: '100%',
                    }
                  : undefined
              }
            >
              <th className="min-w-52 px-2 py-1 font-normal">
                <input
                  aria-label="Row title"
                  className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--ink-primary)] hover:border-[var(--border-hairline)] focus:border-[var(--border-focus)]"
                  onBlur={(event) => {
                    if (event.target.value !== row.title) onTitleChange(row.id, event.target.value);
                  }}
                  onChange={() => undefined}
                  defaultValue={row.title}
                />
              </th>
              {displayedProperties.map((property) => {
                let value = row.properties[property.id] ?? null;
                if (property.config.kind === 'formula') {
                  value = evaluateFormula(property.config.expression, row.properties);
                } else if (property.config.kind === 'rollup') {
                  const viewRow = viewRowsById.get(row.id);
                  value = viewRow
                    ? calculateRollup(
                        viewRow,
                        property.config.relationPropertyId,
                        property.config.targetPropertyId,
                        property.config.aggregation,
                        viewRows,
                      )
                    : 0;
                }
                return (
                  <td
                    className="border-l border-[var(--border-hairline)] px-1 py-1"
                    key={property.id}
                  >
                    <CellEditor
                      onChange={(nextValue) => onCellChange(row.id, property.id, nextValue)}
                      property={property}
                      value={value}
                    />
                  </td>
                );
              })}
              <td className="border-l border-[var(--border-hairline)] px-3 py-2 text-[var(--ink-muted)]">
                <span aria-hidden="true">·</span>
              </td>
            </tr>
          ))}
          {!virtualized && rows.length === 0 && (
            <tr>
              <td
                className="px-4 py-8 text-center text-sm text-[var(--ink-muted)]"
                colSpan={displayedProperties.length + 2}
              >
                No rows yet. Add one to start shaping this database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
