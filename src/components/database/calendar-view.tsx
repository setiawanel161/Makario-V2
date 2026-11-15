'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DatabasePropertyData, DatabaseRowData } from './database-types';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CalendarView({
  property,
  rows,
}: {
  property: DatabasePropertyData | null;
  rows: DatabaseRowData[];
}): React.JSX.Element {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const dates = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  if (property === null || property.type !== 'DATE') {
    return (
      <p className="rounded-lg border border-[var(--border-hairline)] p-6 text-sm text-[var(--ink-secondary)]">
        Choose a Date property to place database rows on the calendar.
      </p>
    );
  }
  const rowsByDate = new Map<string, DatabaseRowData[]>();
  for (const row of rows) {
    const value = row.properties[property.id];
    if (typeof value !== 'string' || value.length < 10) continue;
    const key = value.slice(0, 10);
    const datedRows = rowsByDate.get(key) ?? [];
    datedRows.push(row);
    rowsByDate.set(key, datedRows);
  }

  return (
    <section aria-label="Monthly database calendar" className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-1">
          <button
            aria-label="Previous month"
            className="rounded-md p-2 hover:bg-[var(--bg-hover)]"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button
            aria-label="Next month"
            className="rounded-md p-2 hover:bg-[var(--bg-hover)]"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </header>
      <div className="grid grid-cols-7 border-l border-t border-[var(--border-hairline)]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            className="border-b border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)] px-2 py-2 text-xs font-medium text-[var(--ink-secondary)]"
            key={day}
          >
            {day}
          </div>
        ))}
        {dates.map((date) => {
          const dateRows = rowsByDate.get(dateKey(date)) ?? [];
          const inMonth = date.getMonth() === month.getMonth();
          return (
            <div
              className={`min-h-24 border-b border-r border-[var(--border-hairline)] p-2 ${
                inMonth ? 'bg-[var(--bg-canvas)]' : 'bg-[var(--bg-sidebar)] text-[var(--ink-muted)]'
              }`}
              key={dateKey(date)}
            >
              <span className="text-xs">{date.getDate()}</span>
              <ul className="mt-1 space-y-1">
                {dateRows.map((row) => (
                  <li
                    className="truncate rounded-sm bg-[var(--bg-selected)] px-1.5 py-1 text-xs text-[var(--ink-primary)]"
                    key={row.id}
                    title={row.title}
                  >
                    {row.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
