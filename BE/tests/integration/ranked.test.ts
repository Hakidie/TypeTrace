import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { MatchModel } from '../../src/models/match.model';
import { SeasonRatingModel } from '../../src/models/season-rating.model';
import { matchSettings, resetMatchHub } from '../../src/services/match-hub';
import { seedPassages } from '../../src/services/passage-seed.service';
import { closeSeason, currentSeason } from '../../src/services/season.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const create = (auth: string) => api().post('/api/matches').set('Authorization', auth);
const join = (auth: string, code: string) => api().post(`/api/matches/${code}/join`).set('Authorization', auth);
const leave = (auth: string, code: string) => api().post(`/api/matches/${code}/leave`).set('Authorization', auth);
const room = (auth: string, code: string) => api().get(`/api/matches/${code}`).set('Authorization', auth);
const ready = (auth: string, code: string) => api().post(`/api/matches/${code}/ready`).set('Authorization', auth).send({ ready: true });
const progress = (auth: string, code: string, typedWords: string[], done = false) =>
  api()
    .post(`/api/matches/${code}/progress`)
    .set('Authorization', auth)
    .send({ typedWords, typedAtMs: typedWords.map((_, i) => (i + 1) * 100), done });

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 3000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out');
};

let people = 0;
const player = async (displayName: string) => {
  people += 1;
  const user = await createUser({ email: `ranked${people}@example.com`, displayName });
  return { id: String(user._id), auth: bearerFor(user) };
};
type Player = Awaited<ReturnType<typeof player>>;

/** A running race of these two players, started a minute ago so typing the whole passage stays under 200 WPM. */
const race = async (host: Player, guest: Player, { startedAgoMs = 60_000 } = {}) => {
  matchSettings.countdownMs = 20;
  const { code } = (await create(host.auth)).body;
  await join(guest.auth, code);
  await ready(host.auth, code);
  await ready(guest.auth, code);
  await waitFor(async () => (await room(host.auth, code)).body.status === 'running');
  if (startedAgoMs) await MatchModel.updateOne({ code, status: 'running' }, { startedAt: new Date(Date.now() - startedAgoMs) });
  const words: string[] = (await room(host.auth, code)).body.targetWords;
  return { code, words };
};

/** `host` wins a rated race against `guest`; answers the finished room. */
const win = async (host: Player, guest: Player) => {
  const { code, words } = await race(host, guest);
  await progress(host.auth, code, words, true);
  return (await room(host.auth, code)).body;
};

const ratingOf = async (user: Player) => {
  const season = await currentSeason();
  return SeasonRatingModel.findOne({ season: season._id, user: user.id });
};

type View = { displayName: string; ratingBefore?: number; ratingAfter?: number };
const changes = (match: { players: View[] }) => match.players.map((entry) => [entry.displayName, entry.ratingBefore, entry.ratingAfter]);

beforeEach(async () => {
  await seedPassages(ENGLISH_PASSAGE_LIST);
});

afterEach(() => {
  resetMatchHub();
});

