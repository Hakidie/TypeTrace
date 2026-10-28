import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { SeasonModel } from '../models/season.model';
import { SeasonRatingModel } from '../models/season-rating.model';
import { UserModel } from '../models/user.model';
import { paginate } from '../utils/pagination';
import { LeaderboardQuery, ListSeasonsQuery } from '../validators/ranked.validator';
import { ANONYMOUS_PLAYER_NAME } from './match.service';
import { currentSeason, START_RATING, tierFor } from './season.service';

/** A player needs this many matches in the season to be on the leaderboard. */
export const LEADERBOARD_MIN_MATCHES = 5;

const seasonView = (season: { number: number; startsAt: Date; endsAt: Date }) => ({
  number: season.number,
  startsAt: season.startsAt,
  endsAt: season.endsAt
});

/** The own rating in the current season; a player without a rated match yet starts at `START_RATING`. */
export const getMyRanking = async (userId: string) => {
  const season = await currentSeason();
  const rating = await SeasonRatingModel.findOne({ season: season._id, user: userId });
  const value = rating?.rating ?? START_RATING;
  return {
    season: seasonView(season),
    rating: value,
    peakRating: rating?.peakRating ?? START_RATING,
    tier: tierFor(value),
    matches: rating?.matches ?? 0,
    wins: rating?.wins ?? 0,
    losses: rating?.losses ?? 0,
    draws: rating?.draws ?? 0
  };
};

/** The leaderboard of the current season: display names and avatars only, never an email. */
export const getLeaderboard = async (query: LeaderboardQuery) => {
  const season = await currentSeason();
  const page = await paginate(SeasonRatingModel, { season: season._id, matches: { $gte: LEADERBOARD_MIN_MATCHES } }, query, {
    select: 'user rating matches wins'
  });
  // `.lean()` skips `toJSON`: only the public fields are read.
  const users = await UserModel.find({ _id: { $in: page.items.map((entry) => entry.user) } })
    .select('displayName avatar')
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return {
    ...page,
    season: seasonView(season),
    items: page.items.map((entry, index) => {
      const user = byId.get(String(entry.user));
      return {
        rank: (page.page - 1) * page.limit + index + 1,
        userId: String(entry.user),
        displayName: user?.displayName?.trim() || ANONYMOUS_PLAYER_NAME,
        avatar: user?.avatar ?? DEFAULT_AVATAR,
        rating: entry.rating,
        tier: tierFor(entry.rating),
        matches: entry.matches,
        wins: entry.wins,
        winRate: entry.matches ? entry.wins / entry.matches : 0
      };
    })
  };
};

/** Admin: every season, the active one first. Makes season 1 when there is none yet. */
export const listSeasons = async (query: ListSeasonsQuery) => {
  await currentSeason();
  return paginate(SeasonModel, {}, query);
};
