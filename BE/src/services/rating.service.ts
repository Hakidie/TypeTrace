import { MatchDocument, MatchModel, MatchPlayer, UnratedReason } from '../models/match.model';
import { SeasonRatingModel } from '../models/season-rating.model';
import { UserModel } from '../models/user.model';
import { currentSeason, startRatingFor } from './season.service';

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
  // Claimed in the database first: a race left running by a restart is ended by whichever request reads it, and two
  // reads at once (both players coming back) hold two copies of the match. Only the first claim rates it; the others
  // take the settled match instead of saving their copy over it.
  const claim = await MatchModel.updateOne({ _id: match._id, season: { $exists: false } }, { $set: { season: season._id } });
  if (claim.modifiedCount === 0) {
    const settled = await MatchModel.findById(match._id);
    // ponytail: a claim whose match save failed stays unfinished here; it is then finished unrated on the next read.
    if (settled?.status === 'finished') match.set(settled.toObject());
    else match.season = settled?.season;
    return;
  }
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
    players.map(async (player) => {
      const start = await startRatingFor(player.user, season);
      return SeasonRatingModel.findOneAndUpdate(
        { season: season._id, user: player.user },
        // No peak yet: the start (soft reset) is not a tier reached this season; `$max` below sets it after the match.
        { $setOnInsert: { rating: start } },
        { upsert: true, new: true }
      );
    })
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
  await Promise.all(players.map((player) => awardCoins(player)));
};

/** Coins for a rated match (ranked duel design, section 7), and at most this many a day (Vietnam time). */
export const MATCH_COINS = { win: 20, draw: 10, loss: 5, forfeit: 5 } as const;
export const DAILY_COIN_LIMIT = 200;

/** Coins a player earned today in rated matches (read from the matches, so nothing else needs to be kept). */
const coinsEarnedToday = async (userId: MatchPlayer['user']) => {
  const [today] = await MatchModel.aggregate<{ total: number }>([
    { $match: { rated: true, endedAt: { $gte: vietnamDayStart() }, 'players.user': userId } },
    { $unwind: '$players' },
    { $match: { 'players.user': userId } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$players.coins', 0] } } } }
  ]);
  return today?.total ?? 0;
};

/** Gives a player the coins of their result, up to what is left of `DAILY_COIN_LIMIT` today. */
const awardCoins = async (player: MatchPlayer) => {
  const coins = Math.min(MATCH_COINS[player.result ?? 'draw'], Math.max(0, DAILY_COIN_LIMIT - (await coinsEarnedToday(player.user))));
  player.coins = coins;
  if (coins > 0) await UserModel.updateOne({ _id: player.user }, { $inc: { coins } });
};
