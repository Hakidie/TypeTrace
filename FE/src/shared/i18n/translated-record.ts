import { i18n } from './i18n';

/**
 * A `Record` of names whose values are read in the language of the interface at the moment they are read (SCRUM-330): for the
 * label maps of a module (`errorLabels`, `modeLabels`) that many components index without a hook. The pages are drawn again
 * when the language changes (`AppLayout` keys its page by language), so what they read is always the current one.
 */
export const translatedRecord = <K extends string>(keys: readonly K[], keyOf: (key: K) => string): Record<K, string> => {
  const record = {} as Record<K, string>;
  for (const key of keys) Object.defineProperty(record, key, { enumerable: true, get: () => i18n.t(keyOf(key)) });
  return record;
};
