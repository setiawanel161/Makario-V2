'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { z } from 'zod';

const searchResultSchema = z.object({
  type: z.enum(['page', 'block']),
  id: z.string(),
  pageId: z.string().optional(),
  title: z.string(),
  icon: z.string().nullable().optional(),
  isDatabase: z.boolean().optional(),
  snippet: z.string().optional(),
});
const searchResponseSchema = z.object({ results: z.array(searchResultSchema) });
type SearchResult = z.infer<typeof searchResultSchema>;

export function QuickSearchModal({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/workspaces/${encodeURIComponent(workspaceId)}/search?q=${encodeURIComponent(query.trim())}`,
            { signal: controller.signal, cache: 'no-store' },
          );
          if (!response.ok) throw new Error('Search is temporarily unavailable.');
          const parsed = searchResponseSchema.safeParse(await response.json());
          if (!parsed.success) throw new Error('Search returned an unexpected response.');
          setResults(parsed.data.results);
          setError(null);
        } catch (caughtError) {
          if (!controller.signal.aborted) {
            setError(caughtError instanceof Error ? caughtError.message : 'Search failed.');
          }
        }
      })();
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, workspaceId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--ink-primary)]/30 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label="Quick search"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-modal)]"
        role="dialog"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-hairline)] px-4">
          <Search aria-hidden="true" className="text-[var(--ink-muted)]" size={18} />
          <input
            ref={inputRef}
            aria-label="Search pages and content"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ink-muted)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and content..."
            value={query}
          />
          <button
            type="button"
            aria-label="Close search"
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-hover)]"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {error && <p role="alert" className="px-3 py-4 text-sm text-[var(--status-danger)]">{error}</p>}
          {!error && query.trim().length > 0 && results.length === 0 && (
            <p className="px-3 py-4 text-sm text-[var(--ink-secondary)]">No matching pages yet.</p>
          )}
          {results.map((result) => {
            const pageId = result.type === 'page' ? result.id : result.pageId;
            if (pageId === undefined) return null;
            return (
              <Link
                key={`${result.type}:${result.id}`}
                href={`/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(pageId)}`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 hover:bg-[var(--bg-hover)]"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true">{result.icon ?? (result.type === 'block' ? '¶' : '📄')}</span>
                  {result.title}
                  {result.type === 'block' && (
                    <span className="text-xs font-normal text-[var(--ink-muted)]">content match</span>
                  )}
                </span>
                {result.snippet && (
                  <span className="mt-1 block truncate text-xs text-[var(--ink-secondary)]">
                    {result.snippet}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <p className="border-t border-[var(--border-hairline)] px-4 py-2 text-[11px] text-[var(--ink-muted)]">
          Search across pages and block content
        </p>
      </section>
    </div>
  );
}
