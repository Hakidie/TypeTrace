import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEASON_ITEMS } from '../../src/data/avatar-catalog';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { MatchModel } from '../../src/models/match.model';
import { SeasonRatingModel } from '../../src/models/season-rating.model';
import { UserModel } from '../../src/models/user.model';
import { matchSettings, resetMatchHub } from '../../src/services/match-hub';
import { seedPassages } from '../../src/services/passage-seed.service';
import { closeSeason, currentSeason } from '../../src/services/season.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const create = (auth: string) => api().post('/api/matches').set('Authorization', auth);
const join = (auth: string, code: string) => api().post(`/api/matches/${code}/join`).set('Authorization', auth);
const room = (auth: string, code: string) => api().get(`/api/matches/${code}`).set('Authorization', auth);
const ready = (auth: string, code: string) => api().post(`/api/matches/${code}/ready`).set('Authorization', auth).send({ ready: true });
const progress = (auth: string, code: string, typedWords: string[], done = false) =>
  api()
    .post(`/api/matches/${code}/progress`)
    .set('Authorization', auth)
    .send({ typedWords, typedAtMs: typedWords.map((_, i) => (i + 1) * 100), done });
const buy = (auth: string, item: string) => api().post('/api/avatar/buy').set('Authorization', auth).send({ item });

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
  const user = await createUser({ email: `rewards${people}@example.com`, displayName });
  return { id: String(user._id), auth: bearerFor(user) };
};
type Player = Awaited<ReturnType<typeof player>>;

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

const coinsOf = async (user: Player) => (await UserModel.findById(user.id))!.coins;
const setCoins = (user: Player, coins: number) => UserModel.updateOne({ _id: user.id }, { coins });
const ownedOf = async (user: Player) => (await UserModel.findById(user.id))!.ownedItems;

beforeEach(async () => {
  await seedPassages(ENGLISH_PASSAGE_LIST);
});

afterEach(() => {
  resetMatchHub();
});

describe('coins after a match (ranked duel, phase 6)', () => {
  it('gives 20 coins for a rated win and 5 for a loss, shown on the result', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh);
    await progress(lan.auth, code, words, true);

    expect(await coinsOf(lan)).toBe(20);
    expect(await coinsOf(minh)).toBe(5);
    expect((await room(lan.auth, code)).body.players.map((entry: { coins?: number }) => entry.coins)).toEqual([20, 5]);
  });

  it('gives 10 coins each for a draw', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh);
    const same = words.map((word, i) => (i % 2 ? 'x' : word));
    await progress(lan.auth, code, same, true);
    await progress(minh.auth, code, same, true);

    expect([await coinsOf(lan), await coinsOf(minh)]).toEqual([10, 10]);
  });

  it('gives no coins for a match that is not rated', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const { code, words } = await race(lan, minh, { startedAgoMs: 0 });
    await progress(minh.auth, code, words.slice(0, 25));

    expect([await coinsOf(lan), await coinsOf(minh)]).toEqual([0, 0]);
  });

  it('gives 200 coins a day at most (Vietnam time)', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    // 190 coins already earned today in another match.
    await MatchModel.create({
      code: 'EARLY2',
      status: 'finished',
      rated: true,
      endedAt: new Date(),
      passageId: new Types.ObjectId(),
      passageTitle: 'Earlier',
      targetWords: ['a'],
      players: [{ user: lan.id, displayName: 'Lan', avatar: {}, coins: 190 }]
    });
    const { code, words } = await race(lan, minh);
    await progress(lan.auth, code, words, true);

    expect(await coinsOf(lan)).toBe(10);
    expect((await room(lan.auth, code)).body.players[0].coins).toBe(10);
  });
});

