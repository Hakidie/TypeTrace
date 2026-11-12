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

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall clock of `date` in `timeZone`, read as if it were UTC (so `local - date` is the zone's offset). */
const localAsUtc = (date: Date, timeZone: string) => {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    if (offsetFormatters.size >= MAX_FORMATTERS) offsetFormatters.clear();
    offsetFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'), date.getUTCMilliseconds());
};

/**
 * `date` plus `months` calendar months in `timeZone`: the same time of day, and the last day of the month when the target
 * month is shorter (31 Jan + 1 month = 28 or 29 Feb). The zone's offset at `date` is kept for the result, which is exact for
 * zones without daylight saving such as `Asia/Ho_Chi_Minh`.
 */
export const addMonths = (date: Date, months: number, timeZone = 'Asia/Ho_Chi_Minh') => {
  const offset = localAsUtc(date, timeZone) - date.getTime();
  const local = new Date(date.getTime() + offset);
  const total = local.getUTCFullYear() * 12 + local.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = Date.UTC(
    year,
    month,
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds()
  );
  return new Date(target - offset);
};
