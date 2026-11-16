'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Database, FileText, Plus } from 'lucide-react';

export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  parentPageId: string | null;
  orderIndex: string;
  isDatabase: boolean;
  isFavorite: boolean;
  isPrivate: boolean;
  revision: string;
  children: PageTreeNode[];
}

interface RecursivePageTreeProps {
  pages: PageTreeNode[];
  workspaceSlug: string;
  onAddPage: (parentPageId: string | null) => Promise<void>;
  depth?: number;
}

export function RecursivePageTree({
  pages,
  workspaceSlug,
  onAddPage,
  depth = 0,
}: RecursivePageTreeProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (pages.length === 0) {
    return <p className="px-2 py-1 text-xs text-[var(--ink-muted)]">Nothing here yet.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {pages.map((page) => {
        const hasChildren = page.children.length > 0;
        const isExpanded = expanded[page.id] ?? true;
        const PageIcon = page.isDatabase ? Database : FileText;
        return (
          <li key={page.id}>
            <div
              className="group flex min-h-8 items-center gap-1 rounded-md pr-1 text-sm hover:bg-[var(--bg-hover)]"
              style={{ paddingLeft: `calc(var(--space-2) + ${depth * 12}px)` }}
            >
              <button
                type="button"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${page.title}`}
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpanded((current) => ({ ...current, [page.id]: !isExpanded }))
                }
                className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] ${
                  hasChildren ? '' : 'invisible'
                }`}
              >
                <ChevronRight
                  aria-hidden="true"
                  size={14}
                  className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'}
                />
              </button>
              <Link
                href={`/${workspaceSlug}/${encodeURIComponent(page.id)}`}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-[var(--ink-primary)]"
                title={page.title}
              >
                {page.icon ? (
                  <span aria-hidden="true" className="w-4 shrink-0 text-center">
                    {page.icon}
                  </span>
                ) : (
                  <PageIcon aria-hidden="true" size={15} className="shrink-0 text-[var(--ink-secondary)]" />
                )}
                <span className="truncate">{page.title}</span>
              </Link>
              <button
                type="button"
                aria-label={`Add child page to ${page.title}`}
                onClick={() => void onAddPage(page.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--ink-muted)] opacity-0 hover:bg-[var(--bg-selected)] hover:text-[var(--accent-primary)] focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Plus aria-hidden="true" size={14} />
              </button>
            </div>
            {hasChildren && isExpanded && (
              <RecursivePageTree
                pages={page.children}
                workspaceSlug={workspaceSlug}
                onAddPage={onAddPage}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
