// Calendar days (`YYYY-MM-DD`) in a time zone, for the learner's activity: their days are days in their own zone
// (`User.settings.timezone`), not UTC days.

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed three-letter names: `toLocaleDateString` gives "Sept" for September in some locales.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The calendar day (`YYYY-MM-DD`) of `date` in the IANA `timeZone` (e.g. `Asia/Ho_Chi_Minh`). Without a zone, or with
 * one this browser does not know, the UTC day.
 */
export const dateKeyIn = (date: Date, timeZone?: string) => {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      // An unknown zone: the UTC day below.
    }
  }
  return date.toISOString().slice(0, 10);
};

/** The day `days` days after `key` (before it when negative), e.g. `addDays('2026-03-01', -1)` is `2026-02-28`. */
export const addDays = (key: string, days: number) => new Date(Date.parse(key) + days * DAY_MS).toISOString().slice(0, 10);

/** A day in words, e.g. `Tue, 27 Oct 2026` for `2026-10-27`. */
export const dayInWords = (key: string) => {
  const date = new Date(Date.parse(key));
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

/** The browser's time zone (an IANA name), or `''` when it does not say. */
export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
};

/**
 * Whether `zone` and `other` name the same zone for this browser. The server keeps a zone as it was sent, but browsers
 * do not all write it the same way: Chrome says `Asia/Saigon` where the account's default is `Asia/Ho_Chi_Minh`.
 */
export const sameTimeZone = (zone: string, other?: string) => {
  if (!other) return false;
  if (zone === other) return true;
  try {
    const canonical = (name: string) => new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone;
    return canonical(zone) === canonical(other);
  } catch {
    return false;
  }
};
