'use client';

import Image from 'next/image';
import type { JsonValue } from '@/types/workspace';
import type { DatabasePropertyData, DatabaseRowData } from './database-types';

function displayValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
}

export function GalleryView({
  properties,
  rows,
}: {
  properties: DatabasePropertyData[];
  rows: DatabaseRowData[];
}): React.JSX.Element {
  return (
    <section aria-label="Database gallery">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-hairline)] p-6 text-sm text-[var(--ink-secondary)]">
          No pages to display in the gallery yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const cover =
              typeof row.coverUrl === 'string' && /^https?:\/\//i.test(row.coverUrl)
                ? row.coverUrl
                : null;
            return (
              <li
                className="overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-card)]"
                key={row.id}
              >
                {cover ? (
                  <div className="relative h-32">
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      src={cover}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    aria-label="Page preview"
                    className="grid h-32 place-items-center bg-gradient-to-br from-[var(--bg-sidebar)] via-[var(--bg-selected)] to-[var(--bg-hover)]"
                    role="img"
                  >
                    <span className="text-4xl" aria-hidden="true">
                      {row.icon ?? '📄'}
                    </span>
                  </div>
                )}
                <div className="space-y-3 p-3">
                  <h3 className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                    {row.icon && <span className="mr-2">{row.icon}</span>}
                    {row.title}
                  </h3>
                  <dl className="space-y-2">
                    {properties.slice(0, 3).map((property) => {
                      const value = displayValue(row.properties[property.id]);
                      return value ? (
                        <div className="flex items-start justify-between gap-3 text-xs" key={property.id}>
                          <dt className="shrink-0 text-[var(--ink-muted)]">{property.name}</dt>
                          <dd className="truncate text-right text-[var(--ink-secondary)]">{value}</dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
