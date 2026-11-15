'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

const awardsSchema = z.array(
  z.object({
    actionType: z.string(),
    xpDelta: z.number().int().positive(),
    referenceId: z.string(),
  }),
);

export function XpToastNotification({ enabled }: { enabled: boolean }): React.JSX.Element | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAward = (event: Event) => {
      const parsed = awardsSchema.safeParse(
        (event as CustomEvent<unknown>).detail,
      );
      if (!parsed.success || parsed.data.length === 0) return;
      const xp = parsed.data.reduce((total, award) => total + award.xpDelta, 0);
      setMessage(`+${xp} XP earned`);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2600);
    };

    window.addEventListener('makario:xp-awarded', onAward);
    return () => {
      window.removeEventListener('makario:xp-awarded', onAward);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled]);

  if (!enabled || message === null) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--accent-primary)] shadow-[var(--shadow-popover)]"
      role="status"
    >
      {message}
    </div>
  );
}
