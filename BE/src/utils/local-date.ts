// Calendar days in a learner's own time zone (SCRUM-31: streak, daily mission, profile heatmap). A day is a 'YYYY-MM-DD'
// key: keys sort in date order as plain text, and `addDays` works on the key alone, so neither the server's own time zone
// nor a daylight saving change can move a day.

/**
 * Formatters kept by zone name: making one is slow, and a rebuild formats every counted session. The names come from
 * learners, and `Intl` takes a name in any letter case, so the cache is emptied when it holds `MAX_FORMATTERS`: names
 * sent on purpose cannot make it grow until the server runs out of memory.
 */
export const MAX_FORMATTERS = 100;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws a RangeError for a zone `Intl` does not know. */
const formatterFor = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    if (formatters.size >= MAX_FORMATTERS) formatters.clear();
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/** True when `Intl` knows the zone: an IANA name such as `Asia/Ho_Chi_Minh` (in any case) or `UTC`. */
export const isValidTimeZone = (name: string) => {
  try {
    formatterFor(name);
    return true;
  } catch {
    return false;
  }
};

/** The calendar day of `date` in `timeZone`, as 'YYYY-MM-DD'. Read from the formatted parts, never from a locale string. */
export const localDateKey = (date: Date, timeZone: string) => {
  const parts = formatterFor(timeZone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/** The day `days` after `key` (before it when negative). UTC arithmetic on a date-only value: every day is 24 hours. */
export const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
