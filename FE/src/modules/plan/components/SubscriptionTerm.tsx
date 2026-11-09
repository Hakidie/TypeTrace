import { useState } from 'react';
import type { SubscriptionRow } from '../types/plan.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The middle of a subscription card, 61px high like the speed line of a session: a Premium row draws its term as a bar filled up to today
 * (full once the term is over) with its length under it; a Free row has no term, so only a dashed line shows, with no words.
 */
export const SubscriptionTerm = ({ row }: { row: Pick<SubscriptionRow, 'plan' | 'startsAt' | 'expiresAt'> }) => {
  // Today, read once when the card appears (a render must not read the clock).
  const [now] = useState(() => Date.now());
  if (row.plan !== 'premium' || !row.expiresAt) {
    return (
      <div className="flex h-[61px] flex-col justify-center" role="img" aria-label="No term">
        <div className="border-t-2 border-dashed border-primary/40" />
      </div>
    );
  }
  const start = new Date(row.startsAt).getTime();
  const end = new Date(row.expiresAt).getTime();
  const days = Math.max(1, Math.round((end - start) / DAY_MS));
  const done = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  return (
    <div className="flex h-[61px] flex-col justify-center gap-2" role="img" aria-label={`Premium term of ${days} days, ${Math.round(done * 100)}% passed`}>
      <div className="h-2 bg-primary/20">
        <div className="h-full bg-primary" style={{ width: `${done * 100}%` }} />
      </div>
      <p className="text-center text-base text-primary/70">{`${days}-day term`}</p>
    </div>
  );
};
