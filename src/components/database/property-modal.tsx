'use client';

import { useEffect, useState } from 'react';
import { PropertyType } from '@prisma/client';
import type { PropertyConfigPayload } from '@/types/workspace';
import type { DatabasePropertyData } from './database-types';

const PROPERTY_TYPES = [
  'TEXT',
  'NUMBER',
  'SELECT',
  'MULTI_SELECT',
  'STATUS',
  'DATE',
  'PERSON',
  'CHECKBOX',
  'URL',
  'RELATION',
  'ROLLUP',
  'FORMULA',
] as const satisfies readonly PropertyType[];

const OPTION_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const;

function defaultConfig(type: PropertyType): PropertyConfigPayload {
  switch (type) {
    case 'NUMBER':
      return { kind: 'number', format: 'number' };
    case 'SELECT':
    case 'MULTI_SELECT':
      return { kind: 'select', options: [] };
    case 'STATUS':
      return { kind: 'status', options: [], groups: { todo: [], inProgress: [], done: [] } };
    case 'RELATION':
      return { kind: 'relation', targetDatabaseId: '' };
    case 'ROLLUP':
      return { kind: 'rollup', relationPropertyId: '', targetPropertyId: '', aggregation: 'COUNT' };
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

function configForForm(
  type: PropertyType,
  config: PropertyConfigPayload,
  optionLabels: string,
  optionColor: (typeof OPTION_COLORS)[number],
  relationTargetId: string,
  rollupRelationId: string,
  rollupTargetId: string,
  formula: string,
): PropertyConfigPayload {
  if (type === 'SELECT' || type === 'MULTI_SELECT' || type === 'STATUS') {
    const options = optionLabels
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => {
        const existing =
          (config.kind === 'select' || config.kind === 'status'
            ? config.options.find((option) => option.label === label)
            : undefined) ?? null;
        return {
          id: existing?.id ?? crypto.randomUUID(),
          label,
          color: existing?.color ?? optionColor,
        };
      });
    if (type === 'STATUS') {
      const todo = options[0]?.id;
      const inProgress = options[1]?.id;
      const done = options[2]?.id;
      return {
        kind: 'status',
        options,
        groups: {
          todo: todo ? [todo] : [],
          inProgress: inProgress ? [inProgress] : [],
          done: done ? [done] : [],
        },
      };
    }
    return { kind: 'select', options };
  }
  if (type === 'RELATION') {
    return { kind: 'relation', targetDatabaseId: relationTargetId.trim() };
  }
  if (type === 'ROLLUP') {
    return {
      kind: 'rollup',
      relationPropertyId: rollupRelationId.trim(),
      targetPropertyId: rollupTargetId.trim(),
      aggregation: config.kind === 'rollup' ? config.aggregation : 'COUNT',
    };
  }
  if (type === 'FORMULA') return { kind: 'formula', expression: formula.trim() };
  if (type === 'NUMBER') {
    return config.kind === 'number' ? config : { kind: 'number', format: 'number' };
  }
  return { kind: 'none' };
}

export function PropertyModal({
  property,
  onClose,
  onSave,
}: {
  property: DatabasePropertyData | null;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    type: PropertyType;
    config: PropertyConfigPayload;
  }) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(property?.name ?? '');
  const [type, setType] = useState<PropertyType>(property?.type ?? 'TEXT');
  const [optionLabels, setOptionLabels] = useState('');
  const [optionColor, setOptionColor] = useState<(typeof OPTION_COLORS)[number]>('gray');
  const [relationTargetId, setRelationTargetId] = useState('');
  const [rollupRelationId, setRollupRelationId] = useState('');
  const [rollupTargetId, setRollupTargetId] = useState('');
  const [formula, setFormula] = useState('0');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(property?.name ?? '');
    setType(property?.type ?? 'TEXT');
    const config = property?.config ?? defaultConfig('TEXT');
    setOptionLabels(
      config.kind === 'select' || config.kind === 'status'
        ? config.options.map((option) => option.label).join(', ')
        : '',
    );
    setOptionColor(
      config.kind === 'select' || config.kind === 'status'
        ? config.options[0]?.color ?? 'gray'
        : 'gray',
    );
    setRelationTargetId(config.kind === 'relation' ? config.targetDatabaseId : '');
    setRollupRelationId(config.kind === 'rollup' ? config.relationPropertyId : '');
    setRollupTargetId(config.kind === 'rollup' ? config.targetPropertyId : '');
    setFormula(config.kind === 'formula' ? config.expression : '0');
  }, [property]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const config = configForForm(
        type,
        property?.config ?? defaultConfig(type),
        optionLabels,
        optionColor,
        relationTargetId,
        rollupRelationId,
        rollupTargetId,
        formula,
      );
      await onSave({
        ...(property ? { id: property.id } : {}),
        name: name.trim(),
        type,
        config,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Property could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--bg-canvas)]/70 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-modal)]"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-primary)]">
              {property ? 'Edit property' : 'Add a property'}
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              Choose a field type and tune how its values appear.
            </p>
          </div>
          <button
            aria-label="Close property settings"
            className="rounded-md px-2 py-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
          Property name
          <input
            className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>

        <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
          Property type
          <select
            className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
            onChange={(event) => setType(event.target.value as PropertyType)}
            value={type}
          >
            {PROPERTY_TYPES.map((propertyType) => (
              <option key={propertyType} value={propertyType}>
                {propertyType.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        {(type === 'SELECT' || type === 'MULTI_SELECT' || type === 'STATUS') && (
          <>
            <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
              Options (comma separated)
              <input
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
                onChange={(event) => setOptionLabels(event.target.value)}
                placeholder="Not started, In progress, Done"
                value={optionLabels}
              />
            </label>
            <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
              New option color
              <select
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
                onChange={(event) =>
                  setOptionColor(event.target.value as (typeof OPTION_COLORS)[number])
                }
                value={optionColor}
              >
                {OPTION_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {type === 'RELATION' && (
          <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
            Target database page id
            <input
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
              onChange={(event) => setRelationTargetId(event.target.value)}
              required
              value={relationTargetId}
            />
          </label>
        )}

        {type === 'ROLLUP' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
              Relation property id
              <input
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
                onChange={(event) => setRollupRelationId(event.target.value)}
                required
                value={rollupRelationId}
              />
            </label>
            <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
              Target property id
              <input
                className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-[var(--ink-primary)]"
                onChange={(event) => setRollupTargetId(event.target.value)}
                required
                value={rollupTargetId}
              />
            </label>
          </div>
        )}

        {type === 'FORMULA' && (
          <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
            Formula
            <input
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-[var(--ink-primary)]"
              onChange={(event) => setFormula(event.target.value)}
              placeholder="{property-id} * 2"
              required
              value={formula}
            />
            <span className="text-xs text-[var(--ink-muted)]">
              Use arithmetic and {`{property-id}`} references.
            </span>
          </label>
        )}

        {error && <p className="text-sm text-[var(--status-danger)]" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md px-3 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? 'Saving...' : 'Save property'}
          </button>
        </div>
      </form>
    </div>
  );
}
