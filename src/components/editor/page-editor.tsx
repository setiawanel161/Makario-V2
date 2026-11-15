'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/sync/workspace-store';
import type { JsonObject } from '@/types/workspace';
import { BlockEditor } from './block-editor';
import { PageHeader, type EditorPageHeaderData } from './page-header';
import type { EditorBlock } from './editor-utils';

export interface EditorPageData extends EditorPageHeaderData {
  workspaceId: string;
  parentPageId: string | null;
  orderIndex: string;
  isDatabase: boolean;
  isPrivate: boolean;
  revision: string;
  updatedAt: string;
}

export function PageEditor({
  initialPage,
  initialBlocks,
}: {
  initialPage: EditorPageData;
  initialBlocks: EditorBlock[];
}): React.JSX.Element {
  const [page, setPage] = useState(initialPage);
  const store = useWorkspaceStore;

  useEffect(() => {
    store.getState().hydrateEntity('page', {
      id: initialPage.id,
      workspaceId: initialPage.workspaceId,
      updatedAt: initialPage.updatedAt,
      revision: initialPage.revision,
      title: initialPage.title,
      parentPageId: initialPage.parentPageId,
      icon: initialPage.icon,
      coverUrl: initialPage.coverUrl,
      fontFamily: initialPage.fontFamily,
      isFullWidth: initialPage.isFullWidth,
      orderIndex: initialPage.orderIndex,
      isDatabase: initialPage.isDatabase,
      isFavorite: initialPage.isFavorite,
      isPrivate: initialPage.isPrivate,
      isPublished: initialPage.isPublished,
      publicSlug: initialPage.publicSlug,
      fieldTimestamps: {},
    });
  }, [initialPage, store]);

  function updatePage(changes: JsonObject): void {
    const updatedAt = new Date().toISOString();
    setPage((current) => ({ ...current, ...changes, updatedAt }));
    store.getState().applyOptimisticMutation({
      workspaceId: page.workspaceId,
      entityType: 'page',
      entityId: page.id,
      changes,
      updatedAt,
    });
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        page={page}
        onChange={updatePage}
        onPublicationChange={(publication) =>
          setPage((current) => ({ ...current, ...publication }))
        }
      />
      <div
        className={`mx-auto px-6 pb-32 pt-8 ${
          page.isFullWidth ? 'max-w-none' : 'max-w-[800px]'
        }`}
        style={{
          fontFamily:
            page.fontFamily === 'serif'
              ? 'var(--font-serif)'
              : page.fontFamily === 'mono'
                ? 'var(--font-mono)'
                : 'var(--font-sans)',
        }}
      >
        <BlockEditor
          workspaceId={page.workspaceId}
          pageId={page.id}
          initialBlocks={initialBlocks}
        />
      </div>
    </main>
  );
}