describe('Elo (ranked duel, phase 5)', () => {
  it('rates a finished race: K = 40 in the first 10 matches of a player', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');

    const match = await win(lan, minh);

    expect(match.rated).toBe(true);
    expect(changes(match)).toEqual([
      ['Lan', 1000, 1020],
      ['Minh', 1000, 980]
    ]);
    expect(await ratingOf(lan)).toMatchObject({ rating: 1020, peakRating: 1020, matches: 1, wins: 1, losses: 0 });
    // The peak is the best rating after a match: the start of the season is not one (phase 6 review).
    expect(await ratingOf(minh)).toMatchObject({ rating: 980, peakRating: 980, matches: 1, wins: 0, losses: 1 });
  });

  it('uses K = 32 once a player has 10 matches in the season', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const season = await currentSeason();
    await SeasonRatingModel.create([
      { season: season._id, user: lan.id, rating: 1000, peakRating: 1000, matches: 10 },
      { season: season._id, user: minh.id, rating: 1000, peakRating: 1000, matches: 10 }
    ]);

    expect(changes(await win(lan, minh))).toEqual([
      ['Lan', 1000, 1016],
      ['Minh', 1000, 984]
    ]);
  });

  it('moves no points in a draw between equal ratings, and counts the draw', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh);
    const same = words.map((word, i) => (i % 2 ? 'x' : word));
    await progress(lan.auth, code, same, true);
    await progress(minh.auth, code, same, true);

    expect(changes((await room(lan.auth, code)).body)).toEqual([
      ['Lan', 1000, 1000],
      ['Minh', 1000, 1000]
    ]);
    expect(await ratingOf(lan)).toMatchObject({ matches: 1, draws: 1 });
  });

  it('rates a forfeit during the race as a loss', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code } = await race(lan, minh);

    const match = (await leave(minh.auth, code)).body;

    expect(match.rated).toBe(true);
    expect(changes(match)).toEqual([
      ['Lan', 1000, 1020],
      ['Minh', 1000, 980]
    ]);
  });

  it('does not rate a match left during the countdown', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    matchSettings.countdownMs = 10_000;
    const { code } = (await create(lan.auth)).body;
    await join(minh.auth, code);
    await ready(lan.auth, code);
    await ready(minh.auth, code);

    const match = (await leave(minh.auth, code)).body;

    expect(match).toMatchObject({ status: 'finished', rated: false, unratedReason: 'not-started' });
    expect(await ratingOf(lan)).toBeNull();
  });

  it('does not rate a match flagged for typing over 200 WPM', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh, { startedAgoMs: 0 });
    await progress(minh.auth, code, words.slice(0, 25));

    expect((await room(lan.auth, code)).body).toMatchObject({ status: 'finished', rated: false, unratedReason: 'flagged' });
    expect(await ratingOf(lan)).toBeNull();
  });

  it('rates the same two players 3 times a day at most', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    for (let i = 0; i < 3; i++) expect((await win(lan, minh)).rated).toBe(true);

    const fourth = await win(minh, lan);

    expect(fourth).toMatchObject({ rated: false, unratedReason: 'pair-limit' });
    expect(fourth.players.every((entry: View) => entry.ratingAfter === undefined)).toBe(true);
    expect(await ratingOf(lan)).toMatchObject({ matches: 3, wins: 3 });
  });

  it('starts a player of the last season halfway back to 1000 at their first match of the new one', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1500, peakRating: 1500, matches: 30 });
    const next = await closeSeason(String(first._id));
    // As when the match was rated while the season was still closing: no carried-over rating yet.
    await SeasonRatingModel.deleteMany({ season: next._id });

    const match = await win(lan, minh);

    // 1250 against 1000: E ≈ 0.81, K 40 (first match of the season) → +8.
    expect(changes(match)[0]).toEqual(['Lan', 1250, 1258]);
  });

  it('settles a race left running by a restart once, when both players come back at the same moment', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh);
    await progress(lan.auth, code, words.slice(0, 3));
    // A restart: the timer that ends the race is gone, and the time is long up.
    resetMatchHub();
    await MatchModel.updateOne({ code, status: 'running' }, { startedAt: new Date(Date.now() - 10 * 60_000) });

    await Promise.all([room(lan.auth, code), room(minh.auth, code), room(lan.auth, code)]);

    expect(await ratingOf(lan)).toMatchObject({ rating: 1020, matches: 1, wins: 1 });
    expect(await ratingOf(minh)).toMatchObject({ rating: 980, matches: 1, losses: 1 });
    const settled = (await room(lan.auth, code)).body;
    expect(settled).toMatchObject({ status: 'finished', rated: true });
    expect(changes(settled)).toEqual([
      ['Lan', 1000, 1020],
      ['Minh', 1000, 980]
    ]);
  });

  it('counts the day in Vietnam time: rated matches from before 0:00 (UTC+7) do not count', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    for (let i = 0; i < 3; i++) await win(lan, minh);
    // Vietnam's midnight is 17:00 UTC of the day before; move the three matches to just before it.
    const now = new Date();
    const vnMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -7);
    const midnight = vnMidnight > now.getTime() ? vnMidnight - 86_400_000 : vnMidnight;
    await MatchModel.updateMany({ rated: true }, { endedAt: new Date(midnight - 60_000) });

    expect((await win(lan, minh)).rated).toBe(true);
  });
});

const me = (auth: string) => api().get('/api/ranked/me').set('Authorization', auth);
const leaderboard = (auth: string, query = '') => api().get(`/api/ranked/leaderboard${query}`).set('Authorization', auth);

