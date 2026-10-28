import { MatchDocument, MatchModel, MatchPlayer, UnratedReason } from '../models/match.model';
import { SeasonRatingModel } from '../models/season-rating.model';
import { currentSeason, START_RATING } from './season.service';

/** A pair of players counts for Elo this many times a day at most (more matches still play, without points). */
export const PAIR_DAILY_LIMIT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** 0:00 of today in Vietnam time (UTC+7): the "day" of the pair limit (ranked duel design, section 5). */
export const vietnamDayStart = (now = Date.now()) => {
  const shifted = now + VIETNAM_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - VIETNAM_OFFSET_MS);
};

/** A player's first matches of a season move more, so they reach their level fast. */
const kFactor = (matches: number) => (matches < 10 ? 40 : 32);

const SCORES = { win: 1, draw: 0.5, loss: 0, forfeit: 0 } as const;
const COUNTERS = { win: 'wins', draw: 'draws', loss: 'losses', forfeit: 'losses' } as const;

/** The chance of `rating` beating `other`. */
const expected = (rating: number, other: number) => 1 / (1 + 10 ** ((other - rating) / 400));

const whyUnrated = async (match: MatchDocument, [a, b]: MatchPlayer[]): Promise<UnratedReason | undefined> => {
  if (!match.startedAt) return 'not-started';
  if (match.flagged) return 'flagged';
  const ratedToday = await MatchModel.countDocuments({
    rated: true,
    endedAt: { $gte: vietnamDayStart() },
    'players.user': { $all: [a.user, b.user] }
  });
  if (ratedToday >= PAIR_DAILY_LIMIT) return 'pair-limit';
};

/**
 * Settles a finished match in the current season, once (the caller saves the match): updates both players' Elo
 * (`R' = R + K × (S − E)`) or records why the match does not count. Nothing happens to a match that is not finished.
 */
export const rateMatch = async (match: MatchDocument) => {
  if (match.status !== 'finished' || match.season) return;
  const season = await currentSeason();
  match.season = season._id;
  const players = [...match.players];
  const reason = await whyUnrated(match, players);
  if (reason) {
    match.rated = false;
    match.unratedReason = reason;
    return;
  }

  // One open room per player, so nothing else changes these two ratings meanwhile.
  const ratings = await Promise.all(
    players.map((player) =>
      SeasonRatingModel.findOneAndUpdate(
        { season: season._id, user: player.user },
        { $setOnInsert: { rating: START_RATING, peakRating: START_RATING } },
        { upsert: true, new: true }
      )
    )
  );
  await Promise.all(
    players.map((player, index) => {
      const own = ratings[index]!;
      const other = ratings[1 - index]!;
      const result = player.result ?? 'draw';
      const after = Math.round(own.rating + kFactor(own.matches) * (SCORES[result] - expected(own.rating, other.rating)));
      player.ratingBefore = own.rating;
      player.ratingAfter = after;
      return SeasonRatingModel.updateOne(
        { _id: own._id },
        { $set: { rating: after }, $max: { peakRating: after }, $inc: { matches: 1, [COUNTERS[result]]: 1 } }
      );
    })
  );
  match.rated = true;
};
