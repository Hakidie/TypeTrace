import type { QueryFilter, Types } from 'mongoose';
import {
  computePassageStats,
  MAX_USER_PASSAGES,
  ownerFieldsFor,
  PassageDocument,
  PassageModel
} from '../models/passage.model';
import type { SessionMode } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { titleSearchPattern } from '../utils/passage-text';
import { CreatePassageInput, ListPassagesQuery, UpdatePassageInput } from '../validators/passage.validator';

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
 * The statuses in which the owner may type their own private passage: also while an admin reviews it, and after an
 * admin turned it down (SCRUM-176).
 */
const OWN_TYPEABLE_STATUSES = ['published', 'pending', 'rejected'] as const;

/** The statuses in which the owner may edit their own private passage, or ask for it to become public (again). */
const OWN_EDITABLE_STATUSES = ['published', 'rejected'] as const;

/**
 * What a learner may pick for a `mode`: placement passages for the test, practice ones otherwise. Public passages must be
 * published. The owner exception: in practice the learner's own passages come on top, published, waiting for review
 * (`pending`) or turned down (`rejected`). Drafts, archived passages and other people's private passages never match.
 */
export const learnerPassageFilter = (userId: string, mode: SessionMode) =>
  mode === 'placement'
    ? { status: 'published' as const, isPlacement: true, visibility: 'public' as const }
    : {
        isPlacement: false,
        $or: [
          { status: 'published' as const, visibility: 'public' as const },
          { owner: userId, status: { $in: [...OWN_TYPEABLE_STATUSES] } }
        ]
      };

// What a learner gets for one passage of the list: no text, and never `owner` (it is only read to work out `isOwn`).
const listFields = 'title source wordCount ownerName visibility status reviewNote createdAt owner';

/** One passage of the learner list. `reviewNote` (why a request was turned down) only goes to the owner. */
const toListItem = (userId: string) => (passage: PassageDocument) => {
  const isOwn = String(passage.owner) === userId;
  return {
    _id: passage._id,
    title: passage.title,
    source: passage.source,
    wordCount: passage.wordCount,
    ownerName: passage.ownerName,
    visibility: passage.visibility,
    status: passage.status,
    ...(isOwn && passage.reviewNote ? { reviewNote: passage.reviewNote } : {}),
    isOwn,
    createdAt: passage.createdAt
  };
};

/** The learner's own private passages: the only ones they may change. Another user's passage, or a public one, answers 404. */
const ownedBy = (userId: string, id?: string) => ({ ...(id ? { _id: id } : {}), owner: userId, visibility: 'private' as const });

/**
 * How many own private passages the learner can type (the list with `visibility=private`), waiting for review, turned
 * down or not: the ones the limit counts. One an admin archived, or made public, does not take a place.
 */
const countUsableOwnPassages = (userId: string) =>
  PassageModel.countDocuments({ ...ownedBy(userId), status: { $in: [...OWN_TYPEABLE_STATUSES] }, isPlacement: false });

const tooManyPassages = () => badRequest(`You can have at most ${MAX_USER_PASSAGES} passages`);

/**
 * The passages a learner can choose from for `mode` (`learnerPassageFilter`), one page at a time. `q` searches the
 * title, accents optional (`titleSearchPattern`); `visibility` keeps only their own private passages (`private`) or only
 * the public ones (`public`: TypeTrace's and the learners' passages an admin approved); `mine` keeps only the learner's
 * own passages (`true`, private or approved: the Passages page) or only the others (`false`). Titles sort in Vietnamese order.
 */
