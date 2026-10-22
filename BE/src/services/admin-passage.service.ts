import type { QueryFilter, Types, UpdateQuery } from 'mongoose';
import { PassageDocument, PassageModel, PassageStatus, publicOwnerName, SYSTEM_OWNER_NAME } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { CreatePassageInput, ListPassagesQuery, UpdatePassageInput } from '../validators/admin-passage.validator';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Life cycle of a passage: where each status may go next with `PATCH /:id/status`. Only a learner puts a passage in
 * `pending`, and an admin takes it out with approve or reject, not with this table.
 */
const nextStatuses: Record<PassageStatus, readonly PassageStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  pending: [],
  archived: ['published']
};

// What approving and turning down do to a passage waiting for review. Either way it is published (so its owner can
// type it). Approved it is public, shown with `ownerName` (its owner's public name, never an email), and the old reason
// goes; turned down it stays private with the reason.
const approved = (ownerName: string): UpdateQuery<PassageDocument> => ({
  $set: { status: 'published', visibility: 'public', ownerName },
  $unset: { reviewNote: 1 }
});
const rejected = (reason: string): UpdateQuery<PassageDocument> => ({ $set: { status: 'published', reviewNote: reason } });

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

export const listPassages = ({ q, status, isPlacement, ...pagination }: ListPassagesQuery) => {
  const filter: QueryFilter<PassageDocument> = {};
  if (status) filter.status = status;
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
 * Approves or turns down one passage waiting for review, in one step: if two admins decide at the same time (or the
 * learner takes the request back), only the first change happens. Unknown passage: 404; not waiting: 409.
 */
const review = async (id: string, update: UpdateQuery<PassageDocument>) => {
  const passage = await PassageModel.findOneAndUpdate({ _id: id, status: 'pending' }, update, { returnDocument: 'after' });
  if (passage) return passage;
  await getPassage(id);
  throw conflict('This passage is not waiting for review');
};

/** Approves a learner's request: the passage becomes public, shown with the learner's public name as the author. */
export const approvePassage = async (id: string) => {
  const waiting = await PassageModel.findOne({ _id: id, status: 'pending' }).select('owner');
  const nameOf = await publicNamesOf([waiting?.owner]);
  return review(id, approved(nameOf(waiting?.owner)));
};

/** Turns a learner's request down: the passage stays private, and the learner sees `reason`. */
export const rejectPassage = (id: string, reason: string) => review(id, rejected(reason));

/** Approves the passages of `ids` that are still waiting for review; answers how many changed (the others are left as they are). */
export const approvePassages = async (ids: string[]) => {
  const waiting = await PassageModel.find({ _id: { $in: ids }, status: 'pending' }).select('owner');
  if (waiting.length === 0) return 0;
  const nameOf = await publicNamesOf(waiting.map((passage) => passage.owner));
  // One update per passage, so each gets its own author's name; each still only if it waits, as for one passage.
  const { modifiedCount } = await PassageModel.bulkWrite(
    waiting.map((passage) => ({
      updateOne: { filter: { _id: passage._id, status: 'pending' }, update: approved(nameOf(passage.owner)) }
    }))
  );
  return modifiedCount;
};

/** Turns down, with the same `reason`, the passages of `ids` that are still waiting for review; answers how many changed. */
export const rejectPassages = async (ids: string[], reason: string) =>
  (await PassageModel.updateMany({ _id: { $in: ids }, status: 'pending' }, rejected(reason))).modifiedCount;

/** Hard delete. A passage that has typing sessions (or is the placement passage) can only be archived. */
export const deletePassage = async (id: string) => {
  const passage = await getPassage(id);
  if (passage.isPlacement) throw conflict('The placement passage cannot be deleted');
  if (await TypingSessionModel.exists({ passageId: id })) {
    throw conflict('This passage has typing sessions: archive it instead of deleting it');
  }
  await passage.deleteOne();
};
