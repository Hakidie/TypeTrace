import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
import { MAX_REPLAY_BYTES, REPLAY_TTL_MS, SessionReplayModel } from '../../src/models/session-replay.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

/** "Tiếng V" typed with Telex as the page records it: marks replace letters, the space commits the word, "V" is still composing, then time runs out. */
const replay = [
  [0, 0, 0, 'T'],
  [180, 1, 0, 'i'],
  [150, 2, 0, 'e'],
  [140, 2, 1, 'ê'],
  [160, 3, 0, 'n'],
  [120, 4, 0, 'g'],
  [1600, 2, 1, 'ế'],
  [170, 5, 0, ' '],
  [90, 6, 0, 'V', 1],
  [900, 7, 0, '', 1]
];

// Typing picks its passage from the database, which the tests start empty: load the starter passages first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A session in progress on a known passage. */
const startSession = async (authorization: string) => {
  const passage = await PassageModel.findOne({ title: 'Tiếng Việt rất đẹp' });
  const response = await api().post('/api/sessions').set('Authorization', authorization).send({ passageId: String(passage!._id) });
  return response.body as { _id: string; targetWords: string[] };
};

const complete = (authorization: string, session: { _id: string; targetWords: string[] }, body: Record<string, unknown> = {}) =>
  api()
    .patch(`/api/sessions/${session._id}/complete`)
    .set('Authorization', authorization)
    .send({ typedWords: session.targetWords, ...body });

const replayOf = (authorization: string, id: string) => api().get(`/api/sessions/${id}/replay`).set('Authorization', authorization);

describe('the replay of a completed session (SCRUM-35)', () => {
  it('saves the replay sent with the completion apart from the session, and reads it back with the day it goes', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    const session = await startSession(auth);

    const done = await complete(auth, session, { replay });

    expect(done.status).toBe(200);
    expect(done.body.status).toBe('completed');
    expect(done.body).not.toHaveProperty('replay');
    expect((await TypingSessionModel.findById(session._id))!.toObject()).not.toHaveProperty('replay');
    const saved = await SessionReplayModel.findOne({ session: session._id });
    expect(String(saved!.owner)).toBe(String(user._id));
    expect(saved!.events).toEqual(replay);

    const response = await replayOf(auth, session._id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ session: session._id, events: replay });
    expect(new Date(response.body.expiresAt).getTime() - new Date(response.body.createdAt).getTime()).toBe(REPLAY_TTL_MS);
    expect(REPLAY_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('lets MongoDB delete a replay 30 days after it was saved (TTL index on createdAt)', async () => {
    await SessionReplayModel.init();

    const indexes = await SessionReplayModel.collection.indexes();

    expect(indexes).toContainEqual(expect.objectContaining({ key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 }));
    expect(indexes).toContainEqual(expect.objectContaining({ key: { session: 1 }, unique: true }));
  });

  it('answers 404 once the replay is older than 30 days, before the TTL monitor has deleted it', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startSession(auth);
    await complete(auth, session, { replay });
    // `createdAt` cannot be changed through the model: write it straight into the collection.
    await SessionReplayModel.collection.updateOne(
      { session: (await SessionReplayModel.findOne())!.session },
      { $set: { createdAt: new Date(Date.now() - REPLAY_TTL_MS - 1000) } }
    );

    const response = await replayOf(auth, session._id);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Replay not found');
  });

  it("answers 404 to another learner and to an admin, never showing someone else's typing", async () => {
    const auth = bearerFor(await createUser({ email: 'owner@example.com' }));
    const stranger = bearerFor(await createUser({ email: 'stranger@example.com' }));
    const admin = bearerFor(await createUser({ email: 'admin@example.com', role: 'admin' }));
    const session = await startSession(auth);
    await complete(auth, session, { replay });

    expect((await replayOf(stranger, session._id)).status).toBe(404);
    expect((await replayOf(admin, session._id)).status).toBe(404);
    expect((await replayOf(auth, session._id)).status).toBe(200);
  });

  it('answers 404 for a session completed without a replay (an older page) or not completed, 400 for a bad id, 401 signed out', async () => {
    const auth = bearerFor(await createUser({}));
    const old = await startSession(auth);
    await complete(auth, old);
    const open = await startSession(auth);

    expect((await replayOf(auth, old._id)).status).toBe(404);
    expect((await replayOf(auth, open._id)).status).toBe(404);
    expect((await replayOf(auth, 'not-an-id')).status).toBe(400);
    expect((await api().get(`/api/sessions/${old._id}/replay`)).status).toBe(401);
  });

  it('keeps a replay of exactly 64 KB and drops one byte more, completing the session either way', async () => {
    const auth = bearerFor(await createUser({}));
    // `[[0,0,0,"…"]]` is 12 bytes around the text.
    const ofBytes = (bytes: number) => [[0, 0, 0, 'a'.repeat(bytes - 12)]];
    expect(Buffer.byteLength(JSON.stringify(ofBytes(MAX_REPLAY_BYTES)))).toBe(64 * 1024);
    // One at a time: starting a session abandons the one still in progress.
    const fits = await startSession(auth);
    expect((await complete(auth, fits, { replay: ofBytes(MAX_REPLAY_BYTES) })).status).toBe(200);
    const tooBig = await startSession(auth);

    const response = await complete(auth, tooBig, { replay: ofBytes(MAX_REPLAY_BYTES + 1) });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect((await replayOf(auth, fits._id)).status).toBe(200);
    expect((await replayOf(auth, tooBig._id)).status).toBe(404);
  });

  it('drops a replay that is not made of changes and still completes the session', async () => {
    const auth = bearerFor(await createUser({}));
    const broken = [
      'not a replay',
      [],
      [[-1, 0, 0, 'a']], // a time that goes back
      [[1.5, 0, 0, 'a']],
      [[0, 0, 0]], // no text
      [[0, 0, 0, 'a', 2]], // an unknown flag
      [{ dt: 0, at: 0, removed: 0, inserted: 'a' }]
    ];

    for (const bad of broken) {
      const session = await startSession(auth);
      const response = await complete(auth, session, { replay: bad });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    }
    expect(await SessionReplayModel.countDocuments()).toBe(0);
  });

  it('saves nothing when the completion itself fails', async () => {
    const auth = bearerFor(await createUser({ email: 'owner@example.com' }));
    const stranger = bearerFor(await createUser({ email: 'stranger@example.com' }));
    const session = await startSession(auth);

    expect((await complete(stranger, session, { replay })).status).toBe(404);
    expect(await SessionReplayModel.countDocuments()).toBe(0);

    await complete(auth, session, { replay });
    expect((await complete(auth, session, { replay: [[5, 0, 0, 'x']] })).status).toBe(409);
    expect((await SessionReplayModel.find()).map((row) => row.events)).toEqual([replay]);
  });

  it('still completes the session when the replay cannot be saved', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startSession(auth);
    vi.spyOn(SessionReplayModel, 'create').mockRejectedValueOnce(new Error('database down'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await complete(auth, session, { replay });

    expect(response.status).toBe(200);
    expect((await TypingSessionModel.findById(session._id))!.status).toBe('completed');
    expect(logged).toHaveBeenCalledWith('Replay not saved:', expect.any(Error));
    expect((await replayOf(auth, session._id)).status).toBe(404);
  });
});
