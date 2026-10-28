import type { Response } from 'express';
import { Types } from 'mongoose';
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { MatchDocument, MatchModel, MatchPlayer, MatchResult, OPEN_MATCH_STATUSES } from '../models/match.model';
import { splitWords } from '../models/passage.model';
import { UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { ProgressInput } from '../validators/match.validator';
import { cancelTimer, closeStreams, isConnected, matchSettings, publish, publishTo, schedule, subscribe, withMatchLock } from './match-hub';
import { generateRoomCode, pickRankedPassage, toPublicMatch } from './match-view';
import { computeWpm, gradeWords, MAX_COUNTED_WPM, SESSION_GRACE_MS } from './typing-session.service';

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
    if (match.status === 'countdown' || match.status === 'running') {
      forfeitPlayer(match, userId);
      await match.save();
      announceResult(match);
    }
    return toPublicMatch(match);
  });

/** A player who leaves (or stays disconnected) once the countdown started loses by forfeit; the other one wins. */
const forfeitPlayer = (match: MatchDocument, userId: string) => {
  const other = match.players.find((entry) => String(entry.user) !== userId)!;
  finish(
    match,
    new Map<string, MatchResult>([
      [userId, 'forfeit'],
      [String(other.user), 'win']
    ])
  );
};

const disconnectTimer = (userId: string) => `disconnect:${userId}`;

/** The stream of a player closed: during a match they forfeit unless they come back within `disconnectGraceMs`. */
const onStreamClosed = (code: string, userId: string) => {
  if (isConnected(code, userId)) return;
  schedule(code, disconnectTimer(userId), matchSettings.disconnectGraceMs, () =>
    withMatchLock(code, async () => {
      if (isConnected(code, userId)) return;
      const match = await MatchModel.findOne({ code, status: { $in: ['countdown', 'running'] } });
      if (!match || !playerOf(match, userId)) return;
      forfeitPlayer(match, userId);
      await match.save();
      announceResult(match);
    })
  );
};

/**
 * After a match: opens a new room hosted by the asking player and invites the other one through the stream of the old
 * room (`rematch` event with the new code).
 */
export const requestRematch = async (userId: string, code: string) => {
  const match = await findRoom(code);
  const player = match && playerOf(match, userId);
  if (!match || !player) throw roomNotFound();
  if (match.status !== 'finished') throw conflict('The match is not over');
  const room = await createMatch(userId);
  publish(match.code, 'rematch', { code: room.code, from: player.displayName });
  return room;
};

// ---- the race ------------------------------------------------------------------------------------------------------

/** A finisher at or above this share of correct words wins at once. */
export const WIN_ACCURACY = 0.9;

const notRunning = () => conflict('The match is not running');

/** Ends the match with these results, tells everyone, and keeps the streams open a while for a rematch invitation. */
const finish = (match: MatchDocument, results: Map<string, MatchResult>) => {
  match.status = 'finished';
  match.endedAt = new Date();
  match.players.forEach((player) => (player.result = results.get(String(player.user))));
  cancelTimer(match.code, 'timeout');
  cancelTimer(match.code, 'start');
  schedule(match.code, 'close', matchSettings.rematchStreamMs, () => closeStreams(match.code));
};

const resultsOf = (winner: MatchPlayer, loser: MatchPlayer) =>
  new Map<string, MatchResult>([
    [String(winner.user), 'win'],
    [String(loser.user), 'loss']
  ]);

/** Nobody won outright: more correct words wins, the same number is a draw. */
const finishByCorrectWords = (match: MatchDocument) => {
  const [a, b] = match.players;
  if (a.correctWords === b.correctWords) {
    finish(
      match,
      new Map([
        [String(a.user), 'draw'],
        [String(b.user), 'draw']
      ])
    );
  } else finish(match, a.correctWords > b.correctWords ? resultsOf(a, b) : resultsOf(b, a));
};

/** Sends the end of the match to everyone. */
const announceResult = (match: MatchDocument) => {
  const view = toPublicMatch(match);
  publish(match.code, 'result', view);
  publish(match.code, 'state', view);
};

const isOver = (match: MatchDocument) => Boolean(match.startedAt) && Date.now() > match.startedAt!.getTime() + matchSettings.durationMs;

/** The time is up: ends a running match by correct words (also run lazily when a late progress arrives). */
const timeOut = (code: string) =>
  withMatchLock(code, async () => {
    const match = await MatchModel.findOne({ code, status: 'running' });
    if (!match) return;
    finishByCorrectWords(match);
    await match.save();
    announceResult(match);
  });

