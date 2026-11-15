'use client';

import { useMemo, useState } from 'react';
import { PropertyType, ViewLayout } from '@prisma/client';
import { z } from 'zod';
import type { JsonValue, PropertyConfigPayload, ViewFilterRule, ViewSortRule } from '@/types/workspace';
import { generateKeyBetween } from '@/lib/fractional-index';
import { filterAndSortRows, type DatabaseViewRow } from '@/lib/database/view-utils';
import { useWorkspaceStore } from '@/lib/sync/workspace-store';
import { propertyConfigSchema, viewFilterRuleSchema, viewSortRuleSchema } from '@/server/validators/database';
import { CalendarView } from './calendar-view';
import type { DatabaseData, DatabasePropertyData, DatabaseRowData, DatabaseViewData } from './database-types';
import { KanbanBoardView } from './kanban-board-view';
import { PropertyModal } from './property-modal';
import { TableView } from './table-view';

const propertyResponseSchema = z.object({
  property: z.object({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(PropertyType),
    config: propertyConfigSchema,
    orderIndex: z.string(),
    revision: z.string(),
  }),
});

const viewResponseSchema = z.object({
  view: z.object({
    id: z.string(),
    name: z.string(),
    layout: z.nativeEnum(ViewLayout),
    filters: z.array(viewFilterRuleSchema),
    sorts: z.array(viewSortRuleSchema),
    visibleProperties: z.array(z.string()),
    groupByPropertyId: z.string().nullable(),
    orderIndex: z.string(),
    revision: z.string(),
  }),
});

async function requestJson(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }
  if (!response.ok) {
    const message =
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return result;
}

function rowView(row: DatabaseRowData): DatabaseViewRow {
  return {
    id: row.id,
    title: row.title,
    orderIndex: row.orderIndex,
    properties: row.properties,
  };
}

function viewPayload(view: DatabaseViewData): Omit<DatabaseViewData, 'id' | 'revision'> {
  return {
    name: view.name,
    layout: view.layout,
    filters: view.filters,
    sorts: view.sorts,
    visibleProperties: view.visibleProperties,
    groupByPropertyId: view.groupByPropertyId,
    orderIndex: view.orderIndex,
  };
}

function filterValueForProperty(
  property: DatabasePropertyData | undefined,
  value: string,
): ViewFilterRule['value'] {
  if (property?.type === 'NUMBER') {
    if (value.trim() === '') {
      throw new Error('Enter a number for this filter.');
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error('Enter a valid number for this filter.');
    }
    return number;
  }
  if (property?.type === 'CHECKBOX') {
    if (value === '') throw new Error('Choose checked or unchecked for this filter.');
    return value === 'true';
  }
  return value;
}

