import type { QueryFilter } from 'mongoose';
import { PassageDocument, PassageModel, PassageStatus, SYSTEM_OWNER_NAME } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { CreatePassageInput, ListPassagesQuery, UpdatePassageInput } from '../validators/admin-passage.validator';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Life cycle of a passage: where each status may go next. */
const nextStatuses: Record<PassageStatus, readonly PassageStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published']
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

/** Hard delete. A passage that has typing sessions (or is the placement passage) can only be archived. */
export const deletePassage = async (id: string) => {
  const passage = await getPassage(id);
  if (passage.isPlacement) throw conflict('The placement passage cannot be deleted');
  if (await TypingSessionModel.exists({ passageId: id })) {
    throw conflict('This passage has typing sessions: archive it instead of deleting it');
  }
  await passage.deleteOne();
};