describe('the shop (ranked duel, phase 6)', () => {
  it('sells an item for its price and answers the catalog', async () => {
    const lan = await player('Lan');
    await setCoins(lan, 150);

    const response = await buy(lan.auth, 'hair:ponytail-pink');

    expect(response.status).toBe(200);
    expect(response.body.coins).toBe(50);
    expect(response.body.slots.hair.find((item: { id: string }) => item.id === 'ponytail-pink')).toMatchObject({ owned: true });
    expect(await ownedOf(lan)).toContain('hair:ponytail-pink');
  });

  it('refuses an item already owned, a free one, a reward, an unknown one and too few coins', async () => {
    const lan = await player('Lan');
    await setCoins(lan, 120);
    await buy(lan.auth, 'hair:ponytail-pink');

    const again = await buy(lan.auth, 'hair:ponytail-pink');
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('You already own this item');
    expect((await buy(lan.auth, 'hair:short-pink')).body.message).toBe('This item is not sold');
    expect((await buy(lan.auth, 'headwear:halo')).body.message).toBe('This item is not sold');
    expect((await buy(lan.auth, 'hair:nope')).status).toBe(400);
    expect((await buy(lan.auth, 'bad')).status).toBe(400);
    const poor = await buy(lan.auth, 'back:cape-red');
    expect(poor.status).toBe(400);
    expect(poor.body.message).toBe('Not enough coins');
    expect(await coinsOf(lan)).toBe(20);
  });

  it('never spends below zero when two buys come at once', async () => {
    const lan = await player('Lan');
    await setCoins(lan, 100);

    const answers = await Promise.all([buy(lan.auth, 'hair:ponytail-pink'), buy(lan.auth, 'hair:ponytail-silver'), buy(lan.auth, 'hair:ponytail-pink')]);

    expect(answers.filter((answer) => answer.status === 200)).toHaveLength(1);
    expect(await coinsOf(lan)).toBe(0);
    expect(await ownedOf(lan)).toHaveLength(1);
  });

  it('needs a signed-in user', async () => {
    expect((await api().post('/api/avatar/buy').send({ item: 'hair:ponytail-pink' })).status).toBe(401);
  });
});

describe('season rewards (ranked duel, phase 6)', () => {
  it('gives each season its own reward item', async () => {
    const first = await currentSeason();
    const second = await closeSeason(String(first._id));

    expect(first.rewardItem).toBe(SEASON_ITEMS[0]);
    expect(second.rewardItem).toBe(SEASON_ITEMS[1]);
  });

  it('gives the items of the highest tier reached and every tier under it, plus the season item from Gold', async () => {
    const lan = await player('Lan');
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1300, peakRating: 1420, matches: 20 });

    await closeSeason(String(first._id));

    expect((await ownedOf(lan)).sort()).toEqual(['back:angel-wings', 'effect:stars', first.rewardItem].sort());
  });

  it('turns a reward already owned into 100 coins', async () => {
    const lan = await player('Lan');
    await UserModel.updateOne({ _id: lan.id }, { ownedItems: ['effect:stars'] });
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1260, peakRating: 1260, matches: 8 });

    await closeSeason(String(first._id));

    expect(await coinsOf(lan)).toBe(100);
    expect((await ownedOf(lan)).sort()).toEqual(['effect:stars', first.rewardItem].sort());
  });

  it('does not count the start of a season (the soft reset) as a tier reached', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1500, peakRating: 1500, matches: 30 });
    const second = await closeSeason(String(first._id));
    await UserModel.updateOne({ _id: lan.id }, { ownedItems: [], coins: 0 });
    // Lan starts season 2 at 1250 (Gold) and loses the one match she plays.
    const { code, words } = await race(lan, minh);
    await progress(minh.auth, code, words, true);

    await closeSeason(String(second._id));

    expect(await ownedOf(lan)).toEqual([]);
  });

  it('still closes the season when giving rewards fails, and gives them on the next try', async () => {
    const lan = await player('Lan');
    const first = await currentSeason();
    await SeasonRatingModel.create({ season: first._id, user: lan.id, rating: 1300, peakRating: 1300, matches: 9 });
    const failing = vi.spyOn(UserModel, 'findById').mockImplementationOnce(() => {
      throw new Error('database hiccup');
    });

    const next = await closeSeason(String(first._id));
    failing.mockRestore();

    expect(next.number).toBe(2);
    expect(await ownedOf(lan)).toEqual([]);
    await closeSeason(String(first._id));
    expect((await ownedOf(lan)).sort()).toEqual(['effect:stars', first.rewardItem].sort());
  });

  it('gives nothing under Gold, and rewards a season once', async () => {
    const lan = await player('Lan');
    const minh = await player('Minh');
    const first = await currentSeason();
    await SeasonRatingModel.create([
      { season: first._id, user: lan.id, rating: 1200, peakRating: 1249, matches: 8 },
      { season: first._id, user: minh.id, rating: 1720, peakRating: 1720, matches: 40 }
    ]);

    await closeSeason(String(first._id));
    await closeSeason(String(first._id));

    expect(await ownedOf(lan)).toEqual([]);
    expect((await ownedOf(minh)).sort()).toEqual(
      ['back:angel-wings', 'effect:stars', 'headwear:crown', 'headwear:halo', first.rewardItem].sort()
    );
    expect(await coinsOf(minh)).toBe(0);
  });
});
