import type { QueryFilter, Types } from 'mongoose';
import {
  MAX_USER_PASSAGES,
  ownerFieldsFor,
  PassageDocument,
  PassageModel,
  USER_PASSAGE_SOURCE
} from '../models/passage.model';
import type { SessionMode } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { badRequest, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { titleFromContent, titleSearchPattern } from '../utils/passage-text';
import { CreatePassageInput, ListPassagesQuery } from '../validators/passage.validator';

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

/**
 * What a learner may pick for a `mode`: published passages only, placement passages for the test and practice ones otherwise.
 * Both are public; in practice the learner's own passages come on top. Drafts and other people's private passages never match.
 */
export const learnerPassageFilter = (userId: string, mode: SessionMode) =>
  mode === 'placement'
    ? { status: 'published' as const, isPlacement: true, visibility: 'public' as const }
    : { status: 'published' as const, isPlacement: false, $or: [{ visibility: 'public' as const }, { owner: userId }] };

/**
 * What a learner gets for one passage of the list: no text, and never `owner`. Their own passages are the `private`
 * ones, since a learner never gets anyone else's private passage.
 */
const listFields = 'title wordCount ownerName visibility createdAt';

const toListItem = ({ _id, title, wordCount, ownerName, visibility, createdAt }: PassageDocument) => ({
  _id,
  title,
  wordCount,
  ownerName,
  visibility,
  createdAt
});

/** The learner's own passages: the only ones they may delete. Another user's passage, or a public one, answers 404. */
const ownedBy = (userId: string, id?: string) => ({ ...(id ? { _id: id } : {}), owner: userId, visibility: 'private' as const });

/**
 * How many own passages the learner can see and type (the list with `visibility=private`): the ones the limit counts,
 * so an own passage an admin archived does not take a place.
 */
const countUsableOwnPassages = (userId: string) =>
  PassageModel.countDocuments({ ...ownedBy(userId), status: 'published', isPlacement: false });

const tooManyPassages = () => badRequest(`You can have at most ${MAX_USER_PASSAGES} passages`);

/**
 * The passages a learner can choose from for `mode` (`learnerPassageFilter`), one page at a time. `q` searches the
 * title, accents optional (`titleSearchPattern`); `visibility` keeps only their own passages (`private`) or only
 * TypeTrace's (`public`). Titles sort in Vietnamese order.
 */
export const listPassages = (userId: string, { mode, q, visibility, ...pagination }: ListPassagesQuery) => {
  const conditions: QueryFilter<PassageDocument>[] = [learnerPassageFilter(userId, mode)];
  if (visibility) conditions.push({ visibility });
  if (q) conditions.push({ title: titleSearchPattern(q) });
  return paginate(PassageModel, { $and: conditions }, pagination, { select: listFields, collation: { locale: 'vi' } });
};

/**
 * The passage creations still running in this server, per learner. Each one waits for the one before, so requests
 * sent at the same time (a script, two tabs) cannot all see the same last free place.
 */
const creations = new Map<string, Promise<void>>();

const oneAtATime = <T>(userId: string, task: () => Promise<T>) => {
  const result = (creations.get(userId) ?? Promise.resolve()).then(task);
  // The next creation waits for this one, whether it worked or not; the last one removes the entry.
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  creations.set(userId, settled);
  void settled.then(() => {
    if (creations.get(userId) === settled) creations.delete(userId);
  });
  return result;
};

const saveOwnPassage = async (userId: string, { title, content }: CreatePassageInput) => {
  const author = await UserModel.findById(userId).select('role displayName email');
  if (!author) throw notFound('User not found');
  if ((await countUsableOwnPassages(userId)) >= MAX_USER_PASSAGES) throw tooManyPassages();

  // create() runs the model hook that counts the words and the error tags.
  const passage = await PassageModel.create({
    title: title || titleFromContent(content),
    content,
    source: USER_PASSAGE_SOURCE,
    ...ownerFieldsFor({ id: userId, role: author.role, displayName: author.displayName, email: author.email }),
    visibility: 'private',
    status: 'published',
    isPlacement: false
  });
  // `oneAtATime` only covers this server: when several servers run, requests sent at the same time can all pass the
  // check above. Count again, and take this one back if it went over.
  if ((await countUsableOwnPassages(userId)) > MAX_USER_PASSAGES) {
    await passage.deleteOne();
    throw tooManyPassages();
  }
  return toListItem(passage);
};

/**
 * Saves a passage the learner pasted (already cleaned by the validator): private, so only they (and admins) see it,
 * published at once so it can be typed, never a placement passage. At most `MAX_USER_PASSAGES` per learner, saved one
 * at a time per learner.
 */
export const createPassage = (userId: string, input: CreatePassageInput) =>
  oneAtATime(userId, () => saveOwnPassage(userId, input));

/** Deletes the learner's own passage for good. Their typing sessions keep their copy of its words and title. */
export const deletePassage = async (userId: string, id: string) => {
  const passage = await PassageModel.findOneAndDelete(ownedBy(userId, id));
  if (!passage) throw notFound('Passage not found');
};
