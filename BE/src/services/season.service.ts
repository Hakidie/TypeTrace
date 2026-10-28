import type { Types } from 'mongoose';
import { OWNED_REWARD_COINS, REWARD_TIERS, SEASON_ITEMS, Tier, TIER_REWARDS, unlockOfKey } from '../data/avatar-catalog';
import { SeasonDocument, SeasonModel } from '../models/season.model';
import { SeasonRatingModel } from '../models/season-rating.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';

export const SEASON_LENGTH_MS = 8 * 7 * 24 * 60 * 60 * 1000;
export const START_RATING = 1000;

/** The tiers from the top: a rating at or above `from` has that tier (ranked duel design, section 6). */
const TIERS = [
  { name: 'Legend', from: 1700 },
  { name: 'Diamond', from: 1550 },
  { name: 'Platinum', from: 1400 },
  { name: 'Gold', from: 1250 },
  { name: 'Silver', from: 1100 },
  { name: 'Bronze', from: -Infinity }
] as const;

export type TierName = (typeof TIERS)[number]['name'];

export const tierFor = (rating: number): TierName => TIERS.find((tier) => rating >= tier.from)!.name;

/** The lowest rating of a tier. */
const tierStart = (name: TierName) => TIERS.find((tier) => tier.name === name)!.from;

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** Opens the season after `number`; when another request opened one first, that one is the active season. */
const openSeason = async (number: number): Promise<SeasonDocument> => {
  const startsAt = new Date();
  try {
    return await SeasonModel.create({
      number,
      startsAt,
      endsAt: new Date(startsAt.getTime() + SEASON_LENGTH_MS),
      rewardItem: SEASON_ITEMS[(number - 1) % SEASON_ITEMS.length]
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const active = await SeasonModel.findOne({ status: 'active' });
    if (!active) throw error;
    return active;
  }
};

/**
 * The season running now. There is no background job: season 1 opens the first time one is needed, and a season past
 * its end closes when the next request needs one (lazy, like the expiry of rooms).
 */
export const currentSeason = async (): Promise<SeasonDocument> => {
  const active = await SeasonModel.findOne({ status: 'active' });
  if (!active) {
    const last = await SeasonModel.findOne().sort({ number: -1 }).select('number');
    return openSeason((last?.number ?? 0) + 1);
  }
  if (active.endsAt.getTime() <= Date.now()) return closeSeason(String(active._id));
  return active;
};

/**
 * Closes a season (at its end, or early by an admin) and opens the next. Returns the active season; closing a closed
 * season changes nothing. The soft reset is lazy too (`startRatingFor`): nothing is copied here, so a match rated while
 * the season closes cannot miss it.
 */
export const closeSeason = async (id: string): Promise<SeasonDocument> => {
  const closed = await SeasonModel.findOneAndUpdate({ _id: id, status: 'active' }, { status: 'closed', closedAt: new Date() }, { new: true });
  if (!closed) {
    if (!(await SeasonModel.exists({ _id: id }))) throw notFound('Season not found');
    return currentSeason();
  }
  const next = await openSeason(closed.number + 1);
  await giveSeasonRewards(closed);
  return next;
};

/** The reward items of a peak rating: the item of every tier reached (cumulative), and the season item from Gold up. */
const rewardsFor = (peakRating: number, season: SeasonDocument) => {
  const reached = REWARD_TIERS.slice(0, REWARD_TIERS.indexOf(tierFor(peakRating).toLowerCase() as Tier) + 1);
  if (!reached.length) return [];
  const items = Object.entries(TIER_REWARDS)
    .filter(([, tier]) => reached.includes(tier))
    .map(([item]) => item);
  return season.rewardItem ? [...items, season.rewardItem] : items;
};

/**
 * Gives every player of a closed season the rewards of the highest tier they reached; an item they already own is paid
 * in coins instead (its price, or `OWNED_REWARD_COINS`). Each player is claimed first, so a player is rewarded once.
 * ponytail: one player at a time inside the request that closes the season; a job queue if seasons get big.
 */
const giveSeasonRewards = async (season: SeasonDocument) => {
  const players = await SeasonRatingModel.find({ season: season._id, peakRating: { $gte: tierStart('Gold') }, rewardedAt: { $exists: false } });
  for (const player of players) {
    const claim = await SeasonRatingModel.updateOne({ _id: player._id, rewardedAt: { $exists: false } }, { rewardedAt: new Date() });
    if (claim.modifiedCount === 0) continue;
    const user = await UserModel.findById(player.user).select('ownedItems');
    if (!user) continue;
    const items = rewardsFor(player.peakRating, season);
    const fresh = items.filter((item) => !user.ownedItems.includes(item));
    const coins = items
      .filter((item) => user.ownedItems.includes(item))
      .reduce((sum, item) => {
        const unlock = unlockOfKey(item);
        return sum + (unlock?.kind === 'shop' ? unlock.price : OWNED_REWARD_COINS);
      }, 0);
    await UserModel.updateOne({ _id: player.user }, { $addToSet: { ownedItems: { $each: fresh } }, $inc: { coins } });
  }
};

/**
 * Where a player starts a season (soft reset): halfway back to `START_RATING` from their rating at the end of the season
 * before, or `START_RATING` without one.
 */
export const startRatingFor = async (userId: string | Types.ObjectId, season: SeasonDocument) => {
  const before = await SeasonModel.findOne({ number: season.number - 1 }).select('_id');
  const last = before && (await SeasonRatingModel.findOne({ season: before._id, user: userId }).select('rating'));
  return last ? Math.round(START_RATING + (last.rating - START_RATING) / 2) : START_RATING;
};