describe('ranked API (ranked duel, phase 5)', () => {
  it('needs a signed-in user', async () => {
    expect((await api().get('/api/ranked/me')).status).toBe(401);
    expect((await api().get('/api/ranked/leaderboard')).status).toBe(401);
  });

  it('shows a new player 1000, Bronze, in the current season', async () => {
    const lan = await player('Lan');
    const response = await me(lan.auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ season: { number: 1 }, rating: 1000, peakRating: 1000, tier: 'Bronze', matches: 0, wins: 0 });
  });

  it('shows the own rating after a match', async () => {
    const lan = await player('Lan');
    await win(lan, await player('Minh'));

    expect((await me(lan.auth)).body).toMatchObject({ rating: 1020, matches: 1, wins: 1, losses: 0 });
  });

  it('lists the season by rating, only players with 5 matches, by name and never by email', async () => {
    const season = await currentSeason();
    const lan = await player('Lan');
    const minh = await player('Minh');
    const anonymous = await player('');
    const newcomer = await player('Newcomer');
    await SeasonRatingModel.create([
      { season: season._id, user: lan.id, rating: 1260, peakRating: 1300, matches: 10, wins: 7, losses: 3 },
      { season: season._id, user: minh.id, rating: 1420, peakRating: 1420, matches: 5, wins: 5 },
      { season: season._id, user: anonymous.id, rating: 990, peakRating: 1000, matches: 8, wins: 2, losses: 6 },
      { season: season._id, user: newcomer.id, rating: 1800, peakRating: 1800, matches: 4, wins: 4 }
    ]);

    const response = await leaderboard(lan.auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, total: 3, totalPages: 1 });
    expect(response.body.items.map((row: Record<string, unknown>) => [row.rank, row.displayName, row.rating, row.tier, row.winRate])).toEqual([
      [1, 'Minh', 1420, 'Platinum', 1],
      [2, 'Lan', 1260, 'Gold', 0.7],
      [3, 'Anonymous player', 990, 'Bronze', 0.25]
    ]);
    expect(response.body.items[0]).toMatchObject({ userId: minh.id, matches: 5, avatar: expect.any(Object) });
    expect(JSON.stringify(response.body)).not.toContain('@example.com');
  });

  it('numbers the ranks across pages', async () => {
    const season = await currentSeason();
    const people = await Promise.all(['A', 'B', 'C'].map((name) => player(name)));
    await SeasonRatingModel.create(
      people.map((entry, index) => ({ season: season._id, user: entry.id, rating: 1100 - index, peakRating: 1100, matches: 5 }))
    );

    const second = await leaderboard(people[0].auth, '?page=2&limit=2');

    expect(second.body.items.map((row: { rank: number; displayName: string }) => [row.rank, row.displayName])).toEqual([[3, 'C']]);
    expect((await leaderboard(people[0].auth, '?limit=500')).status).toBe(400);
  });
});

const admin = async () => bearerFor(await createUser({ email: `admin${++people}@example.com`, role: 'admin' }));

describe('admin seasons (ranked duel, phase 5)', () => {
  it('is for admins only', async () => {
    const learner = await player('Lan');
    expect((await api().get('/api/admin/seasons').set('Authorization', learner.auth)).status).toBe(403);
  });

  it('lists the seasons, newest first', async () => {
    const auth = await admin();
    const first = await currentSeason();
    await api().post(`/api/admin/seasons/${first._id}/close`).set('Authorization', auth);

    const response = await api().get('/api/admin/seasons').set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body.items.map((season: { number: number; status: string }) => [season.number, season.status])).toEqual([
      [2, 'active'],
      [1, 'closed']
    ]);
  });

  it('closes a season early and opens the next, with ratings halfway back to 1000', async () => {
    const auth = await admin();
    const lan = await player('Lan');
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1300, peakRating: 1300, matches: 9 });

    const response = await api().post(`/api/admin/seasons/${first._id}/close`).set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ number: 2, status: 'active' });
    expect((await me(lan.auth)).body).toMatchObject({ season: { number: 2 }, rating: 1150, matches: 0 });
  });

  it('answers 404 for an unknown season and 400 for a bad id', async () => {
    const auth = await admin();
    expect((await api().post('/api/admin/seasons/64b7f0000000000000000000/close').set('Authorization', auth)).status).toBe(404);
    expect((await api().post('/api/admin/seasons/bad/close').set('Authorization', auth)).status).toBe(400);
  });
});
