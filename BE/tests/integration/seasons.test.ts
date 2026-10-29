import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { SeasonModel } from '../../src/models/season.model';
import { SeasonRatingModel } from '../../src/models/season-rating.model';
import { closeSeason, currentSeason, SEASON_LENGTH_MS, startRatingFor, tierFor } from '../../src/services/season.service';

const WEEK = 7 * 24 * 60 * 60 * 1000;

describe('seasons (ranked duel, phase 5)', () => {
  it('opens season 1 the first time a season is needed, for 8 weeks', async () => {
    const season = await currentSeason();

    expect(season).toMatchObject({ number: 1, status: 'active' });
    expect(SEASON_LENGTH_MS).toBe(8 * WEEK);
    expect(season.endsAt.getTime() - season.startsAt.getTime()).toBe(SEASON_LENGTH_MS);
    expect(String((await currentSeason())._id)).toBe(String(season._id));
  });

  it('keeps exactly one active season when many requests ask at once', async () => {
    await SeasonModel.init();
    await Promise.all(Array.from({ length: 5 }, () => currentSeason()));

    expect(await SeasonModel.countDocuments({ status: 'active' })).toBe(1);
  });

  it('closes a season past its end when one is next needed, and opens the next', async () => {
    const first = await currentSeason();
    await SeasonModel.updateOne({ _id: first._id }, { endsAt: new Date(Date.now() - 1000) });

    const next = await currentSeason();

    expect(next.number).toBe(2);
    expect((await SeasonModel.findById(first._id))!.status).toBe('closed');
  });

  it('starts the players of the closed season halfway back to 1000', async () => {
    const first = await currentSeason();
    const strong = new Types.ObjectId();
    const weak = new Types.ObjectId();
    await SeasonRatingModel.create([
      { season: first._id, user: strong, rating: 1201, peakRating: 1300, matches: 30, wins: 20, losses: 10 },
      { season: first._id, user: weak, rating: 900, peakRating: 1010, matches: 12, wins: 3, losses: 9 }
    ]);

    const next = await closeSeason(String(first._id));

    expect(next.number).toBe(2);
    expect(await startRatingFor(strong, next, 'race')).toBe(1101);
    expect(await startRatingFor(weak, next, 'race')).toBe(950);
    expect(await startRatingFor(new Types.ObjectId(), next, 'race')).toBe(1000);
  });

  it('closes a season only once', async () => {
    const first = await currentSeason();
    const next = await closeSeason(String(first._id));
    const again = await closeSeason(String(first._id));

    expect(String(again._id)).toBe(String(next._id));
    expect(await SeasonModel.countDocuments()).toBe(2);
  });

  it('names the tier of a rating', () => {
    expect([1099, 1100, 1249, 1250, 1399, 1400, 1549, 1550, 1699, 1700].map(tierFor)).toEqual([
      'Bronze',
      'Silver',
      'Silver',
      'Gold',
      'Gold',
      'Platinum',
      'Platinum',
      'Diamond',
      'Diamond',
      'Legend'
    ]);
  });
});
