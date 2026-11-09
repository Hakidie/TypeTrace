import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WordChainScoreModel } from '../../src/models/word-chain-score.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Wednesday 11 March 2026, 12:00 in Vietnam. The week starts on Monday 9 March at 0:00 there (2026-03-08T17:00:00Z).
const NOW = new Date('2026-03-11T05:00:00.000Z');
const LAST_WEEK = new Date('2026-03-05T05:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

let counter = 0;
const newUser = (displayName?: string, status?: 'active' | 'locked') => {
  counter += 1;
  return createUser({ email: `chain${counter}@example.com`, displayName, status });
};

const bot = (word: string) => ({ by: 'bot' as const, word });
const me = (word: string) => ({ by: 'me' as const, word });

describe('POST /api/word-chain/scores', () => {
  it('works out the score from the chain: +1 a word, +2 when the bot is stuck, nothing for a skip', async () => {
    const user = await newUser('Lan');
    const chain = [bot('học sinh'), me('sinh viên'), bot('viên chức'), bot('thể thao'), me('thao tác'), bot('hoa hồng'), me('hồng hào')];
    const res = await api().post('/api/word-chain/scores').set('Authorization', bearerFor(user)).send({ chain });
    // sinh viên +1, thao tác +1 (viên chức → thể thao is a skip), hoa hồng after thao tác does not chain: bot stuck +2, hồng hào +1
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ score: 5 });
    expect(await WordChainScoreModel.countDocuments({ user: user._id, score: 5, links: 7 })).toBe(1);
  });

  it('compares tones wherever the mark sits', async () => {
    const user = await newUser();
    const res = await api().post('/api/word-chain/scores').set('Authorization', bearerFor(user)).send({ chain: [bot('cuộc thi'), me('thi đua')] });
    expect(res.body).toEqual({ score: 1 });
  });

  it.each([
    ['a word that is not in the list', [bot('học sinh'), me('sinh xyz')]],
    ['a word that does not chain on', [bot('học sinh'), me('viên chức')]],
    ['a word used twice', [bot('học sinh'), me('sinh viên'), bot('học sinh')]],
    ['a chain the player starts', [me('học sinh'), bot('sinh viên')]],
    ['two player words in a row', [bot('học sinh'), me('sinh viên'), me('viên chức')]]
  ])('refuses %s', async (_name, chain) => {
    const user = await newUser();
    const res = await api().post('/api/word-chain/scores').set('Authorization', bearerFor(user)).send({ chain });
    expect(res.status).toBe(400);
    expect(await WordChainScoreModel.countDocuments()).toBe(0);
  });

  it('does not save a game of 0 points and needs a sign-in', async () => {
    const user = await newUser();
    const res = await api().post('/api/word-chain/scores').set('Authorization', bearerFor(user)).send({ chain: [bot('học sinh')] });
    expect(res.body).toEqual({ score: 0 });
    expect(await WordChainScoreModel.countDocuments()).toBe(0);
    expect((await api().post('/api/word-chain/scores').send({ chain: [bot('học sinh')] })).status).toBe(401);
  });
});

describe('GET /api/word-chain/leaderboard', () => {
  it('ranks the best game of each active player this week or all the time, with names only', async () => {
    const [lan, minh, hoa, locked] = await Promise.all([newUser('Lan'), newUser('Minh'), newUser(), newUser('Khóa', 'locked')]);
    await WordChainScoreModel.create([
      { user: lan._id, score: 12, links: 30 },
      { user: lan._id, score: 7, links: 20 },
      { user: minh._id, score: 9, links: 25 },
      { user: hoa._id, score: 30, links: 70, createdAt: LAST_WEEK },
      { user: locked._id, score: 50, links: 99 }
    ]);

    const week = await api().get('/api/word-chain/leaderboard?range=week').set('Authorization', bearerFor(minh));
    expect(week.status).toBe(200);
    expect(week.body.items.map((i: { displayName: string; score: number }) => [i.displayName, i.score])).toEqual([
      ['Lan', 12],
      ['Minh', 9]
    ]);
    expect(week.body.items[1].isMe).toBe(true);
    expect(week.body.me).toEqual({ rank: 2, score: 9 });
    expect(JSON.stringify(week.body)).not.toContain('@example.com');

    const all = await api().get('/api/word-chain/leaderboard?range=all').set('Authorization', bearerFor(hoa));
    expect(all.body.items[0]).toMatchObject({ rank: 1, displayName: 'Anonymous player', score: 30, isMe: true });
    expect(all.body.items).toHaveLength(3);
  });

  it('has no place for a player without a game', async () => {
    const user = await newUser();
    const res = await api().get('/api/word-chain/leaderboard').set('Authorization', bearerFor(user));
    expect(res.body).toEqual({ range: 'week', items: [], me: null });
  });
});
