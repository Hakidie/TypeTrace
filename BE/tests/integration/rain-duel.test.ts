import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { SeasonRatingModel } from '../../src/models/season-rating.model';
import { matchSettings, resetMatchHub } from '../../src/services/match-hub';
import { seedPassages } from '../../src/services/passage-seed.service';
import { isRaining, resetRainDuel } from '../../src/services/rain-duel.service';
import { rainDuelSettings, resetRainDuelSettings } from '../../src/services/rain-duel-rules';
import { api } from '../helpers/api';
import { openEvents } from '../helpers/sse';
import { bearerFor, createUser } from '../helpers/user-factory';

type RainEvent = { type: string; side?: string; id?: string; thrownTo?: string; lives?: number; drop?: { id: string; text: string; lane: number; bornAt: number; thrown: boolean }; sides?: Record<string, unknown> };
type Stream = ReturnType<typeof openEvents>;

const create = (auth: string, kind?: string) => api().post('/api/matches').set('Authorization', auth).send(kind ? { kind } : {});
const join = (auth: string, code: string) => api().post(`/api/matches/${code}/join`).set('Authorization', auth);
const ready = (auth: string, code: string) => api().post(`/api/matches/${code}/ready`).set('Authorization', auth).send({ ready: true });
const leave = (auth: string, code: string) => api().post(`/api/matches/${code}/leave`).set('Authorization', auth);
const room = (auth: string, code: string) => api().get(`/api/matches/${code}`).set('Authorization', auth);
const type = (auth: string, code: string, text: string) => api().post(`/api/matches/${code}/rain`).set('Authorization', auth).send({ text });

let people = 0;
const person = async (displayName: string) => {
  people += 1;
  const user = await createUser({ email: `rain${people}@example.com`, displayName });
  return { id: String(user._id), auth: bearerFor(user) };
};

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 4000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out');
};

/** The next `rain` event of this type (others are dropped). */
const nextRain = async (stream: Stream, wanted: string, match: (event: RainEvent) => boolean = () => true): Promise<RainEvent> => {
  for (;;) {
    const event = (await stream.next('rain')).data as RainEvent;
    if (event.type === wanted && match(event)) return event;
  }
};

/** Two players in a running rain duel, each with an open stream. */
const startDuel = async () => {
  matchSettings.countdownMs = 20;
  const host = await person('Lan');
  const guest = await person('Minh');
  const { code } = (await create(host.auth, 'rain')).body;
  await join(guest.auth, code);
  const hostStream = openEvents(`/api/matches/${code}/events`, host.auth);
  const guestStream = openEvents(`/api/matches/${code}/events`, guest.auth);
  await hostStream.next('state');
  await guestStream.next('state');
  await ready(host.auth, code);
  await ready(guest.auth, code);
  await waitFor(async () => (await room(host.auth, code)).body.status === 'running');
  return { host, guest, code, hostStream, guestStream };
};

beforeEach(async () => {
  await seedPassages(ENGLISH_PASSAGE_LIST);
  Object.assign(rainDuelSettings, { spawnFromMs: 60, spawnToMs: 60, fallFromMs: 2000, fallToMs: 2000, durationMs: 5000 });
});

afterEach(() => {
  resetMatchHub();
  resetRainDuel();
  resetRainDuelSettings();
});

describe('rain duel rooms', () => {
  it('opens a rain room, and a race room without a kind', async () => {
    const host = await person('Lan');
    const rain = await create(host.auth, 'rain');
    expect(rain.status).toBe(201);
    expect(rain.body).toMatchObject({ kind: 'rain', status: 'waiting' });

    const other = await person('Minh');
    expect((await create(other.auth)).body.kind).toBe('race');
  });

  it('refuses an unknown kind', async () => {
    expect((await create((await person('Lan')).auth, 'chess')).status).toBe(400);
  });

  it('never shows the words of the rain in advance', async () => {
    const { host, code, hostStream, guestStream } = await startDuel();

    expect((await room(host.auth, code)).body.targetWords).toBeUndefined();
    hostStream.close();
    guestStream.close();
  });

  it('takes no race progress in a rain duel', async () => {
    const { host, code, hostStream, guestStream } = await startDuel();

    const response = await api().post(`/api/matches/${code}/progress`).set('Authorization', host.auth).send({ typedWords: [], typedAtMs: [] });

    expect(response.status).toBe(400);
    hostStream.close();
    guestStream.close();
  });
});

