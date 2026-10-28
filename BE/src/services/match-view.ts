import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { MatchDocument } from '../models/match.model';
import { matchSettings } from './match-hub';
import { samplePassage } from './passage.service';

/** No 0, O, 1 or I: a code read aloud or copied by hand cannot be mistaken. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const generateRoomCode = () =>
  Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');

/** A ranked passage: published, public, English, 30 to 80 words; `undefined` when the bank has none. */
export const pickRankedPassage = () =>
  samplePassage<{ _id: Types.ObjectId; title: string; content: string }>(
    { language: 'en', visibility: 'public', wordCount: { $gte: 30, $lte: 80 } },
    { title: 1, content: 1 }
  );

/**
 * What the players see of a match: never the typed words, the email or the passage id. The words to type only once the
 * countdown starts, so nobody reads the passage in the lobby.
 */
export const toPublicMatch = (match: MatchDocument) => ({
  code: match.code,
  status: match.status,
  rated: match.rated,
  passageTitle: match.passageTitle,
  wordCount: match.targetWords.length,
  ...(match.status !== 'waiting' && { targetWords: match.targetWords }),
  ...(match.countdownEndsAt && { countdownEndsAt: match.countdownEndsAt }),
  ...(match.startedAt && { startedAt: match.startedAt, endsAt: new Date(match.startedAt.getTime() + matchSettings.durationMs) }),
  ...(match.endedAt && { endedAt: match.endedAt }),
  players: match.players.map((player) => ({
    userId: String(player.user),
    displayName: player.displayName,
    avatar: player.avatar,
    ready: player.ready,
    typedCount: player.typedCount,
    correctWords: player.correctWords,
    accuracy: player.accuracy,
    wpm: player.wpm,
    finished: Boolean(player.finishedAt),
    ...(player.result && { result: player.result })
  }))
});

export type PublicMatch = ReturnType<typeof toPublicMatch>;
