import { i18n } from '@/shared/i18n/i18n';

/** How much of the term has passed, 0 to 100: none before it starts, all of it once it is over; a term without an end (an open Free row) is full. */
export const termProgress = (startsAt: string, endsAt: string | null, now = Date.now()) => {
  if (!endsAt) return 100;
  const start = new Date(startsAt).getTime();
  const span = new Date(endsAt).getTime() - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / span) * 100)));
};

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (count: number) => i18n.t('store:days', { count });

/** What the tooltip of the bar says: the days left of the term, the days before it starts, that it is over, or that it has no end. */
export const termDaysText = (startsAt: string, endsAt: string | null, now = Date.now()) => {
  if (!endsAt) return i18n.t('store:adminPlans.period.noEnd');
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now < start) return i18n.t('store:adminPlans.period.startsIn', { days: days(Math.ceil((start - now) / DAY_MS)) });
  if (now >= end) return i18n.t('store:adminPlans.period.ended');
  return i18n.t('store:left', { what: days(Math.ceil((end - now) / DAY_MS)) });
};
