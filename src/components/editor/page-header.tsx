'use client';

import { useState } from 'react';
import { Heart, Share2, Type } from 'lucide-react';
import { z } from 'zod';
import type { JsonObject } from '@/types/workspace';

const publishResponseSchema = z.object({
  isPublished: z.boolean(),
  publicSlug: z.string().nullable(),
});

export interface EditorPageHeaderData {
  id: string;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  fontFamily: string;
  isFullWidth: boolean;
  isFavorite: boolean;
  isPrivate: boolean;
  isPublished: boolean;
  publicSlug: string | null;
}

const PAGE_ICONS = ['📄', '📝', '📚', '💡', '🎯', '🌱', '🧭', '✨'];

export function PageHeader({
  page,
  onChange,
  onPublicationChange,
}: {
  page: EditorPageHeaderData;
  onChange: (changes: JsonObject) => void;
  onPublicationChange: (state: { isPublished: boolean; publicSlug: string | null }) => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(page.title);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function setPublished(isPublished: boolean): Promise<void> {
    setBusy(true);
    setShareError(null);
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(page.id)}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      });
      const parsed = publishResponseSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) {
        throw new Error(
          !parsed.success
            ? 'The publication response was invalid.'
            : 'This page could not be published.',
        );
      }
      onPublicationChange(parsed.data);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'This page could not be published.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(): Promise<void> {
    if (page.publicSlug === null) return;
    const url = `${window.location.origin}/p/${encodeURIComponent(page.publicSlug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setShareError('Clipboard access is unavailable. You can copy the link from the field.');
    }
  }

  const hasCover = page.coverUrl !== null;
  const fontFamily =
    page.fontFamily === 'serif'
      ? 'var(--font-serif)'
      : page.fontFamily === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-sans)';

  return (
    <header className="relative" style={{ fontFamily }}>
      {hasCover && (
        <div
          aria-label="Page cover"
          className="h-40 bg-gradient-to-r from-[var(--bg-sidebar)] via-[var(--bg-selected)] to-[var(--bg-hover)]"
          role="img"
        />
      )}
      <div className={`mx-auto flex ${page.isFullWidth ? 'max-w-none' : 'max-w-[800px]'} flex-col px-6 ${hasCover ? '-mt-5' : 'pt-7'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`page-icon-${page.id}`}>Page icon</label>
            <select
              id={`page-icon-${page.id}`}
              aria-label="Choose page icon"
              className="h-9 w-12 cursor-pointer rounded-md border border-transparent bg-transparent text-lg hover:bg-[var(--bg-hover)]"
              onChange={(event) => onChange({ icon: event.target.value || null })}
              value={page.icon ?? ''}
            >
              <option value="">＋</option>
              {PAGE_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </select>
            <button
              type="button"
              aria-pressed={hasCover}
              onClick={() => onChange({ coverUrl: hasCover ? null : 'builtin:calm' })}
              className="rounded-md px-2.5 py-2 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
            >
              {hasCover ? 'Hide cover' : 'Add cover'}
            </button>
            <label className="sr-only" htmlFor={`page-font-${page.id}`}>Page font</label>
            <span className="ml-1 inline-flex items-center gap-1 text-[var(--ink-muted)]">
              <Type aria-hidden="true" size={14} />
              <select
                id={`page-font-${page.id}`}
                aria-label="Page font"
                className="rounded-md border border-transparent bg-transparent px-1 py-2 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
                onChange={(event) => onChange({ fontFamily: event.target.value })}
                value={page.fontFamily}
              >
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
              </select>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={page.isFavorite}
              aria-label={page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => onChange({ isFavorite: !page.isFavorite })}
              className={`rounded-md p-2 hover:bg-[var(--bg-hover)] ${page.isFavorite ? 'text-[var(--status-danger)]' : 'text-[var(--ink-muted)]'}`}
            >
              <Heart aria-hidden="true" fill={page.isFavorite ? 'currentColor' : 'none'} size={16} />
            </button>
            <button
              type="button"
              aria-expanded={shareOpen}
              onClick={() => setShareOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-hover)]"
            >
              <Share2 aria-hidden="true" size={14} />
              Share
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]">
              <input
                aria-label="Full width"
                checked={page.isFullWidth}
                onChange={(event) => onChange({ isFullWidth: event.target.checked })}
                type="checkbox"
              />
              Full width
            </label>
          </div>
        </div>
        <input
          aria-label="Page title"
          className="mt-5 w-full border-0 bg-transparent font-[inherit] text-[length:var(--text-page-title)] font-bold leading-[var(--leading-page-title)] tracking-[var(--tracking-page-title)] text-[var(--ink-primary)] outline-none placeholder:text-[var(--ink-muted)]"
          onBlur={() => {
            const nextTitle = title.trim() || 'Untitled';
            setTitle(nextTitle);
            if (nextTitle !== page.title) onChange({ title: nextTitle });
          }}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          placeholder="Untitled"
          value={title}
        />
      </div>
      {shareOpen && (
        <section
          aria-label="Share page"
          className="absolute right-6 top-14 z-40 w-80 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-popover)]"
          role="dialog"
        >
          <h2 className="text-sm font-semibold">Share to the web</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-secondary)]">
            A public link shows this page and its active blocks. Private pages cannot be published.
          </p>
          {page.isPrivate ? (
            <p className="mt-3 rounded-md bg-[var(--bg-hover)] px-3 py-2 text-xs text-[var(--ink-secondary)]">
              Private pages cannot be published to the web.
            </p>
          ) : page.isPublished && page.publicSlug ? (
            <div className="mt-3 space-y-2">
              <input
                aria-label="Public page link"
                className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-2 text-xs"
                readOnly
                value={`/p/${page.publicSlug}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-[var(--bg-canvas)] hover:bg-[var(--accent-primary-hover)]"
                  onClick={() => void copyLink()}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border-hairline)] px-3 py-2 text-xs hover:bg-[var(--bg-hover)]"
                  disabled={busy}
                  onClick={() => void setPublished(false)}
                >
                  Unpublish
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 w-full rounded-md bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-[var(--bg-canvas)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
              disabled={busy}
              onClick={() => void setPublished(true)}
            >
              {busy ? 'Publishing…' : 'Publish page'}
            </button>
          )}
          {shareError && <p role="alert" className="mt-2 text-xs text-[var(--status-danger)]">{shareError}</p>}
        </section>
      )}
    </header>
  );
}
