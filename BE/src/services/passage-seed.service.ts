import { PassageSeed } from '../data/passages';
import { ownerFieldsFor, PassageModel } from '../models/passage.model';
import { badRequest } from '../utils/app-error';

export interface PassageSeedResult {
  /** Passages that were not in the bank and are now. */
  added: number;
  /** Passages already in the bank (left untouched). */
  skipped: number;
}

/**
 * Adds passages to the bank as TypeTrace's own. Safe to run many times: a passage with the same title is not touched,
 * so an edit or a hidden passage survives. Every passage must name its source.
 */
export const seedPassages = async (list: readonly PassageSeed[]): Promise<PassageSeedResult> => {
  const missing = list.find((passage) => !passage.source?.trim());
  if (missing) throw badRequest(`Passage "${missing.title}" has no source`);

  let added = 0;
  for (const passage of list) {
    if (await PassageModel.exists({ title: passage.title })) continue;
    // create() runs the model hook that computes wordCount and tagCounts.
    await PassageModel.create({ ...passage, ...ownerFieldsFor() });
    added += 1;
  }
  return { added, skipped: list.length - added };
};
