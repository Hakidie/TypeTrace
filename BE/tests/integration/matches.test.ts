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
