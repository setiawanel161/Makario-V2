import { Award, Flame } from 'lucide-react';

export interface BuilderStatus {
  totalXp: number;
  tier: 'APPRENTICE_SCRIBE' | 'SYSTEMS_ARCHITECT' | 'GRANDMASTER_WEAVER';
  currentStreak: number;
  gamificationEnabled: boolean;
}

const TIER_DETAILS: Record<BuilderStatus['tier'], { name: string; ceiling: number }> = {
  APPRENTICE_SCRIBE: { name: 'Apprentice Scribe', ceiling: 500 },
  SYSTEMS_ARCHITECT: { name: 'Systems Architect', ceiling: 2500 },
  GRANDMASTER_WEAVER: { name: 'Grandmaster Weaver', ceiling: 2500 },
};

export function BuilderStatusWidget({
  status,
}: {
  status: BuilderStatus;
}): React.JSX.Element | null {
  if (!status.gamificationEnabled) {
    return null;
  }

  const details = TIER_DETAILS[status.tier];
  const progressStart = status.tier === 'SYSTEMS_ARCHITECT' ? 500 : 0;
  const progress =
    status.tier === 'GRANDMASTER_WEAVER'
      ? 100
      : Math.min(
          100,
          Math.max(0, ((status.totalXp - progressStart) / (details.ceiling - progressStart)) * 100),
        );

  return (
    <details className="m-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-2.5">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Award aria-hidden="true" size={17} className="shrink-0 text-[var(--accent-primary)]" />
            <span className="truncate text-xs font-semibold">{details.name}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-xs text-[var(--ink-secondary)]">
            <Flame aria-hidden="true" size={12} />
            {status.currentStreak}d
          </span>
        </div>
        <div
          aria-label={`${status.totalXp} XP`}
          className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-hover)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-[var(--accent-primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
          {status.totalXp.toLocaleString()} XP
          {status.tier !== 'GRANDMASTER_WEAVER' &&
            ` · ${Math.max(0, details.ceiling - status.totalXp).toLocaleString()} to next tier`}
        </p>
      </summary>
      <p className="mt-2 border-t border-[var(--border-hairline)] pt-2 text-xs leading-5 text-[var(--ink-secondary)]">
        Keep shaping your workspace; every small step adds to your Builder journey.
      </p>
    </details>
  );
}
