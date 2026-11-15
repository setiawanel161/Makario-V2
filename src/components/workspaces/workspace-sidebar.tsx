'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FilePlus2, Home } from 'lucide-react';
import { z } from 'zod';
import type { BuilderStatus } from './builder-status-widget';
import { BuilderStatusWidget } from './builder-status-widget';
import { RecursivePageTree, type PageTreeNode } from './recursive-page-tree';
import { TrashPopover } from './trash-popover';

const pageTreeNodeSchema: z.ZodType<PageTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    icon: z.string().nullable(),
    parentPageId: z.string().nullable(),
    orderIndex: z.string(),
    isDatabase: z.boolean(),
    isFavorite: z.boolean(),
    isPrivate: z.boolean(),
    revision: z.string(),
    children: z.array(pageTreeNodeSchema),
  }),
);
const treeResponseSchema = z.object({ pages: z.array(pageTreeNodeSchema) });

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSidebarProps {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  builderStatus: BuilderStatus;
}

function WorkspaceSwitcher({
  workspace,
  workspaces,
}: Pick<WorkspaceSidebarProps, 'workspace' | 'workspaces'>): React.JSX.Element {
  const router = useRouter();
  return (
    <label className="block">
      <span className="sr-only">Switch workspace</span>
      <select
        aria-label="Switch workspace"
        value={workspace.slug}
        onChange={(event) => router.push(`/${encodeURIComponent(event.target.value)}`)}
        className="w-full cursor-pointer truncate rounded-md border border-transparent bg-transparent px-2 py-2 text-sm font-semibold hover:bg-[var(--bg-hover)] focus:border-[var(--border-focus)]"
      >
        {workspaces.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PageSection({
  title,
  pages,
  workspaceSlug,
  onAddPage,
  canAddRoot = false,
}: {
  title: string;
  pages: PageTreeNode[];
  workspaceSlug: string;
  onAddPage: (parentPageId: string | null) => Promise<void>;
  canAddRoot?: boolean;
}): React.JSX.Element {
  return (
    <section className="mt-5">
      <div className="mb-1 flex items-center justify-between px-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          {title}
        </h2>
        {canAddRoot && (
          <button
            type="button"
            aria-label="Add page"
            onClick={() => void onAddPage(null)}
            className="grid h-6 w-6 place-items-center rounded text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
          >
            <FilePlus2 aria-hidden="true" size={14} />
          </button>
        )}
      </div>
      <RecursivePageTree
        pages={pages}
        workspaceSlug={workspaceSlug}
        onAddPage={onAddPage}
      />
    </section>
  );
}

function filterPageTree(
  pages: PageTreeNode[],
  matches: (page: PageTreeNode) => boolean,
): PageTreeNode[] {
  return pages.flatMap((page) => {
    const children = filterPageTree(page.children, matches);
    if (matches(page)) {
      return [{ ...page, children }];
    }
    return children;
  });
}

export function WorkspaceSidebar({
  workspace,
  workspaces,
  builderStatus,
}: WorkspaceSidebarProps): React.JSX.Element {
  const [pages, setPages] = useState<PageTreeNode[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/pages/tree`);
    const payload: unknown = await response.json();
    const parsed = treeResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success) {
      throw new Error(
        !parsed.success
          ? 'The page list could not be read.'
          : 'The page list could not be loaded.',
      );
    }
    setPages(parsed.data.pages);
  }, [workspace.id]);

  useEffect(() => {
    let active = true;
    void loadPages().catch((caughtError: unknown) => {
      if (active) {
        setError(caughtError instanceof Error ? caughtError.message : 'The page list could not load.');
      }
    });
    return () => {
      active = false;
    };
  }, [loadPages]);

  async function addPage(parentPageId: string | null): Promise<void> {
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/pages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', parentPageId }),
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String(body.error)
            : 'Could not add a page.';
        setError(message);
        return;
      }
      await loadPages();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not add a page.');
    }
  }

  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)] py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="rounded-md p-2 text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </aside>
    );
  }

  const favorites = filterPageTree(pages, (page) => page.isFavorite);
  const privatePages = filterPageTree(pages, (page) => page.isPrivate);
  const sharedPages = filterPageTree(pages, (page) => !page.isPrivate);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)]">
      <div className="flex items-center gap-1 px-2 pt-2">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-hover)]"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
      </div>

      <nav aria-label="Workspace pages" className="flex-1 overflow-y-auto px-2 pb-4 pt-3">
        <Link
          href={`/${workspace.slug}`}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
        >
          <Home aria-hidden="true" size={15} />
          <span>Home</span>
        </Link>
        {error && (
          <p role="alert" className="px-2 py-2 text-xs text-[var(--status-danger)]">
            {error}
          </p>
        )}
        <PageSection
          title="Favorites"
          pages={favorites}
          workspaceSlug={workspace.slug}
          onAddPage={addPage}
        />
        <PageSection
          title="Private"
          pages={privatePages}
          workspaceSlug={workspace.slug}
          onAddPage={addPage}
        />
        <PageSection
          title="Shared"
          pages={sharedPages}
          workspaceSlug={workspace.slug}
          onAddPage={addPage}
          canAddRoot
        />
        <div className="mt-5 border-t border-[var(--border-hairline)] pt-2">
          <TrashPopover />
        </div>
      </nav>

      <BuilderStatusWidget status={builderStatus} />
    </aside>
  );
}