export function DatabaseContainer({
  pageId,
  workspaceId,
  initialData,
}: {
  pageId: string;
  workspaceId: string;
  initialData: DatabaseData;
}): React.JSX.Element {
  const [properties, setProperties] = useState(initialData.properties);
  const [views, setViews] = useState(initialData.views);
  const [rows, setRows] = useState(initialData.rows);
  const [activeViewId, setActiveViewId] = useState(initialData.views[0]?.id ?? 'local-table');
  const [editingProperty, setEditingProperty] = useState<DatabasePropertyData | null>(null);
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [filterOperator, setFilterOperator] = useState<ViewFilterRule['operator']>('contains');
  const [filterValue, setFilterValue] = useState('');
  const [sortPropertyId, setSortPropertyId] = useState('');
  const [sortDirection, setSortDirection] = useState<ViewSortRule['direction']>('asc');
  const [error, setError] = useState<string | null>(null);
  const store = useWorkspaceStore;

  const activeView =
    views.find((view) => view.id === activeViewId) ??
    ({
      id: 'local-table',
      name: 'Table',
      layout: 'TABLE',
      filters: [],
      sorts: [],
      visibleProperties: properties.map((property) => property.id),
      groupByPropertyId: null,
      orderIndex: 'a0',
      revision: '0',
    } satisfies DatabaseViewData);
  const rowViews = useMemo(() => rows.map(rowView), [rows]);
  const sortedRows = useMemo(
    () => filterAndSortRows(rowViews, activeView.filters, activeView.sorts),
    [activeView.filters, activeView.sorts, rowViews],
  );
  const visibleRows = sortedRows.flatMap((viewRow) => {
    const row = rows.find((candidate) => candidate.id === viewRow.id);
    return row === undefined ? [] : [row];
  });
  const filterProperty = properties.find((property) => property.id === filterPropertyId);
  const filterOptions =
    filterProperty?.config.kind === 'select' || filterProperty?.config.kind === 'status'
      ? filterProperty.config.options
      : [];

  async function saveProperty(input: {
    id?: string;
    name: string;
    type: PropertyType;
    config: PropertyConfigPayload;
  }): Promise<void> {
    setError(null);
    const result = await requestJson(
      `/api/pages/${encodeURIComponent(pageId)}/properties`,
      input.id ? 'PATCH' : 'POST',
      input,
    );
    const parsed = propertyResponseSchema.safeParse(result);
    if (!parsed.success) throw new Error('The property response was invalid.');
    setProperties((current) => {
      const index = current.findIndex((property) => property.id === parsed.data.property.id);
      if (index < 0) return [...current, parsed.data.property];
      return current.map((property) =>
        property.id === parsed.data.property.id ? parsed.data.property : property,
      );
    });
    if (activeView.id !== 'local-table') {
      await saveViewChanges({
        visibleProperties: [...activeView.visibleProperties, parsed.data.property.id],
      });
    }
  }

  async function deleteProperty(property: DatabasePropertyData): Promise<void> {
    if (!window.confirm(`Delete "${property.name}" and its saved values?`)) return;
    setError(null);
    try {
      await requestJson(
        `/api/pages/${encodeURIComponent(pageId)}/properties`,
        'DELETE',
        { id: property.id },
      );
      setProperties((current) => current.filter((entry) => entry.id !== property.id));
      setRows((current) =>
        current.map((row) => {
          const nextProperties = { ...row.properties };
          const nextValueIds = { ...row.propertyValueIds };
          delete nextProperties[property.id];
          delete nextValueIds[property.id];
          return { ...row, properties: nextProperties, propertyValueIds: nextValueIds };
        }),
      );
      setViews((current) =>
        current.map((view) => ({
          ...view,
          filters: view.filters.filter((filter) => filter.propertyId !== property.id),
          sorts: view.sorts.filter((sort) => sort.propertyId !== property.id),
          visibleProperties: view.visibleProperties.filter((id) => id !== property.id),
          groupByPropertyId:
            view.groupByPropertyId === property.id ? null : view.groupByPropertyId,
        })),
      );
      setEditingProperty(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Property could not be deleted.');
    }
  }

  async function createView(layout: ViewLayout): Promise<DatabaseViewData | null> {
    const existing = views.find((view) => view.layout === layout);
    if (existing !== undefined) {
      setActiveViewId(existing.id);
      return existing;
    }
    try {
      const name =
        layout === 'BOARD' ? 'Board' : layout === 'CALENDAR' ? 'Calendar' : 'Table';
      const result = await requestJson(`/api/pages/${encodeURIComponent(pageId)}/views`, 'POST', {
        name,
        layout,
        filters: [],
        sorts: [],
        visibleProperties: properties.map((property) => property.id),
        groupByPropertyId:
          layout === 'BOARD'
            ? properties.find((property) => property.type === 'STATUS' || property.type === 'SELECT')?.id ??
              null
            : null,
      });
      const parsed = viewResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error('The database view response was invalid.');
      setViews((current) => [...current, parsed.data.view]);
      setActiveViewId(parsed.data.view.id);
      return parsed.data.view;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'View could not be created.');
      return null;
    }
  }

  async function saveViewChanges(changes: Partial<DatabaseViewData>): Promise<void> {
    const updated = { ...activeView, ...changes };
    if (activeView.id === 'local-table') {
      const result = await requestJson(`/api/pages/${encodeURIComponent(pageId)}/views`, 'POST', {
        ...viewPayload(updated),
      });
      const parsed = viewResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error('The database view response was invalid.');
      setViews((current) => [...current, parsed.data.view]);
      setActiveViewId(parsed.data.view.id);
      return;
    }
    const result = await requestJson(`/api/pages/${encodeURIComponent(pageId)}/views`, 'PATCH', {
      id: updated.id,
      ...changes,
    });
    const parsed = viewResponseSchema.safeParse(result);
    if (!parsed.success) throw new Error('The database view response was invalid.');
    setViews((current) =>
      current.map((view) => (view.id === parsed.data.view.id ? parsed.data.view : view)),
    );
  }

  function applyCellChange(rowId: string, propertyId: string, value: JsonValue): void {
    const updatedAt = new Date().toISOString();
    const row = rows.find((candidate) => candidate.id === rowId);
    if (row === undefined) return;
    const propertyValueId = row.propertyValueIds[propertyId] ?? crypto.randomUUID();
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === rowId
          ? {
              ...candidate,
              properties: { ...candidate.properties, [propertyId]: value },
              propertyValueIds: { ...candidate.propertyValueIds, [propertyId]: propertyValueId },
            }
          : candidate,
      ),
    );
    store.getState().applyOptimisticMutation({
      workspaceId,
      entityType: 'rowProperty',
      entityId: propertyValueId,
      type: 'UPSERT_ROW_PROP',
      changes: { rowPageId: rowId, propertyId, value },
      updatedAt,
    });
  }

  function updateTitle(rowId: string, title: string): void {
    const updatedAt = new Date().toISOString();
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, title } : row)),
    );
    store.getState().applyOptimisticMutation({
      workspaceId,
      entityType: 'page',
      entityId: rowId,
      type: 'UPDATE_PAGE',
      changes: { title },
      updatedAt,
    });
  }

  function moveCard(row: DatabaseRowData, propertyId: string, value: JsonValue): void {
    applyCellChange(row.id, propertyId, value);
    const endOrder = rows
      .filter(
        (candidate) =>
          candidate.id !== row.id &&
          (candidate.properties[propertyId] ?? '') === value,
      )
      .map((candidate) => candidate.orderIndex)
      .sort()
      .at(-1) ?? null;
    const orderIndex = generateKeyBetween(endOrder, null);
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === row.id ? { ...candidate, orderIndex } : candidate,
      ),
    );
    store.getState().applyOptimisticMutation({
      workspaceId,
      entityType: 'page',
      entityId: row.id,
      type: 'UPDATE_PAGE',
      changes: { orderIndex },
    });
  }

  function addRow(): void {
    const id = crypto.randomUUID();
    const orderIndex = generateKeyBetween(
      rows.map((row) => row.orderIndex).sort().at(-1) ?? null,
      null,
    );
    const title = 'Untitled';
    const newRow: DatabaseRowData = {
      id,
      title,
      icon: null,
      orderIndex,
      revision: '0',
      properties: {},
      propertyValueIds: {},
    };
    setRows((current) => [...current, newRow]);
    store.getState().applyOptimisticMutation({
      workspaceId,
      entityType: 'page',
      entityId: id,
      type: 'CREATE_PAGE',
      changes: {
        title,
        parentPageId: pageId,
        orderIndex,
        isDatabase: false,
        isFavorite: false,
        isPrivate: false,
      },
    });
  }

  function addFilter(): void {
    if (!filterPropertyId) return;
    let filter: ViewFilterRule;
    try {
      filter = {
        id: crypto.randomUUID(),
        propertyId: filterPropertyId,
        operator: filterOperator,
        ...(filterOperator === 'is_empty' || filterOperator === 'is_not_empty'
          ? {}
          : { value: filterValueForProperty(filterProperty, filterValue) }),
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Filter value is invalid.');
      return;
    }
    void saveViewChanges({ filters: [...activeView.filters, filter] }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'Filter could not be saved.'),
    );
  }

  function addSort(): void {
    if (!sortPropertyId) return;
    const nextSorts = [
      ...activeView.sorts.filter((sort) => sort.propertyId !== sortPropertyId),
      { propertyId: sortPropertyId, direction: sortDirection },
    ];
    void saveViewChanges({ sorts: nextSorts }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'Sort could not be saved.'),
    );
  }

  const groupProperty =
    activeView.groupByPropertyId === null
      ? null
      : properties.find((property) => property.id === activeView.groupByPropertyId) ?? null;
  const dateProperty = properties.find((property) => property.type === 'DATE') ?? null;
  const visiblePropertyIds =
    activeView.visibleProperties.length === 0
      ? properties.map((property) => property.id)
      : activeView.visibleProperties;

  return (
    <section className="space-y-4" aria-label="Database">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-[var(--border-hairline)]">
          {(['TABLE', 'BOARD', 'CALENDAR'] as const).map((layout) => {
            const view = views.find((candidate) => candidate.layout === layout);
            const isActive =
              (view?.id ?? 'local-table') === activeViewId ||
              (layout === 'TABLE' && activeView.id === 'local-table');
            return (
              <button
                className={`border-b-2 px-3 py-2 text-sm ${
                  isActive
                    ? 'border-[var(--ink-primary)] text-[var(--ink-primary)]'
                    : 'border-transparent text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                key={layout}
                onClick={() => void createView(layout)}
                type="button"
              >
                {layout === 'BOARD' ? 'Board' : layout === 'CALENDAR' ? 'Calendar' : 'Table'}
              </button>
            );
          })}
        </div>
        <button
          className="rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-[var(--bg-canvas)] hover:bg-[var(--accent-primary-hover)]"
          onClick={addRow}
          type="button"
        >
          + New
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--bg-sidebar)] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-[var(--ink-secondary)]">
            Filter property
            <select
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
              onChange={(event) => {
                setFilterPropertyId(event.target.value);
                setFilterValue('');
              }}
              value={filterPropertyId}
            >
              <option value="">Choose field</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Filter operator"
            className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
            onChange={(event) => setFilterOperator(event.target.value as ViewFilterRule['operator'])}
            value={filterOperator}
          >
            {['contains', 'equals', 'not_equals', 'not_contains', 'is_empty', 'is_not_empty', 'gt', 'lt'].map((operator) => (
              <option key={operator} value={operator}>{operator.replaceAll('_', ' ')}</option>
            ))}
          </select>
          {filterOperator !== 'is_empty' && filterOperator !== 'is_not_empty' &&
            (filterProperty?.type === 'CHECKBOX' ? (
              <select
                aria-label="Filter value"
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
                onChange={(event) => setFilterValue(event.target.value)}
                value={filterValue}
              >
                <option value="">Choose value</option>
                <option value="true">Checked</option>
                <option value="false">Unchecked</option>
              </select>
            ) : filterOptions.length > 0 ? (
              <select
                aria-label="Filter value"
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
                onChange={(event) => setFilterValue(event.target.value)}
                value={filterValue}
              >
                <option value="">Choose value</option>
                {filterOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            ) : (
              <input
                aria-label="Filter value"
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
                onChange={(event) => setFilterValue(event.target.value)}
                placeholder="Value"
                type={
                  filterProperty?.type === 'NUMBER'
                    ? 'number'
                    : filterProperty?.type === 'DATE'
                      ? 'date'
                      : 'text'
                }
                value={filterValue}
              />
            ))}
          <button
            className="rounded-md border border-[var(--border-hairline)] px-2 py-1.5 text-sm hover:bg-[var(--bg-hover)]"
            onClick={addFilter}
            type="button"
          >
            + Filter
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-[var(--ink-secondary)]">
            Sort property
            <select
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
              onChange={(event) => setSortPropertyId(event.target.value)}
              value={sortPropertyId}
            >
              <option value="">Choose field</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Sort direction"
            className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
            onChange={(event) => setSortDirection(event.target.value as ViewSortRule['direction'])}
            value={sortDirection}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button
            className="rounded-md border border-[var(--border-hairline)] px-2 py-1.5 text-sm hover:bg-[var(--bg-hover)]"
            onClick={addSort}
            type="button"
          >
            + Sort
          </button>
        </div>

        {activeView.layout === 'BOARD' && (
          <label className="grid gap-1 text-xs text-[var(--ink-secondary)]">
            Group by
            <select
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
              onChange={(event) =>
                void saveViewChanges({
                  groupByPropertyId: event.target.value || null,
                }).catch((caught: unknown) =>
                  setError(caught instanceof Error ? caught.message : 'Group could not be saved.'),
                )
              }
              value={groupProperty?.id ?? ''}
            >
              <option value="">Choose field</option>
              {properties
                .filter((property) => property.type === 'SELECT' || property.type === 'STATUS')
                .map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {activeView.layout === 'TABLE' && properties.length > 0 && (
          <details className="relative ml-auto">
            <summary className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]">
              Properties
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 grid min-w-48 gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-popover)]">
              {properties.map((property) => (
                <label className="flex items-center gap-2 text-sm text-[var(--ink-primary)]" key={property.id}>
                  <input
                    checked={visiblePropertyIds.includes(property.id)}
                    onChange={(event) => {
                      const nextVisible = event.target.checked
                        ? [...visiblePropertyIds, property.id]
                        : visiblePropertyIds.filter((id) => id !== property.id);
                      void saveViewChanges({ visibleProperties: nextVisible }).catch((caught: unknown) =>
                        setError(caught instanceof Error ? caught.message : 'Properties could not be saved.'),
                      );
                    }}
                    type="checkbox"
                  />
                  {property.name}
                </label>
              ))}
            </div>
          </details>
        )}

        <div className="ml-auto flex flex-wrap gap-1">
          {activeView.filters.map((filter) => (
            <button
              className="rounded-md bg-[var(--bg-hover)] px-2 py-1 text-xs text-[var(--ink-secondary)]"
              key={filter.id}
              onClick={() =>
                void saveViewChanges({
                  filters: activeView.filters.filter((candidate) => candidate.id !== filter.id),
                }).catch((caught: unknown) =>
                  setError(caught instanceof Error ? caught.message : 'Filter could not be removed.'),
                )
              }
              type="button"
            >
              {properties.find((property) => property.id === filter.propertyId)?.name ?? 'Field'} {filter.operator} ×
            </button>
          ))}
          {activeView.sorts.map((sort) => (
            <button
              className="rounded-md bg-[var(--bg-hover)] px-2 py-1 text-xs text-[var(--ink-secondary)]"
              key={sort.propertyId}
              onClick={() =>
                void saveViewChanges({
                  sorts: activeView.sorts.filter((candidate) => candidate.propertyId !== sort.propertyId),
                }).catch((caught: unknown) =>
                  setError(caught instanceof Error ? caught.message : 'Sort could not be removed.'),
                )
              }
              type="button"
            >
              {properties.find((property) => property.id === sort.propertyId)?.name ?? 'Field'} {sort.direction} ×
            </button>
          ))}
        </div>
      </div>

      {activeView.layout === 'TABLE' && (
        <div className="space-y-2">
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md px-2 py-1 text-sm text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
              onClick={() => setIsAddingProperty(true)}
              type="button"
            >
              + Property
            </button>
          </div>
          <TableView
            onCellChange={applyCellChange}
            onEditProperty={(property) => setEditingProperty(property)}
            onTitleChange={updateTitle}
            properties={properties}
            rows={visibleRows}
            calculationRows={rows}
            visibleProperties={visiblePropertyIds}
          />
        </div>
      )}
      {activeView.layout === 'BOARD' && (
        <KanbanBoardView
          onMove={(row, value) => {
            if (groupProperty) moveCard(row, groupProperty.id, value);
          }}
          property={groupProperty}
          rows={visibleRows}
        />
      )}
      {activeView.layout === 'CALENDAR' && (
        <CalendarView property={dateProperty} rows={visibleRows} />
      )}

      {error && <p className="text-sm text-[var(--status-danger)]" role="alert">{error}</p>}
      {(isAddingProperty || editingProperty) && (
        <PropertyModal
          onClose={() => {
            setIsAddingProperty(false);
            setEditingProperty(null);
          }}
          onSave={async (input) => {
            try {
              await saveProperty(input);
            } catch (caught) {
              const message =
                caught instanceof Error ? caught.message : 'Property could not be saved.';
              setError(message);
              throw caught;
            }
          }}
          property={editingProperty}
        />
      )}
      {editingProperty && (
        <button
          className="fixed bottom-6 left-6 z-[60] rounded-md border border-[var(--status-danger)] px-3 py-2 text-sm text-[var(--status-danger)]"
          onClick={() => void deleteProperty(editingProperty)}
          type="button"
        >
          Delete {editingProperty.name}
        </button>
      )}
    </section>
  );
}
