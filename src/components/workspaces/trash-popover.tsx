'use client';

import { Trash2 } from 'lucide-react';

export function TrashPopover(): React.JSX.Element {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]">
        <Trash2 aria-hidden="true" size={15} />
        <span>Trash</span>
      </summary>
      <div className="absolute bottom-9 left-0 z-10 w-64 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-4 text-sm shadow-[var(--shadow-popover)]">
        <p className="font-medium">Recently removed</p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-secondary)]">
          Deleted pages will be collected here. Nothing has been removed from this workspace yet.
        </p>
      </div>
    </details>
  );
}
