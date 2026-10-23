import type { QueryFilter, Types, UpdateQuery } from 'mongoose';
import {
  computePassageStats,
  PassageDocument,
  PassageModel,
  PassageStatus,
  PendingEdit,
  publicOwnerName,
  SYSTEM_OWNER_NAME
} from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { CreatePassageInput, ListPassagesQuery, UpdatePassageInput } from '../validators/admin-passage.validator';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Life cycle of a passage: draft, published and archived switch freely; where each status may go next with `PATCH /:id/status`. Only a learner puts a passage in
 * `pending`, and an admin takes it out with approve or reject, not with this table; a `rejected` one goes back to
 * `pending` only when its learner asks again.
 */
const nextStatuses: Record<PassageStatus, readonly PassageStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  pending: [],
  rejected: [],
  archived: ['draft', 'published']
};

// What approving and turning down do to a passage waiting for review. Approved it is published and public, shown with
// `ownerName` (its owner's public name, never an email), and the old reason goes. Turned down it is `rejected`, still
// private, with the reason: never published, but its owner can still type it.
const approved = (ownerName: string): UpdateQuery<PassageDocument> => ({
  $set: { status: 'published', visibility: 'public', ownerName },
  $unset: { reviewNote: 1 }
});
const rejected = (reason: string): UpdateQuery<PassageDocument> => ({ $set: { status: 'rejected', reviewNote: reason } });

// The same for a learner's edit of a public passage (`pendingEdit`). Approved, the edit replaces the text (the words are
// counted again) and the passage goes on being public. Turned down, the edit is dropped and the learner sees the reason.
const editApproved = ({ title, source, content }: PendingEdit): UpdateQuery<PassageDocument> => ({
  // Named one by one: `edit` is a Mongoose subdocument, which does not spread into plain fields.
  $set: { title, source, content, ...computePassageStats(content) },
  $unset: { pendingEdit: 1, reviewNote: 1 }
});
const editRejected = (reason: string): UpdateQuery<PassageDocument> => ({
  $set: { reviewNote: reason },
  $unset: { pendingEdit: 1 }
});

/** What waits for an admin: a request to make a passage public (`pending`), or an edit of a public passage. */
const waitingFilter: QueryFilter<PassageDocument> = { $or: [{ status: 'pending' }, { pendingEdit: { $exists: true } }] };

/**
 * The public name (`publicOwnerName`) of each of `owners`, from their profile as it is now: a display name set after
 * the passage was written shows. An owner whose account is gone is anonymous.
 */
const publicNamesOf = async (owners: (Types.ObjectId | undefined)[]) => {
  const known = owners.filter((owner): owner is Types.ObjectId => owner !== undefined);
  const users = await UserModel.find({ _id: { $in: known } }).select('role displayName');
  const names = new Map(users.map((user) => [String(user._id), publicOwnerName(user)]));
  return (owner?: Types.ObjectId) => names.get(String(owner)) ?? publicOwnerName();
};

export const listPassages = ({ q, status, visibility, isPlacement, edited, ...pagination }: ListPassagesQuery) => {
  const filter: QueryFilter<PassageDocument> = {};
  // The review queue holds the edits of public passages too; `edited` keeps only one kind.
  if (status === 'pending') {
    filter.$and = [edited === undefined ? waitingFilter : edited ? { pendingEdit: { $exists: true } } : { status: 'pending' }];
  }
  else if (status) filter.status = status;
  if (visibility) filter.visibility = visibility;
  if (isPlacement !== undefined) filter.isPlacement = isPlacement;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { source: pattern }];
  }
  return paginate(PassageModel, filter, pagination);
};

export const getPassage = async (id: string) => {
  const passage = await PassageModel.findById(id);
  if (!passage) throw notFound('Passage not found');
  return passage;
};

/** Admins write for TypeTrace: the owner is the admin, the name shown to everyone is `TypeTrace`, and it is always public. */
export const createPassage = (actorId: string, input: CreatePassageInput) =>
  // create() runs the model hook that counts the words and the error tags.
  PassageModel.create({ ...input, owner: actorId, ownerName: SYSTEM_OWNER_NAME, visibility: 'public' });

export const updatePassage = async (id: string, input: UpdatePassageInput) => {
  const passage = await getPassage(id);
  // save() (not findByIdAndUpdate) so the counts are computed again when the content changes.
  passage.set(input);
  return passage.save();
};

