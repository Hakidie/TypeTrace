import type { Types } from 'mongoose';
import { SeasonDocument, SeasonModel } from '../models/season.model';
import { SeasonRatingModel } from '../models/season-rating.model';
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

export type Tier = (typeof TIERS)[number]['name'];

export const tierFor = (rating: number): Tier => TIERS.find((tier) => rating >= tier.from)!.name;

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** Opens the season after `number`; when another request opened one first, that one is the active season. */
const openSeason = async (number: number): Promise<SeasonDocument> => {
  const startsAt = new Date();
  try {
    return await SeasonModel.create({ number, startsAt, endsAt: new Date(startsAt.getTime() + SEASON_LENGTH_MS) });
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
  return openSeason(closed.number + 1);
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
