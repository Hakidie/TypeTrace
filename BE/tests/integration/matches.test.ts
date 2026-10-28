import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { MatchModel } from '../../src/models/match.model';
import { PassageModel } from '../../src/models/passage.model';
import { matchSettings, resetMatchHub } from '../../src/services/match-hub';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { openEvents } from '../helpers/sse';
import { bearerFor, createUser } from '../helpers/user-factory';

const create = (auth: string) => api().post('/api/matches').set('Authorization', auth);
const join = (auth: string, code: string) => api().post(`/api/matches/${code}/join`).set('Authorization', auth);
const leave = (auth: string, code: string) => api().post(`/api/matches/${code}/leave`).set('Authorization', auth);
const room = (auth: string, code: string) => api().get(`/api/matches/${code}`).set('Authorization', auth);

let people = 0;
const player = async (displayName?: string) => {
  people += 1;
  return bearerFor(await createUser({ email: `player${people}@example.com`, displayName }));
};

beforeEach(async () => {
  await seedPassages(ENGLISH_PASSAGE_LIST);
});

afterEach(() => {
  resetMatchHub();
});

describe('rooms (ranked duel, phase 3)', () => {
  it('needs a signed-in user', async () => {
    expect((await api().post('/api/matches')).status).toBe(401);
  });

  it('creates a waiting room with a code, the host shown by name, and no passage words yet', async () => {
    const response = await create(await player('Lan'));

    expect(response.status).toBe(201);
    expect(response.body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(response.body).toMatchObject({ status: 'waiting', rated: false });
    expect(response.body.players).toHaveLength(1);
    expect(response.body.players[0]).toMatchObject({ displayName: 'Lan', ready: false });
    expect(response.body.targetWords).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('@example.com');
  });

  it('shows a player without a display name as an anonymous player', async () => {
    expect((await create(await player())).body.players[0].displayName).toBe('Anonymous player');
  });

  it('answers 404 when the bank has no English passage', async () => {
    await PassageModel.deleteMany({ language: 'en' });
    const response = await create(await player());

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No English passage available');
  });

  it('lets a second player join with the code, typed in any case', async () => {
    const { code } = (await create(await player('Lan'))).body;
    const response = await join(await player('Minh'), code.toLowerCase());

    expect(response.status).toBe(200);
    expect(response.body.players.map((entry: { displayName: string }) => entry.displayName)).toEqual(['Lan', 'Minh']);
  });

  it('refuses a wrong code, the own room, a full room and a player already in another room', async () => {
    const host = await player();
    const { code } = (await create(host)).body;

    expect((await join(await player(), 'ZZZZZZ')).body.message).toBe('Room not found');
    expect((await join(await player(), 'bad')).status).toBe(400);
    const own = await join(host, code);
    expect(own.status).toBe(400);
    expect(own.body.message).toBe('You are already in this room');
    await join(await player(), code);
    const full = await join(await player(), code);
    expect(full.status).toBe(409);
    expect(full.body.message).toBe('Room is full');

    const busy = await player();
    await create(busy);
    const other = await join(busy, (await create(await player())).body.code);
    expect(other.status).toBe(409);
    expect(other.body.message).toBe('You are already in another room');
    expect((await create(busy)).status).toBe(409);
  });

  it('closes a room nobody joined for too long', async () => {
    matchSettings.waitingExpiryMs = 50;
    const host = await player();
    const { code } = (await create(host)).body;
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect((await join(await player(), code)).status).toBe(404);
    expect((await create(host)).status).toBe(201);
  });

  it('shows the room only to its players', async () => {
    const host = await player();
    const { code } = (await create(host)).body;

    expect((await room(host, code)).body.code).toBe(code);
    expect((await room(await player(), code)).status).toBe(404);
  });

  it('sends the guest back out, or cancels the room when the host leaves', async () => {
    const host = await player();
    const guest = await player();
    const { code } = (await create(host)).body;
    await join(guest, code);

    expect((await leave(guest, code)).body.players).toHaveLength(1);
    await join(guest, code);
    expect((await leave(host, code)).body.status).toBe('cancelled');
    expect((await MatchModel.findOne({ code }))!.status).toBe('cancelled');
  });

  it('streams the room to its players: the state at once, then each change', async () => {
    const host = await player('Lan');
    const { code } = (await create(host)).body;
    const stream = openEvents(`/api/matches/${code}/events`, host);

    expect(await stream.status).toBe(200);
    expect(((await stream.next('state')).data as { players: unknown[] }).players).toHaveLength(1);
    await join(await player('Minh'), code);
    expect(((await stream.next('state')).data as { players: unknown[] }).players).toHaveLength(2);
    stream.close();
  });

  it('does not stream a room to someone outside it', async () => {
    const { code } = (await create(await player())).body;

    expect(await openEvents(`/api/matches/${code}/events`, await player()).status).toBe(404);
  });
});

// ---- the race (Task 3) -------------------------------------------------------------------------------------------
const ready = (auth: string, code: string, value = true) =>
  api().post(`/api/matches/${code}/ready`).set('Authorization', auth).send({ ready: value });
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

/** A room with two players whose race is running; started a minute ago so typing fast stays under 200 WPM. */
const startRace = async ({ startedAgoMs = 60_000 } = {}) => {
  matchSettings.countdownMs = 20;
  const host = await player('Lan');
  const guest = await player('Minh');
  const { code } = (await create(host)).body;
  await join(guest, code);
  await ready(host, code);
  await ready(guest, code);
  await waitFor(async () => (await room(host, code)).body.status === 'running');
  if (startedAgoMs) await MatchModel.updateOne({ code, status: 'running' }, { startedAt: new Date(Date.now() - startedAgoMs) });
  const words: string[] = (await room(host, code)).body.targetWords;
  return { host, guest, code, words };
};

type Row = [string, string | undefined];
const resultsOf = async (auth: string, code: string): Promise<Row[]> =>
  (await room(auth, code)).body.players.map((entry: { displayName: string; result?: string }) => [entry.displayName, entry.result]);
const onlyResults = (rows: Row[]) => rows.map(([, result]) => result);

describe('the race (ranked duel, phase 3)', () => {
  it('counts down once both players are ready, then runs with the passage words', async () => {
    matchSettings.countdownMs = 20;
    const host = await player();
    const guest = await player();
    const { code } = (await create(host)).body;
    await join(guest, code);
    const stream = openEvents(`/api/matches/${code}/events`, host);
    await stream.next('state');

    expect((await ready(host, code)).body.status).toBe('waiting');
    const both = await ready(guest, code);
    expect(both.body.status).toBe('countdown');
    expect(both.body.countdownEndsAt).toBeDefined();
    await stream.next('countdown');
    await waitFor(async () => (await room(host, code)).body.status === 'running');
    const running = (await room(host, code)).body;
    expect(running.targetWords.length).toBeGreaterThanOrEqual(30);
    expect(running.startedAt).toBeDefined();
    stream.close();
  });

  it('takes no progress before the race runs', async () => {
    const host = await player();
    const { code } = (await create(host)).body;
    const response = await progress(host, code, ['The']);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('The match is not running');
  });

  it('grades the progress and streams it to the other player without the typed words', async () => {
    const { host, guest, code, words } = await startRace();
    const stream = openEvents(`/api/matches/${code}/events`, host);
    await stream.next('state');

    const response = await progress(guest, code, [words[0], words[1], 'wrong']);
    expect(response.body).toMatchObject({ typedCount: 3, correctWords: 2, finished: false });
    const event = (await stream.next('progress')).data as Record<string, unknown>;
    expect(event).toMatchObject({ typedCount: 3, correctWords: 2 });
    expect(JSON.stringify(event)).not.toContain('wrong');
    stream.close();
  });

  it('ends the race when a player finishes with at least 90% correct', async () => {
    const { host, guest, code, words } = await startRace();
    const stream = openEvents(`/api/matches/${code}/events`, guest);
    await stream.next('state');

    expect((await progress(host, code, words, true)).body.finished).toBe(true);
    expect(await resultsOf(host, code)).toEqual([
      ['Lan', 'win'],
      ['Minh', 'loss']
    ]);
    expect((await room(host, code)).body.status).toBe('finished');
    expect(((await stream.next('result')).data as { status: string }).status).toBe('finished');
    stream.close();
  });

  it('lets the other player win when the first finisher is under 90%', async () => {
    const { host, guest, code, words } = await startRace();
    const half = words.map((word, i) => (i % 2 ? 'x' : word));

    expect((await progress(host, code, half, true)).body.finished).toBe(true);
    expect((await room(host, code)).body.status).toBe('running');
    await progress(guest, code, words, true);
    expect(await resultsOf(host, code)).toEqual([
      ['Lan', 'loss'],
      ['Minh', 'win']
    ]);
  });

  it('compares the correct words when both finish under 90%, a tie is a draw', async () => {
    const { host, guest, code, words } = await startRace();
    const keep = (every: number) => words.map((word, i) => (i % every ? 'x' : word));

    await progress(host, code, keep(2), true);
    await progress(guest, code, keep(3), true);
    expect(onlyResults(await resultsOf(host, code))).toEqual(['win', 'loss']);

    const again = await startRace();
    const same = again.words.map((word, i) => (i % 2 ? 'x' : word));
    await progress(again.host, again.code, same, true);
    await progress(again.guest, again.code, same, true);
    expect(onlyResults(await resultsOf(again.host, again.code))).toEqual(['draw', 'draw']);
  });

  it('ends the race when the time is up, by correct words', async () => {
    matchSettings.durationMs = 300;
    const { host, guest, code, words } = await startRace({ startedAgoMs: 0 });
    await progress(host, code, words.slice(0, 2));
    await progress(guest, code, words.slice(0, 1));

    await waitFor(async () => (await room(host, code)).body.status === 'finished');
    expect(onlyResults(await resultsOf(host, code))).toEqual(['win', 'loss']);
  });

  it('makes a player typing over 200 WPM lose and flags the match', async () => {
    const { host, guest, code, words } = await startRace({ startedAgoMs: 0 });

    await progress(guest, code, words.slice(0, 10));
    expect(onlyResults(await resultsOf(host, code))).toEqual(['win', 'loss']);
    expect((await MatchModel.findOne({ code }).sort({ createdAt: -1 }))!.flagged).toBe(true);
  });

  it('refuses progress that goes back, times out of order, an early finish, and late or outside senders', async () => {
    const { host, guest, code, words } = await startRace();
    await progress(host, code, words.slice(0, 5));

    const back = await progress(host, code, words.slice(0, 2));
    expect(back.status).toBe(400);
    expect(back.body.message).toBe('Progress cannot go back');
    const unordered = await api()
      .post(`/api/matches/${code}/progress`)
      .set('Authorization', host)
      .send({ typedWords: words.slice(0, 6), typedAtMs: [600, 500, 400, 300, 200, 100] });
    expect(unordered.status).toBe(400);
    expect((await progress(host, code, words.slice(0, 6), true)).status).toBe(400);
    expect((await progress(await player(), code, words.slice(0, 1))).status).toBe(404);

    const half = words.map((word, i) => (i % 2 ? 'x' : word));
    await progress(host, code, half, true);
    const again = await progress(host, code, half, true);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('You already finished');
    await progress(guest, code, words, true);
    expect((await progress(guest, code, words, true)).body.message).toBe('The match is not running');
  });

  it('has exactly one winner when both finish at the same moment', async () => {
    const { host, guest, code, words } = await startRace();

    await Promise.all([progress(host, code, words, true), progress(guest, code, words, true)]);
    expect(onlyResults(await resultsOf(host, code)).sort()).toEqual(['loss', 'win']);
  });
});