describe('the rain duel', () => {
  it('starts the rain after the countdown with the same words for both', async () => {
    const { host, guest, hostStream, guestStream } = await startDuel();

    const mine = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    const theirs = await nextRain(hostStream, 'spawn', (event) => event.side === guest.id);

    expect(theirs.drop).toMatchObject({ text: mine.drop!.text, lane: mine.drop!.lane, thrown: false });
    expect(Math.abs(theirs.drop!.bornAt - mine.drop!.bornAt)).toBeLessThan(20);
    hostStream.close();
    guestStream.close();
  });

  it('takes a life when a word lands', async () => {
    rainDuelSettings.fallFromMs = rainDuelSettings.fallToMs = 150;
    rainDuelSettings.graceMs = 20;
    const { host, hostStream, guestStream } = await startDuel();

    const landed = await nextRain(hostStream, 'land', (event) => event.side === host.id);

    expect(landed.lives).toBe(2);
    hostStream.close();
    guestStream.close();
  });

  it('throws a typed word to the opponent', async () => {
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    const word = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);

    const response = await type(host.auth, code, word.drop!.text.toUpperCase());

    expect(response.body).toEqual({ hit: true });
    const hit = await nextRain(guestStream, 'hit', (event) => event.side === host.id);
    expect(hit).toMatchObject({ id: word.drop!.id, thrownTo: guest.id });
    const thrown = await nextRain(guestStream, 'spawn', (event) => event.side === guest.id && event.drop!.thrown);
    expect(thrown.drop!.text).toBe(word.drop!.text);
    hostStream.close();
    guestStream.close();
  });

  it('does not throw back a thrown word', async () => {
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    const word = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    await type(host.auth, code, word.drop!.text);
    const thrown = await nextRain(guestStream, 'spawn', (event) => event.side === guest.id && event.drop!.thrown);

    // The guest now has the word twice (the rain's and the thrown one); the thrown one lands first, so it is the one hit.
    expect((await type(guest.auth, code, thrown.drop!.text)).body).toEqual({ hit: true });
    const hit = await nextRain(hostStream, 'hit', (event) => event.side === guest.id);
    expect(hit.id).toBe(thrown.drop!.id);
    expect(hit.thrownTo).toBeUndefined();
    hostStream.close();
    guestStream.close();
  });

  it("ignores a word that is not falling on the player's side", async () => {
    const { host, code, hostStream, guestStream } = await startDuel();

    expect((await type(host.auth, code, 'zzzzzz')).body).toEqual({ hit: false });
    expect((await room(host.auth, code)).body.status).toBe('running');
    hostStream.close();
    guestStream.close();
  });

  it('holds back a thrown word while the side has too many', async () => {
    rainDuelSettings.maxThrownFalling = 1;
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    const first = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    const second = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    await type(host.auth, code, first.drop!.text);
    await type(host.auth, code, second.drop!.text);

    const thrown = await nextRain(guestStream, 'spawn', (event) => event.side === guest.id && event.drop!.thrown);
    // The second throw waits: the first thrown word must go before it falls.
    await type(guest.auth, code, thrown.drop!.text);
    const next = await nextRain(guestStream, 'spawn', (event) => event.side === guest.id && event.drop!.thrown);

    expect(thrown.drop!.text).toBe(first.drop!.text);
    expect(next.drop!.text).toBe(second.drop!.text);
    hostStream.close();
    guestStream.close();
  });

  it('counts a hit within the grace time', async () => {
    rainDuelSettings.fallFromMs = rainDuelSettings.fallToMs = 200;
    rainDuelSettings.graceMs = 400;
    const { host, code, hostStream, guestStream } = await startDuel();
    const word = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, word.drop!.bornAt + 300 - Date.now())));

    expect((await type(host.auth, code, word.drop!.text)).body).toEqual({ hit: true });
    hostStream.close();
    guestStream.close();
  });
});

describe('the end of a rain duel', () => {
  it('ends by K.O. and rates the rain rating', async () => {
    rainDuelSettings.lives = 1;
    rainDuelSettings.fallFromMs = rainDuelSettings.fallToMs = 150;
    rainDuelSettings.graceMs = 20;
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    // The guest keeps typing the words of their side: only the host loses lives.
    const keepTyping = setInterval(async () => {
      const mine = await nextRain(guestStream, 'spawn', (event) => event.side === guest.id).catch(() => undefined);
      if (mine) await type(guest.auth, code, mine.drop!.text);
    }, 10);

    await waitFor(async () => (await room(host.auth, code)).body.status === 'finished');
    clearInterval(keepTyping);

    const players = (await room(host.auth, code)).body.players as { userId: string; result: string }[];
    expect(players.find((entry) => entry.userId === guest.id)?.result).toBe('win');
    expect(players.find((entry) => entry.userId === host.id)?.result).toBe('loss');
    expect(await SeasonRatingModel.countDocuments({ kind: 'rain' })).toBe(2);
    expect(isRaining(code)).toBe(false);
    hostStream.close();
    guestStream.close();
  });

  it('ends a timed-out match by lives, then words typed', async () => {
    rainDuelSettings.durationMs = 600;
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    const word = await nextRain(hostStream, 'spawn', (event) => event.side === host.id);
    await type(host.auth, code, word.drop!.text);

    await waitFor(async () => (await room(host.auth, code)).body.status === 'finished');

    const players = (await room(host.auth, code)).body.players as { userId: string; result: string; hits: number }[];
    expect(players.find((entry) => entry.userId === host.id)).toMatchObject({ result: 'win', hits: 1 });
    expect(players.find((entry) => entry.userId === guest.id)?.result).toBe('loss');
    hostStream.close();
    guestStream.close();
  });

  it('forfeits a player who leaves and stops the rain', async () => {
    const { host, guest, code, hostStream, guestStream } = await startDuel();

    await leave(host.auth, code);

    const players = (await room(guest.auth, code)).body.players as { userId: string; result: string }[];
    expect(players.find((entry) => entry.userId === host.id)?.result).toBe('forfeit');
    expect(isRaining(code)).toBe(false);
    hostStream.close();
    guestStream.close();
  });

  it('finishes a running rain match without its state as interrupted', async () => {
    const { host, code, hostStream, guestStream } = await startDuel();

    // A restart of the server: the rain lived in its memory.
    resetRainDuel();

    const after = (await room(host.auth, code)).body;
    expect(after).toMatchObject({ status: 'finished', rated: false, unratedReason: 'interrupted' });
    hostStream.close();
    guestStream.close();
  });

  it('sends a snapshot when a player reconnects', async () => {
    const { host, guest, code, hostStream, guestStream } = await startDuel();
    await nextRain(hostStream, 'spawn');
    guestStream.close();

    const again = openEvents(`/api/matches/${code}/events`, guest.auth);
    const snapshot = await nextRain(again, 'snapshot');

    expect(Object.keys(snapshot.sides!).sort()).toEqual([host.id, guest.id].sort());
    again.close();
    hostStream.close();
  });
});
