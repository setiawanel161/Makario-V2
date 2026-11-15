'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WorkspaceChoice {
  id: string;
  name: string;
  slug: string;
}

export function DuplicateTemplateButton({
  pageId,
}: {
  pageId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [isChoosing, setIsChoosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspaces(): Promise<void> {
    setError(null);
    try {
      const response = await fetch('/api/workspaces');
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok) {
        setError('Workspaces could not be loaded. Please try again.');
        return;
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('workspaces' in result) ||
        !Array.isArray(result.workspaces)
      ) {
        setError('The workspace response was invalid.');
        return;
      }
      const choices = result.workspaces.filter(
        (workspace): workspace is WorkspaceChoice =>
          typeof workspace === 'object' &&
          workspace !== null &&
          'id' in workspace &&
          typeof workspace.id === 'string' &&
          'name' in workspace &&
          typeof workspace.name === 'string' &&
          'slug' in workspace &&
          typeof workspace.slug === 'string',
      );
      setWorkspaces(choices);
      setWorkspaceId(choices[0]?.id ?? '');
      setIsChoosing(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? 'Workspaces could not be loaded. Please try again.'
          : 'An unexpected error occurred while loading workspaces.',
      );
    }
  }

  async function duplicate(): Promise<void> {
    if (!workspaceId) {
      setError('Create or join a workspace before copying this template.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/duplicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'The template could not be copied.';
        setError(message);
        return;
      }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('pageId' in result) ||
        typeof result.pageId !== 'string'
      ) {
        throw new Error('The duplicate response did not include a page id.');
      }
      const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
      if (selectedWorkspace === undefined) {
        throw new Error('The selected workspace is no longer available.');
      }
      router.push(`/${encodeURIComponent(selectedWorkspace.slug)}/${result.pageId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The template could not be copied.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {!isChoosing ? (
        <button
          className="rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] hover:bg-[var(--accent-primary-hover)]"
          onClick={() => void loadWorkspaces()}
          type="button"
        >
          Duplicate as Template
        </button>
      ) : workspaces.length === 0 ? (
        <Link
          className="inline-flex rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)]"
          href="/onboarding"
        >
          Create a workspace to copy this
        </Link>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm text-[var(--ink-secondary)]">
            Copy into
            <select
              className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--ink-primary)]"
              onChange={(event) => setWorkspaceId(event.target.value)}
              value={workspaceId}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void duplicate()}
            type="button"
          >
            {isSubmitting ? 'Copying…' : 'Copy template'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-[var(--status-danger)]" role="alert">{error}</p>}
    </div>
  );
}
