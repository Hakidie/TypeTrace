import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../src/data/avatar-catalog';
import { MatchModel } from '../../src/models/match.model';
import { SeasonRatingModel } from '../../src/models/season-rating.model';
import { rateMatch } from '../../src/services/rating.service';
import { closeSeason, currentSeason, START_RATING, startRatingFor } from '../../src/services/season.service';
import { migrateRatingKinds } from '../../src/scripts/migrate-rating-kinds';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

/** A finished match of `kind` between two players, `winner` first; rated by the caller. */
const finishedMatch = (kind: 'race' | 'rain', winner: Types.ObjectId, loser: Types.ObjectId) =>
  MatchModel.create({
    kind,
    code: `K${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    status: 'finished',
    startedAt: new Date(),
    endedAt: new Date(),
    passageId: new Types.ObjectId(),
    passageTitle: 'A quiet morning',
    targetWords: ['a'],
    players: [
      { user: winner, displayName: 'Lan', avatar: DEFAULT_AVATAR, result: 'win' },
      { user: loser, displayName: 'Minh', avatar: DEFAULT_AVATAR, result: 'loss' }
    ]
  });

const rate = async (kind: 'race' | 'rain', winner: Types.ObjectId, loser: Types.ObjectId) => {
  const match = await finishedMatch(kind, winner, loser);
  await rateMatch(match);
  await match.save();
  return match;
};

describe('ratings by match kind', () => {
  it('rates a rain match on the rain rating only', async () => {
    const [a, b] = [new Types.ObjectId(), new Types.ObjectId()];

    await rate('rain', a, b);

    const season = await currentSeason();
    const rain = await SeasonRatingModel.findOne({ season: season._id, user: a, kind: 'rain' });
    expect(rain?.rating).toBeGreaterThan(START_RATING);
    expect(await SeasonRatingModel.countDocuments({ user: a, kind: 'race' })).toBe(0);
  });

  it('starts the rain rating of a race player at the start rating', async () => {
    const [a, b] = [new Types.ObjectId(), new Types.ObjectId()];
    const season = await currentSeason();
    await SeasonRatingModel.create({ season: season._id, user: a, kind: 'race', rating: 1300, peakRating: 1300 });

    const match = await rate('rain', a, b);

    expect(match.players[0].ratingBefore).toBe(START_RATING);
    expect((await SeasonRatingModel.findOne({ user: a, kind: 'race' }))?.rating).toBe(1300);
  });

  it('soft-resets each kind on its own', async () => {
    const user = new Types.ObjectId();
    const first = await currentSeason();
    await SeasonRatingModel.create([
      { season: first._id, user, kind: 'race', rating: 1400 },
      { season: first._id, user, kind: 'rain', rating: 800 }
    ]);

    const next = await closeSeason(String(first._id));

    expect(await startRatingFor(user, next, 'race')).toBe(1200);
    expect(await startRatingFor(user, next, 'rain')).toBe(900);
  });

  it('lists the leaderboard of one kind, race by default', async () => {
    const season = await currentSeason();
    const racer = await createUser({ email: 'racer@example.com', displayName: 'Racer' });
    const rainer = await createUser({ email: 'rainer@example.com', displayName: 'Rainer' });
    await SeasonRatingModel.create([
      { season: season._id, user: racer._id, kind: 'race', rating: 1100, matches: 9 },
      { season: season._id, user: rainer._id, kind: 'rain', rating: 1200, matches: 9 }
    ]);
    const auth = bearerFor(racer);

    const rain = await api().get('/api/ranked/leaderboard').query({ kind: 'rain' }).set('Authorization', auth);
    const race = await api().get('/api/ranked/leaderboard').set('Authorization', auth);

    expect(rain.body.items.map((row: { displayName: string }) => row.displayName)).toEqual(['Rainer']);
    expect(race.body.items.map((row: { displayName: string }) => row.displayName)).toEqual(['Racer']);
  });

  it('answers the rating of a kind on /me', async () => {
    const season = await currentSeason();
    const user = await createUser();
    await SeasonRatingModel.create({ season: season._id, user: user._id, kind: 'rain', rating: 1180, matches: 3 });

    const rain = await api().get('/api/ranked/me').query({ kind: 'rain' }).set('Authorization', bearerFor(user));
    const race = await api().get('/api/ranked/me').set('Authorization', bearerFor(user));

    expect(rain.body.rating).toBe(1180);
    expect(race.body.rating).toBe(START_RATING);
  });

  it('refuses an unknown kind', async () => {
    const auth = bearerFor(await createUser());

    expect((await api().get('/api/ranked/leaderboard').query({ kind: 'chess' }).set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/ranked/me').query({ kind: 'chess' }).set('Authorization', auth)).status).toBe(400);
  });

  it('migrates ratings saved before kinds', async () => {
    const season = await currentSeason();
    await SeasonRatingModel.collection.insertOne({ season: season._id, user: new Types.ObjectId(), rating: 1050, matches: 1, wins: 1, losses: 0, draws: 0 });

    expect((await migrateRatingKinds()).updated).toBe(1);
    expect(await SeasonRatingModel.countDocuments({ kind: 'race' })).toBe(1);
    expect((await migrateRatingKinds()).updated).toBe(0);
  });
});
