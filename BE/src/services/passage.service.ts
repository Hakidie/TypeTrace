import { Types } from 'mongoose';
import { PassageModel } from '../models/passage.model';
import type { SessionMode } from '../models/typing-session.model';
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
 * A random published passage that also matches `match`; `undefined` when there is none. `aggregate()` skips `toJSON`, so
 * `fields` must list public fields only. The default is what a typing session needs.
 */
export const samplePassage = async <T = { _id: Types.ObjectId; content: string }>(
  match: Record<string, unknown>,
  fields: Record<string, 1> = { content: 1 }
) => {
  const [random] = await PassageModel.aggregate<T>([
    { $match: { status: 'published', ...match } },
    { $sample: { size: 1 } },
    { $project: fields }
  ]);
  return random;
};

/** The passage of the placement test: one of the published placement passages (`isPlacement`), at random. */
export const getPlacementPassage = async () => {
  const passage = await samplePassage<PublicPassage>({ isPlacement: true }, publicFields);
  if (!passage) throw notFound('No placement passage');
  return passage;
};

/** One entry of the passage dropdown on the Typing page: no text, no owner. */
export interface PassageOption {
  _id: Types.ObjectId;
  title: string;
  wordCount: number;
}

/**
 * What a learner may pick for a `mode`: published passages only, placement passages for the test and practice ones otherwise.
 * Both are public; in practice the learner's own passages come on top. Drafts and other people's private passages never match.
 */
export const learnerPassageFilter = (userId: string, mode: SessionMode) =>
  mode === 'placement'
    ? { status: 'published' as const, isPlacement: true, visibility: 'public' as const }
    : { status: 'published' as const, isPlacement: false, $or: [{ visibility: 'public' as const }, { owner: userId }] };

/** The passages a learner can choose from for `mode`, by title (Vietnamese order). `.lean()` skips `toJSON`, so the public fields are listed. */
export const listPassageOptions = (userId: string, mode: SessionMode) =>
  PassageModel.find(learnerPassageFilter(userId, mode)).select('title wordCount').sort({ title: 1 }).collation({ locale: 'vi' }).limit(200).lean<PassageOption[]>();