export const setPassageStatus = async (id: string, status: PassageStatus) => {
  const passage = await getPassage(id);
  // `?? []`: a passage saved with an old status (`active`) is not in the table; answer 409, not a crash.
  if (!(nextStatuses[passage.status] ?? []).includes(status)) {
    throw conflict(`A ${passage.status} passage cannot become ${status}`);
  }
  passage.status = status;
  return passage.save();
};

/**
 * Approves or turns down one passage waiting for review (a request, or an edit of a public passage), in one step: if two
 * admins decide at the same time (or the learner takes the request back), only the first change happens. Unknown
 * passage: 404; not waiting: 409.
 */
const review = async (id: string, update: (passage: PassageDocument) => UpdateQuery<PassageDocument>) => {
  const waiting = await PassageModel.findOne({ _id: id, ...waitingFilter });
  if (waiting) {
    // Only if it still waits for the same thing: an edit sent again meanwhile is another one to read.
    const same: QueryFilter<PassageDocument> = waiting.pendingEdit
      ? { _id: id, 'pendingEdit.title': waiting.pendingEdit.title, 'pendingEdit.source': waiting.pendingEdit.source, 'pendingEdit.content': waiting.pendingEdit.content }
      : { _id: id, status: 'pending' };
    const passage = await PassageModel.findOneAndUpdate(same, update(waiting), { returnDocument: 'after' });
    if (passage) return passage;
  }
  await getPassage(id);
  throw conflict('This passage is not waiting for review');
};

/** Approves a learner's request: the passage becomes public, shown with the learner's public name as the author. An edit replaces the text. */
export const approvePassage = async (id: string) => {
  const waiting = await PassageModel.findOne({ _id: id, ...waitingFilter }).select('owner');
  const nameOf = await publicNamesOf([waiting?.owner]);
  return review(id, (passage) => (passage.pendingEdit ? editApproved(passage.pendingEdit) : approved(nameOf(passage.owner))));
};

/** Turns a learner's request down: the passage stays private, and the learner sees `reason`. An edit is dropped, the approved text stays. */
export const rejectPassage = (id: string, reason: string) =>
  review(id, (passage) => (passage.pendingEdit ? editRejected(reason) : rejected(reason)));

/** Approves the passages of `ids` that are still waiting for review; answers how many changed (the others are left as they are). */
export const approvePassages = async (ids: string[]) => {
  const waiting = await PassageModel.find({ _id: { $in: ids }, ...waitingFilter });
  if (waiting.length === 0) return 0;
  const nameOf = await publicNamesOf(waiting.map((passage) => passage.owner));
  // One update per passage, so each gets its own author's name or its own edit; each still only if it waits, as for one passage.
  const { modifiedCount } = await PassageModel.bulkWrite(
    waiting.map((passage) => ({
      updateOne: passage.pendingEdit
        ? {
            filter: { _id: passage._id, 'pendingEdit.content': passage.pendingEdit.content, 'pendingEdit.title': passage.pendingEdit.title, 'pendingEdit.source': passage.pendingEdit.source },
            update: editApproved(passage.pendingEdit)
          }
        : { filter: { _id: passage._id, status: 'pending' }, update: approved(nameOf(passage.owner)) }
    }))
  );
  return modifiedCount;
};

/** Turns down, with the same `reason`, the passages of `ids` that are still waiting for review; answers how many changed. */
export const rejectPassages = async (ids: string[], reason: string) => {
  const requests = await PassageModel.updateMany({ _id: { $in: ids }, status: 'pending' }, rejected(reason));
  const edits = await PassageModel.updateMany({ _id: { $in: ids }, pendingEdit: { $exists: true } }, editRejected(reason));
  return requests.modifiedCount + edits.modifiedCount;
};

/** Hard delete. A passage that has typing sessions (or is the placement passage) can only be archived. */
export const deletePassage = async (id: string) => {
  const passage = await getPassage(id);
  if (passage.isPlacement) throw conflict('The placement passage cannot be deleted');
  if (await TypingSessionModel.exists({ passageId: id })) {
    throw conflict('This passage has typing sessions: archive it instead of deleting it');
  }
  await passage.deleteOne();
};
