'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, BriefcaseBusiness, UserRound } from 'lucide-react';

const PRESETS = [
  {
    key: 'PERSONAL',
    name: 'Personal',
    description: 'A calm space for notes, plans, and the things you want to remember.',
    icon: UserRound,
  },
  {
    key: 'TEAM',
    name: 'Team',
    description: 'Bring projects, meeting notes, and shared decisions together.',
    icon: BriefcaseBusiness,
  },
  {
    key: 'SCHOOL',
    name: 'School',
    description: 'Keep courses, assignments, and study sessions within reach.',
    icon: BookOpen,
  },
] as const;

export function WorkspaceOnboarding(): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState('');
  const [presetKey, setPresetKey] = useState<(typeof PRESETS)[number]['key']>('PERSONAL');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createWorkspace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, presetKey }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== 'object' || result === null || !('workspace' in result)) {
        const message =
          typeof result === 'object' && result !== null && 'error' in result
            ? String(result.error)
            : 'Could not create that workspace. Please try again.';
        throw new Error(message);
      }
      const workspace = result.workspace;
      if (typeof workspace !== 'object' || workspace === null || !('slug' in workspace)) {
        throw new Error('The server returned an invalid workspace response.');
      }
      router.push(`/${String(workspace.slug)}`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Could not create that workspace.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
      <form
        onSubmit={createWorkspace}
        className="w-full max-w-3xl rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-modal)] sm:p-8"
      >
        <p className="text-sm font-medium text-[var(--accent-primary)]">A fresh place to begin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Choose a starting shape. You can rename, rearrange, and make it your own later.
        </p>

        <label className="mt-6 block text-sm font-medium" htmlFor="workspace-name">
          Workspace name
        </label>
        <input
          id="workspace-name"
          className="mt-2 w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="For example, Studio North"
          required
        />

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Pick a starter layout</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {PRESETS.map(({ key, name: presetName, description, icon: Icon }) => (
              <label
                key={key}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  presetKey === key
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-selected)]'
                    : 'border-[var(--border-hairline)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="preset"
                  value={key}
                  checked={presetKey === key}
                  onChange={() => setPresetKey(key)}
                />
                <Icon aria-hidden="true" size={20} className="text-[var(--accent-primary)]" />
                <span className="mt-3 block text-sm font-semibold">{presetName}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--ink-secondary)]">
                  {description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--status-danger)]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting || name.trim().length === 0}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Preparing your space…' : 'Create workspace'}
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </form>
    </main>
  );
}