/** The countdown is over: the race starts now, by the server clock, and ends after `durationMs` at the latest. */
const startRace = (code: string) =>
  withMatchLock(code, async () => {
    const match = await MatchModel.findOne({ code, status: 'countdown' });
    if (!match) return;
    match.status = 'running';
    match.startedAt = new Date();
    await match.save();
    announce(match);
    schedule(code, 'timeout', matchSettings.durationMs, () => timeOut(code));
  });

/** Ready (or not). When both players are ready the server counts down, then starts the race. */
export const setReady = (userId: string, code: string, ready: boolean) =>
  withMatchLock(code, async () => {
    const match = await findRoom(code);
    const player = match && playerOf(match, userId);
    if (!match || !player) throw roomNotFound();
    if (match.status !== 'waiting') throw conflict('The match already started');
    player.ready = ready;
    if (match.players.length === 2 && match.players.every((entry) => entry.ready)) {
      match.status = 'countdown';
      match.countdownEndsAt = new Date(Date.now() + matchSettings.countdownMs);
      publish(code, 'countdown', { countdownEndsAt: match.countdownEndsAt });
      schedule(code, 'start', matchSettings.countdownMs, () => startRace(code));
    }
    await match.save();
    return announce(match);
  });

/**
 * Grades what a player typed so far, streams it to the room and applies the rules (ranked duel design, section 5): a
 * finisher with `WIN_ACCURACY` wins at once; a finisher under it waits for the other one; over `MAX_COUNTED_WPM` loses and
 * flags the match. Only the server clock counts; the word times are only checked.
 */
export const sendProgress = (userId: string, code: string, { typedWords, typedAtMs, done }: ProgressInput) =>
  withMatchLock(code, async () => {
    const match = await findRoom(code);
    const player = match && playerOf(match, userId);
    if (!match || !player) throw roomNotFound();
    if (match.status !== 'running') throw notRunning();
    if (isOver(match)) {
      finishByCorrectWords(match);
      await match.save();
      announceResult(match);
      throw notRunning();
    }
    if (player.finishedAt) throw conflict('You already finished');

    const total = match.targetWords.length;
    if (typedWords.length > total) throw badRequest('More words than the passage');
    // One word may disappear (the one being typed was cleared); more means the progress went back.
    if (typedWords.length < player.typedCount - 1) throw badRequest('Progress cannot go back');
    if (typedAtMs.some((time, index) => index > 0 && time < typedAtMs[index - 1])) throw badRequest('Word times must go up');
    if (typedAtMs.some((time) => time > matchSettings.durationMs + SESSION_GRACE_MS)) throw badRequest('A word time is after the end of the match');
    if (done && typedWords.length !== total) throw badRequest('Type every word before finishing');

    const correctWords = gradeWords(match.targetWords, typedWords, typedAtMs).filter((word) => word.errorTypes.length === 0).length;
    Object.assign(player, {
      typedWords,
      typedAtMs,
      typedCount: typedWords.length,
      correctWords,
      accuracy: correctWords / total,
      wpm: computeWpm(correctWords, Date.now() - match.startedAt!.getTime())
    });
    const other = match.players.find((entry) => entry !== player)!;

    let ended = true;
    if (player.wpm > MAX_COUNTED_WPM) {
      match.flagged = true;
      finish(match, resultsOf(other, player));
    } else if (done && player.accuracy >= WIN_ACCURACY) {
      player.finishedAt = new Date();
      finish(match, resultsOf(player, other));
    } else if (done) {
      player.finishedAt = new Date();
      if (other.finishedAt) finishByCorrectWords(match);
      else ended = false;
    } else ended = false;
    await match.save();

    const update = {
      typedCount: player.typedCount,
      correctWords: player.correctWords,
      accuracy: player.accuracy,
      wpm: player.wpm,
      finished: Boolean(player.finishedAt)
    };
    publish(code, 'progress', { userId, ...update });
    if (ended) announceResult(match);
    return update;
  });

/** Opens the event stream of the room for one of its players; the current state is sent at once. */
export const openEvents = async (userId: string, code: string, res: Response) => {
  const match = await findRoom(code);
  if (!match || !playerOf(match, userId)) throw roomNotFound();
  // Back within the grace time (a reload): the forfeit is called off.
  cancelTimer(match.code, disconnectTimer(userId));
  subscribe(match.code, userId, res, () => onStreamClosed(match.code, userId));
  publishTo(match.code, userId, 'state', toPublicMatch(match));
};