export const listPassages = async (userId: string, { mode, q, visibility, mine, ...pagination }: ListPassagesQuery) => {
  const conditions: QueryFilter<PassageDocument>[] = [learnerPassageFilter(userId, mode)];
  if (visibility) conditions.push({ visibility });
  if (mine !== undefined) conditions.push(mine ? { owner: userId } : { owner: { $ne: userId } });
  if (q) conditions.push({ title: titleSearchPattern(q) });
  const page = await paginate(PassageModel, { $and: conditions }, pagination, { select: listFields, collation: { locale: 'vi' } });
  return { ...page, items: page.items.map(toListItem(userId)) };
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

const saveOwnPassage = async (userId: string, { title, source, content }: CreatePassageInput) => {
  const author = await UserModel.findById(userId).select('role displayName email');
  if (!author) throw notFound('User not found');
  if ((await countUsableOwnPassages(userId)) >= MAX_USER_PASSAGES) throw tooManyPassages();

  // create() runs the model hook that counts the words and the error tags.
  const passage = await PassageModel.create({
    title,
    content,
    source,
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
  return toListItem(userId)(passage);
};

/**
 * Saves a passage the learner pasted (already cleaned by the validator): private, so only they (and admins) see it,
 * published at once so it can be typed, never a placement passage. At most `MAX_USER_PASSAGES` per learner, saved one
 * at a time per learner.
 */
export const createPassage = (userId: string, input: CreatePassageInput) =>
  oneAtATime(userId, () => saveOwnPassage(userId, input));

/**
 * Why a change of the learner's own private passage `id` found nothing to change: 404 when it is not theirs, 409 when it
 * is theirs but not in the right state (`message` gets its visibility and status).
 */
const refusal = async (userId: string, id: string, message: (passage: { visibility: string; status: string }) => string) => {
  const passage = await PassageModel.findOne({ _id: id, owner: userId }).select('visibility status');
  return passage ? conflict(message(passage)) : notFound('Passage not found');
};

/**
 * Deletes the learner's own private passage for good, also while it waits for review. Their typing sessions keep their
 * copy of its words and title. Once an admin made it public, only an admin may remove it (409).
 */
export const deletePassage = async (userId: string, id: string) => {
  const passage = await PassageModel.findOneAndDelete(ownedBy(userId, id));
  if (!passage) throw await refusal(userId, id, () => 'This passage is public now: only an admin can remove it');
};

/** One of the learner's own passages with its text and source, to edit it. Another user's passage, or an archived one: 404. */
export const getOwnPassage = async (userId: string, id: string) => {
  const passage = await PassageModel.findOne({ _id: id, owner: userId, status: { $in: [...OWN_TYPEABLE_STATUSES] } });
  if (!passage) throw notFound('Passage not found');
  return { ...toListItem(userId)(passage), content: passage.content };
};

const cannotEdit = ({ visibility, status }: { visibility: string; status: string }) => {
  if (visibility === 'public') return 'This passage is public now: only an admin can change it';
  if (status === 'pending') return 'This passage is waiting for review: take the request back to edit it';
  return `This passage is ${status}: it cannot be edited`;
};

/**
 * Edits the learner's own private passage, also one an admin turned down (cleaned and checked by the validator like a
 * new one); the words and error tags are counted again when the text changes. Not while it waits for review (the admin
 * reads what was sent), nor once it is public (only an admin may change it): 409. One conditional update, so a request
 * to make it public sent at the same time cannot let the text change under review. Typing sessions keep their copy of
 * the old words.
 */
export const updatePassage = async (userId: string, id: string, { title, source, content }: UpdatePassageInput) => {
  const passage = await PassageModel.findOneAndUpdate(
    { ...ownedBy(userId, id), status: { $in: [...OWN_EDITABLE_STATUSES] } },
    {
      $set: {
        ...(title !== undefined ? { title } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(content !== undefined ? { content, ...computePassageStats(content) } : {})
      }
    },
    { returnDocument: 'after', runValidators: true }
  );
  if (!passage) throw await refusal(userId, id, cannotEdit);
  return toListItem(userId)(passage);
};

/**
 * The learner asks for their own private passage to become public (SCRUM-176), also again after an admin turned it down:
 * it waits for an admin (`pending`) and the earlier reason is cleared. They can still type it meanwhile. One step, so a
 * request and a decision sent at the same time cannot both win. Already waiting or already public: 409.
 */
export const requestPublication = async (userId: string, id: string) => {
  const passage = await PassageModel.findOneAndUpdate(
    { ...ownedBy(userId, id), status: { $in: [...OWN_EDITABLE_STATUSES] } },
    { $set: { status: 'pending' }, $unset: { reviewNote: 1 } },
    { returnDocument: 'after' }
  );
  if (!passage) {
    throw await refusal(userId, id, ({ visibility, status }) => {
      if (visibility === 'public') return 'This passage is already public';
      return status === 'pending' ? 'This passage is already waiting for review' : `This passage is ${status}: it cannot be made public`;
    });
  }
  return toListItem(userId)(passage);
};

/** The learner takes their request back before an admin decides: the passage is private and published again. Not waiting: 409. */
export const withdrawPublicationRequest = async (userId: string, id: string) => {
  const passage = await PassageModel.findOneAndUpdate(
    { ...ownedBy(userId, id), status: 'pending' },
    { $set: { status: 'published' } },
    { returnDocument: 'after' }
  );
  if (!passage) throw await refusal(userId, id, () => 'This passage is not waiting for review');
  return toListItem(userId)(passage);
};
