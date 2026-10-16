import { Types } from 'mongoose';
import { PassageModel } from '../models/passage.model';
import { notFound } from '../utils/app-error';

/** What a learner may see of a passage. Never `owner`: only admins may know who created a passage. */
export interface PublicPassage {
  _id: Types.ObjectId;
  title: string;
  content: string;
  source: string;
  ownerName: string;
  wordCount: number;
}

const publicFields = { title: 1, content: 1, source: 1, ownerName: 1, wordCount: 1 } as const;

/**
 * A random active passage that also matches `match`; `undefined` when there is none. `aggregate()` skips `toJSON`, so
 * `fields` must list public fields only. The default is what a typing session needs.
 */
export const samplePassage = async <T = { _id: Types.ObjectId; content: string }>(
  match: Record<string, unknown>,
  fields: Record<string, 1> = { content: 1 }
) => {
  const [random] = await PassageModel.aggregate<T>([
    { $match: { status: 'active', ...match } },
    { $sample: { size: 1 } },
    { $project: fields }
  ]);
  return random;
};

/** The passage of the placement test: one of the active placement passages (`isPlacement`), at random. */
export const getPlacementPassage = async () => {
  const passage = await samplePassage<PublicPassage>({ isPlacement: true }, publicFields);
  if (!passage) throw notFound('No placement passage');
  return passage;
};
