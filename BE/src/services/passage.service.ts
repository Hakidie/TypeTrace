import type { QueryFilter, Types } from 'mongoose';
import {
  computePassageStats,
  notEnglish,
  ownerFieldsFor,
  PassageDocument,
  type PassageLanguage,
  PassageModel,
  practiceLanguageFilter,
  publicOwnerName
} from '../models/passage.model';
import type { SessionMode } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { countCountedPassages, getLearnerOwnerIds, getLockedByOwner, getLockedPassageIds, getPlanOf } from './passage-lock.service';
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
  const passage = await samplePassage<PublicPassage>({ isPlacement: true, ...notEnglish }, publicFields);
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
 * What a learner may pick for a `mode`: placement passages for the test (always Vietnamese), practice ones of `language`
 * otherwise (SCRUM-219: Vietnamese, or the English ones that are not the ranked duels', see `practiceLanguageFilter`). Public
 * passages must be published. The owner exception: in practice the learner's own passages come on top, published, waiting
 * for review (`pending`) or turned down (`rejected`). Drafts, archived passages and other people's private passages never
 * match. `lockedIds` (`getLockedPassageIds`) never match either. `includeArchived` (the learner's own list, `mine=true`) also
 * shows their own archived passages, which they can no longer practice, edit or delete.
 */
export const learnerPassageFilter = (
  userId: string,
  mode: SessionMode,
  lockedIds: Types.ObjectId[] = [],
  language: PassageLanguage = 'vi',
  includeArchived = false
) =>
  mode === 'placement'
    ? { status: 'published' as const, isPlacement: true, visibility: 'public' as const, ...notEnglish }
    : {
        isPlacement: false,
        ...practiceLanguageFilter(language),
        // Passages past their owner's limit (US11.1): the caller says which ones.
        ...(lockedIds.length ? { _id: { $nin: lockedIds } } : {}),
        $or: [
          { status: 'published' as const, visibility: 'public' as const },
          { owner: userId, status: { $in: includeArchived ? [...OWN_TYPEABLE_STATUSES, 'archived' as const] : [...OWN_TYPEABLE_STATUSES] } }
        ]
      };

// What a learner gets for one passage of the list: no text (except on their own passages, see `listPassages`), and never
// `owner` (it is only read to work out `isOwn`).
// `pendingEdit.title` only tells that an edit waits (`editPending`); its text is read when the learner opens the passage.
const listFields = 'title source wordCount ownerName visibility status reviewNote pendingEdit.title createdAt owner';

/** What the list needs to know about the learner's plan (US11.1): their locked passages, the admins, and the plan's permission. */
interface ListPlan {
  lockedIds: Set<string>;
  /** The owners on the page that are learner accounts: the passages of an admin or of a deleted account are system passages. */
  learnerOwnerIds: Set<string>;
  canUsePublicPassages: boolean;
}

/** One passage of the learner list. `reviewNote` (why a request was turned down) only goes to the owner. */
const toListItem = (userId: string, withContent = false, plan?: ListPlan, learners: Set<string> = new Set()) => (passage: PassageDocument) => {
  const isOwn = String(passage.owner) === userId;
  return {
    _id: passage._id,
    title: passage.title,
    source: passage.source,
    wordCount: passage.wordCount,
    ownerName: passage.ownerName,
    visibility: passage.visibility,
    status: passage.status,
    ...(withContent ? { content: passage.content } : {}),
    // An edit of this public passage waits for an admin (the approved text stays public meanwhile).
    ...(isOwn && passage.pendingEdit ? { editPending: true } : {}),
    ...(isOwn && passage.reviewNote ? { reviewNote: passage.reviewNote } : {}),
    // Past the owner's limit (US11.1): the owner sees it dimmed; nobody else gets it at all.
    ...(plan?.lockedIds.has(String(passage._id)) ? { locked: true } : {}),
    // Another learner's public passage on a plan that may not practice it: shown, but locked.
    ...(plan && !plan.canUsePublicPassages && !isOwn && passage.visibility === 'public' && passage.owner && plan.learnerOwnerIds.has(String(passage.owner))
      ? { lockedByPlan: true }
      : {}),
    isOwn,
    // TypeTrace's own: no owner, an admin, or an account that was deleted (SCRUM-304, the label of the passage menus).
    isSystem: !isOwn && !(passage.owner && learners.has(String(passage.owner))),
    createdAt: passage.createdAt
  };
};

/** The learner's own private passages: the only ones they may change. Another user's passage, or a public one, answers 404. */
const ownedBy = (userId: string, id?: string) => ({ ...(id ? { _id: id } : {}), owner: userId, visibility: 'private' as const });

/** The limit comes from the learner's plan (`getPlanOf`); `countCountedPassages` says how much of it is used. */
const tooManyPassages = (limit: number) => badRequest(`You can have at most ${limit} passages`);

/**
 * The passages a learner can choose from for `mode` (`learnerPassageFilter`), one page at a time. `q` searches the
 * title, accents optional (`titleSearchPattern`); `visibility` keeps only their own private passages (`private`) or only
 * the public ones (`public`: TypeTrace's and the learners' passages an admin approved); `mine` keeps only the learner's
 * own passages (`true`, private or approved: the Passages page, whose cards also show the text) or only the others
 * (`false`). Titles sort in Vietnamese order.
 */
export const listPassages = async (userId: string, { mode, language, q, visibility, mine, origin, ...pagination }: ListPassagesQuery) => {
  // A locked passage is hidden from everyone but its owner, who sees it dimmed (US11.1).
  const [lockedByOwner, { config }] = await Promise.all([getLockedByOwner(), getPlanOf(userId)]);
  const ownLocked = lockedByOwner.get(userId) ?? [];
  const hidden = [...lockedByOwner].filter(([owner]) => owner !== userId).flatMap(([, lockedIds]) => lockedIds);
  const conditions: QueryFilter<PassageDocument>[] = [learnerPassageFilter(userId, mode, hidden, language, mine === true)];
  if (visibility) conditions.push({ visibility });
  if (mine !== undefined) conditions.push(mine ? { owner: userId } : { owner: { $ne: userId } });
  // The learner accounts that own a passage: the rest of the owners (an admin, a deleted account) are the system's.
  const learners = await getLearnerOwnerIds(await PassageModel.distinct('owner', { owner: { $ne: null } }));
  if (origin === 'mine') conditions.push({ owner: userId });
  if (origin === 'others') conditions.push({ owner: { $in: [...learners].filter((id) => id !== userId) } });
  if (origin === 'system') conditions.push({ owner: { $nin: [...learners] } });
  if (q) conditions.push({ title: titleSearchPattern(q) });
  // The text only for the learner's own passages: nobody else's private text is sent, and the passage menu does not need it.
  const withContent = mine === true;
  const select = withContent ? `${listFields} content` : listFields;
  const page = await paginate(PassageModel, { $and: conditions }, pagination, { select, collation: { locale: 'vi' } });
  const plan: ListPlan | undefined =
    mode === 'placement'
      ? undefined
      : {
          lockedIds: new Set(ownLocked.map(String)),
          learnerOwnerIds: learners,
          canUsePublicPassages: config.canUsePublicPassages
        };
  return { ...page, items: page.items.map(toListItem(userId, withContent, plan, learners)) };
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
  // An admin's passages are system passages: no limit.
  const limit = author.role === 'admin' ? Infinity : (await getPlanOf(userId)).config.maxPassages;
  if ((await countCountedPassages(userId)) >= limit) throw tooManyPassages(limit);

  // create() runs the model hook that counts the words and the error tags.
  const passage = await PassageModel.create({
    title,
    content,
    // No source: the author's name, as everyone may see it (never the email).
    source: source || publicOwnerName(author),
    ...ownerFieldsFor({ id: userId, role: author.role, displayName: author.displayName, email: author.email }),
    visibility: 'private',
    status: 'published',
    isPlacement: false
  });
  // `oneAtATime` only covers this server: when several servers run, requests sent at the same time can all pass the
  // check above. Count again, and take this one back if it went over.
  if ((await countCountedPassages(userId)) > limit) {
    await passage.deleteOne();
    throw tooManyPassages(limit);
  }
  return toListItem(userId)(passage);
};

/**
 * Saves a passage the learner pasted (already cleaned by the validator): private, so only they (and admins) see it,
 * published at once so it can be typed, never a placement passage. At most the limit of the learner's plan, saved one
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
  if (passage) return;
  // A passage past the limit (US11.1) may always go, also when it is public, unless ranked duels play it.
  const isLocked = (await getLockedPassageIds({ ownerId: userId })).some((lockedId) => String(lockedId) === id);
  if (isLocked) {
    const { deletedCount } = await PassageModel.deleteOne({ _id: id, owner: userId, isRanked: false });
    if (deletedCount) return;
    throw conflict('This passage is used in ranked duels: only an admin can remove it');
  }
  throw await refusal(userId, id, () => 'This passage is public now: only an admin can remove it');
};

/** One of the learner's own passages with its text and source, to edit it. Another user's passage, or an archived one: 404. */
export const getOwnPassage = async (userId: string, id: string) => {
  const passage = await PassageModel.findOne({ _id: id, owner: userId, status: { $in: [...OWN_TYPEABLE_STATUSES] } });
  if (!passage) throw notFound('Passage not found');
  // A public passage with an edit waiting opens with that edit, so the learner goes on from what they sent.
  const { title, source, content } = passage.pendingEdit ?? passage;
  return { ...toListItem(userId)(passage), title, source, content };
};

const cannotEdit = ({ visibility, status }: { visibility: string; status: string }) => {
  if (visibility === 'public') return `This passage is ${status}: it cannot be edited`;
  if (status === 'pending') return 'This passage is waiting for review: take the request back to edit it';
  return `This passage is ${status}: it cannot be edited`;
};

/**
 * An edit of the learner's own public passage: it is kept as `pendingEdit` and the approved text stays public until an
 * admin approves it (SCRUM-176). A second edit replaces the first (fields left out come from it, else from the
 * passage), and clears the reason of an earlier refusal. `updatedAt` moves, so the edit queues behind the others.
 */
const proposeEdit = async (userId: string, id: string, { title, source, content }: UpdatePassageInput) => {
  const current = await PassageModel.findOne({ _id: id, owner: userId, visibility: 'public', status: 'published' });
  if (!current) throw await refusal(userId, id, cannotEdit);
  const base = current.pendingEdit ?? current;
  const passage = await PassageModel.findOneAndUpdate(
    // Still the passage that was read: a decision of an admin in between must not be overwritten.
    { _id: id, owner: userId, visibility: 'public', status: 'published', updatedAt: current.updatedAt },
    {
      $set: { pendingEdit: { title: title ?? base.title, source: source ?? base.source, content: content ?? base.content } },
      $unset: { reviewNote: 1 }
    },
    { returnDocument: 'after', runValidators: true }
  );
  if (!passage) throw conflict('This passage changed meanwhile: open it again');
  return toListItem(userId)(passage);
};

/**
 * Edits the learner's own private passage, also one an admin turned down (cleaned and checked by the validator like a
 * new one); the words and error tags are counted again when the text changes. Not while it waits for review (the admin
 * reads what was sent): 409. One conditional update, so a request to make it public sent at the same time cannot let the
 * text change under review. Typing sessions keep their copy of the old words. A public passage is edited too, but the
 * edit waits for an admin (`proposeEdit`).
 */
export const updatePassage = async (userId: string, id: string, { title, source, content }: UpdatePassageInput) => {
  // An emptied source goes back to the author's name, like a new passage without one.
  if (source === '') {
    const author = await UserModel.findById(userId).select('role displayName');
    if (!author) throw notFound('User not found');
    source = publicOwnerName(author);
  }
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
  if (passage) return toListItem(userId)(passage);
  if (await PassageModel.exists({ _id: id, owner: userId, visibility: 'public', status: 'published' })) {
    return proposeEdit(userId, id, { title, source, content });
  }
  throw await refusal(userId, id, cannotEdit);
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

/**
 * The learner takes their request back before an admin decides: the passage is private and published again. For an edit
 * of a public passage that waits, the edit is dropped and the approved text stays. Nothing waiting: 409.
 */
export const withdrawPublicationRequest = async (userId: string, id: string) => {
  const passage =
    (await PassageModel.findOneAndUpdate({ ...ownedBy(userId, id), status: 'pending' }, { $set: { status: 'published' } }, { returnDocument: 'after' })) ??
    (await PassageModel.findOneAndUpdate(
      { _id: id, owner: userId, visibility: 'public', pendingEdit: { $exists: true } },
      { $unset: { pendingEdit: 1 } },
      { returnDocument: 'after' }
    ));
  if (!passage) throw await refusal(userId, id, () => 'This passage is not waiting for review');
  return toListItem(userId)(passage);
};
