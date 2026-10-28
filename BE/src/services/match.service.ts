import type { Response } from 'express';
import { Types } from 'mongoose';
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { MatchDocument, MatchModel, OPEN_MATCH_STATUSES } from '../models/match.model';
import { splitWords } from '../models/passage.model';
import { UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { closeStreams, matchSettings, publish, publishTo, subscribe, withMatchLock } from './match-hub';
import { generateRoomCode, pickRankedPassage, toPublicMatch } from './match-view';

export const ANONYMOUS_PLAYER_NAME = 'Anonymous player';

const roomNotFound = () => notFound('Room not found');

const playerOf = (match: MatchDocument, userId: string) => match.players.find((player) => String(player.user) === userId);

/** Sends the room to everyone watching it and answers with the same view. */
const announce = (match: MatchDocument) => {
  const view = toPublicMatch(match);
  publish(match.code, 'state', view);
  return view;
};

/** A waiting room past `waitingExpiryMs` is cancelled when it is next read (no background job needed). */
const expireIfStale = async (match: MatchDocument | null) => {
  if (match?.status !== 'waiting' || Date.now() - match.createdAt.getTime() < matchSettings.waitingExpiryMs) return match;
  match.status = 'cancelled';
  match.endedAt = new Date();
  await match.save();
  announce(match);
  closeStreams(match.code);
  return match;
};

/** The room a code names now: the newest match with it (codes come back once a room is over). */
const findRoom = async (code: string) => expireIfStale(await MatchModel.findOne({ code }).sort({ createdAt: -1 }));

/** The open room the user is in, if any (a stale waiting room does not count). */
const findOpenMatchFor = async (userId: string) => {
  const match = await expireIfStale(await MatchModel.findOne({ 'players.user': userId, status: { $in: [...OPEN_MATCH_STATUSES] } }));
  return match && (OPEN_MATCH_STATUSES as readonly string[]).includes(match.status) ? match : null;
};

/** What the others see of a player: the display name (never the email) and the look worn now. */
const newPlayer = async (userId: string) => {
  const user = await UserModel.findById(userId).select('displayName avatar');
  if (!user) throw notFound('User not found');
  return {
    user: new Types.ObjectId(userId),
    displayName: user.displayName?.trim() || ANONYMOUS_PLAYER_NAME,
    avatar: user.avatar ?? DEFAULT_AVATAR
  };
};

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** Opens a room with a random English passage; the user is its host and waits for a guest. */
export const createMatch = async (userId: string) => {
  if (await findOpenMatchFor(userId)) throw conflict('You are already in another room');
  const passage = await pickRankedPassage();
  if (!passage) throw notFound('No English passage available');
  const host = await newPlayer(userId);
  // A new code is drawn again in the rare case it is already used by an open room.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const match = await MatchModel.create({
        code: generateRoomCode(),
        passageId: passage._id,
        passageTitle: passage.title,
        targetWords: splitWords(passage.content),
        players: [host]
      });
      return toPublicMatch(match);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw conflict('Could not find a free room code, try again');
};

export const joinMatch = (userId: string, code: string) =>
  withMatchLock(code, async () => {
    const match = await findRoom(code);
    if (!match || match.status === 'cancelled') throw roomNotFound();
    if (playerOf(match, userId)) throw badRequest('You are already in this room');
    if (match.status !== 'waiting' || match.players.length >= 2) throw conflict('Room is full');
    if (await findOpenMatchFor(userId)) throw conflict('You are already in another room');
    match.players.push(await newPlayer(userId));
    await match.save();
    return announce(match);
  });

/** The room as its players see it; anyone else gets 404, so codes cannot be probed. */
export const getMatch = async (userId: string, code: string) => {
  const match = await findRoom(code);
  if (!match || !playerOf(match, userId)) throw roomNotFound();
  return toPublicMatch(match);
};

/**
 * Leaves the room. Before the match starts the guest just goes (the host waits again, both ready flags are cleared) and
 * the host closes the room.
 */
export const leaveMatch = (userId: string, code: string) =>
  withMatchLock(code, async () => {
    const match = await findRoom(code);
    const player = match && playerOf(match, userId);
    if (!match || !player) throw roomNotFound();
    if (match.status === 'waiting') {
      if (String(match.players[0].user) === userId) {
        match.status = 'cancelled';
        match.endedAt = new Date();
      } else {
        match.players.pull(player);
        match.players.forEach((entry) => (entry.ready = false));
      }
      await match.save();
      const view = announce(match);
      if (match.status === 'cancelled') closeStreams(match.code);
      return view;
    }
    return toPublicMatch(match);
  });

/** Opens the event stream of the room for one of its players; the current state is sent at once. */
export const openEvents = async (userId: string, code: string, res: Response) => {
  const match = await findRoom(code);
  if (!match || !playerOf(match, userId)) throw roomNotFound();
  subscribe(match.code, userId, res, () => undefined);
  publishTo(match.code, userId, 'state', toPublicMatch(match));
};
