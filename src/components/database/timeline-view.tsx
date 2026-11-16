'use client';

import { useMemo, useState } from 'react';
import type { DatabasePropertyData, DatabaseRowData } from './database-types';

interface TimelineItem {
  id: string;
  title: string;
  start: number;
  end: number;
}

function dateValue(value: unknown): number | null {
  if (typeof value !== 'string' || value.length < 10) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function TimelineView({
  properties,
  rows,
}: {
  properties: DatabasePropertyData[];
  rows: DatabaseRowData[];
}): React.JSX.Element {
  const dateProperties = properties.filter((property) => property.type === 'DATE');
  const [startPropertyId, setStartPropertyId] = useState(dateProperties[0]?.id ?? '');
  const [endPropertyId, setEndPropertyId] = useState(
    dateProperties[1]?.id ?? dateProperties[0]?.id ?? '',
  );
  const startProperty =
    dateProperties.find((property) => property.id === startPropertyId) ?? dateProperties[0];
  const endProperty =
    dateProperties.find((property) => property.id === endPropertyId) ?? startProperty;

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (startProperty === undefined) return [];
    return rows.flatMap((row) => {
      const start = dateValue(row.properties[startProperty.id]);
      if (start === null) return [];
      const candidateEnd =
        endProperty === undefined ? null : dateValue(row.properties[endProperty.id]);
      const end = Math.max(start, candidateEnd ?? start);
      return [{ id: row.id, title: row.title, start, end }];
    });
  }, [endProperty, rows, startProperty]);

  if (dateProperties.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border-hairline)] p-6 text-sm text-[var(--ink-secondary)]">
        Add a Date property to schedule rows on the timeline.
      </p>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <section aria-label="Database timeline" className="space-y-3">
        <TimelineControls
          dateProperties={dateProperties}
          endPropertyId={endProperty?.id ?? ''}
          onEndChange={setEndPropertyId}
          onStartChange={setStartPropertyId}
          startPropertyId={startProperty?.id ?? ''}
        />
        <p className="rounded-lg border border-[var(--border-hairline)] p-6 text-sm text-[var(--ink-secondary)]">
          Add dates to database rows to see their timeline.
        </p>
      </section>
    );
  }

  const firstDay = Math.min(...timelineItems.map((item) => item.start));
  const lastDay = Math.max(...timelineItems.map((item) => item.end));
  const span = Math.max(lastDay - firstDay, 86_400_000);

  return (
    <section aria-label="Database timeline" className="space-y-3">
      <TimelineControls
        dateProperties={dateProperties}
        endPropertyId={endProperty?.id ?? ''}
        onEndChange={setEndPropertyId}
        onStartChange={setStartPropertyId}
        startPropertyId={startProperty?.id ?? ''}
      />
      <div className="overflow-x-auto rounded-lg border border-[var(--border-hairline)]">
        <div className="min-w-[640px]">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-sidebar)] px-4 py-2 text-xs text-[var(--ink-secondary)]">
            <span>{formatDate(firstDay)}</span>
            <span>{formatDate(lastDay)}</span>
          </div>
          <ul className="divide-y divide-[var(--border-hairline)]">
            {timelineItems.map((item) => {
              const left = Math.min(((item.start - firstDay) / span) * 100, 99.2);
              const width = Math.min(
                Math.max(((item.end - item.start) / span) * 100, 0.8),
                100 - left,
              );
              return (
                <li
                  className="grid min-h-12 grid-cols-[minmax(9rem,18rem)_1fr] items-center gap-4 px-4 py-2"
                  key={item.id}
                >
                  <span className="truncate text-sm text-[var(--ink-primary)]">{item.title}</span>
                  <div className="relative h-6 rounded-sm bg-[var(--bg-sidebar)]">
                    <div
                      aria-label={`${item.title}: ${formatDate(item.start)} to ${formatDate(item.end)}`}
                      className="absolute top-1 h-4 min-w-2 rounded-sm bg-[var(--accent-primary)]"
                      role="img"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TimelineControls({
  dateProperties,
  startPropertyId,
  endPropertyId,
  onStartChange,
  onEndChange,
}: {
  dateProperties: DatabasePropertyData[];
  startPropertyId: string;
  endPropertyId: string;
  onStartChange: (propertyId: string) => void;
  onEndChange: (propertyId: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-xs text-[var(--ink-secondary)]">
        Timeline start
        <select
          aria-label="Timeline start date"
          className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
          onChange={(event) => onStartChange(event.target.value)}
          value={startPropertyId}
        >
          {dateProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-[var(--ink-secondary)]">
        Timeline end
        <select
          aria-label="Timeline end date"
          className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-sm text-[var(--ink-primary)]"
          onChange={(event) => onEndChange(event.target.value)}
          value={endPropertyId}
        >
          {dateProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
