'use client';

import type { BlockType } from '@prisma/client';

export interface SlashCommand {
  type: BlockType;
  label: string;
  description: string;
  shortcut?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { type: 'PARAGRAPH', label: 'Text', description: 'Start with plain text' },
  { type: 'HEADING_1', label: 'Heading 1', description: 'Large section heading', shortcut: '# ' },
  { type: 'HEADING_2', label: 'Heading 2', description: 'Medium section heading', shortcut: '## ' },
  { type: 'HEADING_3', label: 'Heading 3', description: 'Small section heading', shortcut: '### ' },
  { type: 'TODO', label: 'To-do', description: 'Track a task', shortcut: '[] ' },
  { type: 'BULLETED_LIST', label: 'Bulleted list', description: 'Make a simple list', shortcut: '- ' },
  { type: 'NUMBERED_LIST', label: 'Numbered list', description: 'Create a numbered list', shortcut: '1. ' },
  { type: 'TOGGLE', label: 'Toggle', description: 'Keep details tucked away' },
  { type: 'CALLOUT', label: 'Callout', description: 'Highlight a useful note' },
  { type: 'CODE', label: 'Code', description: 'Add a code snippet', shortcut: '``` ' },
  { type: 'QUOTE', label: 'Quote', description: 'Set apart a quotation', shortcut: '> ' },
  { type: 'DIVIDER', label: 'Divider', description: 'Separate sections' },
  { type: 'IMAGE', label: 'Image', description: 'Add an image and caption' },
  { type: 'COLUMN_LIST', label: 'Columns', description: 'Create a column layout' },
  { type: 'COLUMN', label: 'Column', description: 'Add a column container' },
  { type: 'CHILD_DATABASE', label: 'Database', description: 'Embed a workspace database' },
  { type: 'CHART_BLOCK', label: 'Chart', description: 'Visualize database values' },
  { type: 'SYNCED_BLOCK', label: 'Synced block', description: 'Reuse content from another page' },
];

export function SlashCommandMenu({
  query,
  activeIndex,
  onSelect,
}: {
  query: string;
  activeIndex: number;
  onSelect: (type: BlockType) => void;
}): React.JSX.Element {
  const normalizedQuery = query.trim().toLowerCase();
  const commands = SLASH_COMMANDS.filter((command) =>
    `${command.label} ${command.description}`.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div
      aria-label="Block commands"
      className="absolute left-11 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-popover)]"
      role="listbox"
    >
      {commands.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[var(--ink-muted)]">No matching block types.</p>
      ) : (
        commands.map((command, index) => (
          <button
            key={command.type}
            aria-selected={index === activeIndex}
            className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${
              index === activeIndex ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'
            }`}
            onClick={() => onSelect(command.type)}
            role="option"
            type="button"
          >
            <span>
              <span className="block text-sm font-medium">{command.label}</span>
              <span className="block text-xs text-[var(--ink-muted)]">{command.description}</span>
            </span>
            {command.shortcut && (
              <kbd className="shrink-0 rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--ink-secondary)]">
                {command.shortcut}
              </kbd>
            )}
          </button>
        ))
      )}
    </div>
  );
}
