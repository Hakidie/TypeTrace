import { WordModel, normalizeWord } from '../models/word.model';
import { tagWord } from '../utils/vietnamese-errors';

export interface WordImportResult {
  /** Words that were not in the bank and are now. */
  added: number;
  /** Words that were already in the bank (left untouched). */
  skipped: number;
  /** Empty entries and entries with spaces. */
  invalid: number;
}

/**
 * Adds words to the bank. Safe to run many times: a word that already exists is not touched, so a word an admin
 * hid stays hidden. Entries are normalised (Unicode NFC, lowercase) and duplicates inside `entries` are merged.
 */
export const importWords = async (entries: readonly string[]): Promise<WordImportResult> => {
  const words = new Set<string>();
  let invalid = 0;
  for (const entry of entries) {
    const text = normalizeWord(entry);
    if (!text || /\s/.test(text)) invalid += 1;
    else words.add(text);
  }
  if (words.size === 0) return { added: 0, skipped: 0, invalid };

  // bulkWrite skips the model hooks, so the tags are computed here with the same `tagWord` as the model.
  const result = await WordModel.bulkWrite(
    [...words].map((text) => ({
      updateOne: {
        filter: { text },
        update: { $setOnInsert: { text, tags: tagWord(text), isActive: true } },
        upsert: true
      }
    }))
  );
  return { added: result.upsertedCount, skipped: words.size - result.upsertedCount, invalid };
};
