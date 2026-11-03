import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { MatchDocument } from '../models/match.model';
import { PassageModel } from '../models/passage.model';
import { matchSettings } from './match-hub';
import { rainDuelSettings, rainWordsFrom } from './rain-duel-rules';
import { samplePassage } from './passage.service';

/** No 0, O, 1 or I: a code read aloud or copied by hand cannot be mistaken. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const generateRoomCode = () =>
  Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');

/**
 * What the ranked duels play (US6.4): the passages an admin marked `isRanked` (published, public, English), nothing else.
 * `samplePassage` adds `status: 'published'`.
 */
const rankedFilter = { isRanked: true, language: 'en', visibility: 'public' } as const;

/** A ranked passage of 30 to 80 words; `undefined` when the bank has none. */
export const pickRankedPassage = () =>
  samplePassage<{ _id: Types.ObjectId; title: string; content: string }>(
    { ...rankedFilter, wordCount: { $gte: 30, $lte: 80 } },
    { title: 1, content: 1 }
  );

/** The words of a rain duel: every word of the published ranked passages, shuffled; empty when there are none. */
export const pickRainWords = async () => {
  const passages = await PassageModel.find({ ...rankedFilter, status: 'published' }).select('content').lean();
  const words = rainWordsFrom(passages.map((passage) => passage.content));
  for (let i = words.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
};

/**
 * What the players see of a match: never the typed words, the email or the passage id. The words to type only once the
 * countdown starts, so nobody reads the passage in the lobby; never for a rain duel (the server drops them one by one).
 */
export const toPublicMatch = (match: MatchDocument) => ({
  code: match.code,
  kind: match.kind ?? 'race',
  ...(match.rainTier && { rainTier: match.rainTier }),
  status: match.status,
  rated: match.rated,
  ...(match.unratedReason && { unratedReason: match.unratedReason }),
  passageTitle: match.passageTitle,
  wordCount: match.targetWords.length,
  ...(match.status !== 'waiting' && match.kind !== 'rain' && { targetWords: match.targetWords }),
  ...(match.countdownEndsAt && { countdownEndsAt: match.countdownEndsAt }),
  ...(match.startedAt && { startedAt: match.startedAt, endsAt: new Date(match.startedAt.getTime() + (match.kind === 'rain' ? rainDuelSettings.durationMs : matchSettings.durationMs)) }),
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
    ...(player.result && { result: player.result }),
    ...(player.ratingAfter !== undefined && { ratingBefore: player.ratingBefore, ratingAfter: player.ratingAfter }),
    ...(player.coins !== undefined && { coins: player.coins }),
    ...(player.lives !== undefined && { lives: player.lives, hits: player.hits ?? 0, thrown: player.thrown ?? 0 })
  }))
});

export type PublicMatch = ReturnType<typeof toPublicMatch>;
