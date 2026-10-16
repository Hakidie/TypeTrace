import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const startSession = (authorization: string, body: Record<string, unknown> = {}) =>
  api().post('/api/sessions').set('Authorization', authorization).send(body);

const complete = (authorization: string, id: string, typedWords: string[]) =>
  api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send({ typedWords });

// Typing picks its passage from the database, which the tests start empty: load the starter passages first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

/** Starts a session on the passage with this title, so a test does not depend on the random pick. */
const startOn = async (authorization: string, title: string) =>
  (await startSession(authorization, { passageId: String((await PassageModel.findOne({ title }))!._id) })).body;

const wordsOfPassage = async (passageId: string) => (await PassageModel.findById(passageId))!.content.split(/\s+/);

describe('POST /api/sessions', () => {
  it('starts an in-progress session with a copy of a passage from the database', async () => {
    const user = await createUser({});

    const response = await startSession(bearerFor(user));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'in_progress', mode: 'practice', isCounted: false });
    expect(response.body.owner).toBe(String(user._id));
    expect(response.body.targetWords).toEqual(await wordsOfPassage(response.body.passageId));
    expect(response.body).not.toHaveProperty('__v');
  });

  it('picks a random published, public practice passage and never the placement or a hidden one', async () => {
    await PassageModel.updateOne({ title: 'Hà Nội vào thu' }, { status: 'archived' });
    await PassageModel.create({ title: 'Riêng tư', content: 'Của riêng tôi.', source: 'Tự viết', visibility: 'private' });
    const auth = bearerFor(await createUser({}));
    const allowed = await PassageModel.find({ status: 'published', visibility: 'public', isPlacement: false });
    expect(allowed.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) seen.add((await startSession(auth)).body.passageId);

    const allowedIds = allowed.map((passage) => String(passage._id));
    expect([...seen].every((id) => allowedIds.includes(id))).toBe(true);
    expect(seen.size).toBeGreaterThan(1); // not always the same passage
  });

  it('uses the placement passage in placement mode', async () => {
    const auth = bearerFor(await createUser({}));
    const placement = (await PassageModel.findOne({ isPlacement: true }))!;

    const response = await startSession(auth, { mode: 'placement' });

    expect(response.body).toMatchObject({ mode: 'placement', passageId: String(placement._id) });
  });

  it('uses the passage asked for, if it is published and public (or the learner own)', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    const chosen = (await PassageModel.findOne({ title: 'Bữa cơm gia đình' }))!;
    const mine = await PassageModel.create({
      title: 'Của tôi', content: 'Đây là bài của tôi.', source: 'Tự viết', visibility: 'private', status: 'published', owner: me._id
    });
    const theirs = await PassageModel.create({
      title: 'Của họ', content: 'Bài của người khác.', source: 'Tự viết', visibility: 'private', status: 'published', owner: (await createUser({ email: 'x@example.com' }))._id
    });

    expect((await startSession(auth, { passageId: String(chosen._id) })).body.passageId).toBe(String(chosen._id));
    expect((await startSession(auth, { passageId: String(mine._id) })).status).toBe(201);
    expect((await startSession(auth, { passageId: String(theirs._id) })).status).toBe(400);

    await PassageModel.updateOne({ _id: chosen._id }, { status: 'archived' });
    expect((await startSession(auth, { passageId: String(chosen._id) })).status).toBe(400);
  });

  it('answers 404 when there is no passage to type', async () => {
    await PassageModel.deleteMany({});
    const auth = bearerFor(await createUser({}));

    expect((await startSession(auth)).status).toBe(404);
    expect((await startSession(auth, { mode: 'placement' })).status).toBe(404);
  });

  it('moves the previous in-progress session to abandoned', async () => {
    const auth = bearerFor(await createUser({}));
    const first = await startSession(auth);
    const second = await startSession(auth);

    expect((await TypingSessionModel.findById(first.body._id))!.status).toBe('abandoned');
    expect((await TypingSessionModel.findById(second.body._id))!.status).toBe('in_progress');
  });

  it("does not touch another user's session", async () => {
    const other = await createUser({ email: 'other@example.com' });
    const otherSession = await startSession(bearerFor(other));

    await startSession(bearerFor(await createUser({})));

    expect((await TypingSessionModel.findById(otherSession.body._id))!.status).toBe('in_progress');
  });

  it('rejects an unknown passage or mode and requires authentication', async () => {
    const auth = bearerFor(await createUser({}));

    expect((await startSession(auth, { passageId: 'nope' })).status).toBe(400);
    expect((await startSession(auth, { passageId: '0'.repeat(24) })).status).toBe(400); // valid id, no such passage
    expect((await startSession(auth, { mode: 'ranked' })).status).toBe(400);
    expect((await api().post('/api/sessions')).status).toBe(401);
  });
});

describe('PATCH /api/sessions/:id/complete', () => {
  it('grades the typed words again and ignores totals sent by the client', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startOn(auth, 'Tiếng Việt rất đẹp');
    const typed = [...session.targetWords];
    typed[5] = 'truong'; // trường typed without the horn marks and the tone

    const response = await api()
      .patch(`/api/sessions/${session._id}/complete`)
      .set('Authorization', auth)
      .send({ typedWords: typed, wpm: 999, accuracy: 100, isCounted: true });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.words).toHaveLength(typed.length);
    expect(response.body.words[5]).toMatchObject({
      target: 'trường',
      typed: 'truong',
      errorTypes: ['MARK_WRONG', 'TONE_WRONG']
    });
    expect(response.body.accuracy).toBe(95.7);
    expect(response.body.wpm).not.toBe(999);
    expect(response.body.isCounted).toBe(false); // the client said true, but the server saw an instant submission
    expect(response.body.errorCounts).toMatchObject({ MARK_WRONG: 1, TONE_WRONG: 1, BASE_LETTER: 0 });
    expect(response.body.opportunityCounts.TONE_WRONG).toBe(typed.length);
    expect(response.body.completedAt).toBeDefined();
  });

  it('counts a session of at least 20 words at a normal speed', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startOn(auth, 'Tiếng Việt rất đẹp');
    // Backdate the start so the speed stays realistic: 23 correct words in 2 minutes.
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 120_000) });

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.body.wpm).toBeCloseTo(11.5, 0);
    expect(response.body.isCounted).toBe(true);
  });

  it('saves but does not count a session under 20 words', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 120_000) });

    const response = await complete(auth, session._id, session.targetWords.slice(0, 10));

    expect(response.status).toBe(200);
    expect(response.body.isCounted).toBe(false);
  });

  it('saves but does not count a session faster than 200 WPM', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);

    const response = await complete(auth, session._id, session.targetWords); // typed within a second

    expect(response.body.wpm).toBeGreaterThan(200);
    expect(response.body.isCounted).toBe(false);
  });

  it('keeps the words and error counts of a session that is not counted', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 120_000) });

    await complete(auth, session._id, session.targetWords.slice(0, 5));

    const saved = await TypingSessionModel.findById(session._id);
    expect(saved).toMatchObject({ status: 'completed', isCounted: false });
    expect(saved!.words).toHaveLength(5);
    expect(saved!.wpm).toBeGreaterThan(0);
  });

  it('counts exactly 20 words and not 19 at the same normal speed', async () => {
    const auth = bearerFor(await createUser({}));
    const run = async (wordCount: number) => {
      const { body: session } = await startSession(auth);
      await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 120_000) });
      return (await complete(auth, session._id, session.targetWords.slice(0, wordCount))).body;
    };

    expect((await run(19)).isCounted).toBe(false);
    expect((await run(20)).isCounted).toBe(true);
  });

  it('stops the clock at 3 minutes when the request only arrived a little late', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 182_000) });

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.body.durationMs).toBe(180_000);
    expect(response.body.isCounted).toBe(true);
  });

  it('saves a session that ran past 3 minutes but does not count it', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 240_000) });

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.durationMs).toBeGreaterThan(180_000);
    expect(response.body.isCounted).toBe(false);
  });

  it('requires authentication', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);

    const response = await api().patch(`/api/sessions/${session._id}/complete`).send({ typedWords: ['a'] });

    expect(response.status).toBe(401);
  });

  it('rejects more words than the passage, empty input and a finished session', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);

    expect((await complete(auth, session._id, [...session.targetWords, 'thừa'])).status).toBe(400);
    expect((await complete(auth, session._id, [])).status).toBe(400);

    expect((await complete(auth, session._id, session.targetWords)).status).toBe(200);
    expect((await complete(auth, session._id, session.targetWords)).status).toBe(409);
  });

  it("answers 404 for another user's session and for an abandoned one", async () => {
    const owner = bearerFor(await createUser({ email: 'owner@example.com' }));
    const stranger = bearerFor(await createUser({ email: 'stranger@example.com' }));
    const { body: session } = await startSession(owner);

    expect((await complete(stranger, session._id, session.targetWords)).status).toBe(404);
    expect((await TypingSessionModel.findById(session._id))!.status).toBe('in_progress'); // untouched

    await startSession(owner); // abandons the first one
    expect((await complete(owner, session._id, session.targetWords)).status).toBe(409);
  });
});

describe('PATCH /api/sessions/:id/begin', () => {
  const begin = (authorization: string, id: string) =>
    api().patch(`/api/sessions/${id}/begin`).set('Authorization', authorization);

  it('stores when the learner pressed the first key, once', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);

    const first = await begin(auth, session._id);
    const second = await begin(auth, session._id);

    expect(first.status).toBe(200);
    expect(first.body.beganAt).toBeDefined();
    expect(second.body.beganAt).toBe(first.body.beganAt);
  });

  it('measures the time from the first key, not from when the session was created', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 600_000) }); // opened 10 minutes ago
    await begin(auth, session._id);

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.body.durationMs).toBeLessThan(10_000);
  });

  it('answers 404 for another learner and 409 once the session is finished', async () => {
    const owner = bearerFor(await createUser({ email: 'owner@example.com' }));
    const other = bearerFor(await createUser({ email: 'other@example.com' }));
    const { body: session } = await startSession(owner);

    expect((await begin(other, session._id)).status).toBe(404);
    await complete(owner, session._id, session.targetWords);
    expect((await begin(owner, session._id)).status).toBe(409);
  });
});

describe('abandon, read and history', () => {
  it('abandons a session in progress, once', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: session } = await startSession(auth);

    const first = await api().patch(`/api/sessions/${session._id}/abandon`).set('Authorization', auth);
    const second = await api().patch(`/api/sessions/${session._id}/abandon`).set('Authorization', auth);

    expect(first.status).toBe(200);
    expect(first.body.status).toBe('abandoned');
    expect(second.status).toBe(409);
  });

  it("does not let another learner abandon someone else's session", async () => {
    const owner = bearerFor(await createUser({ email: 'owner@example.com' }));
    const stranger = bearerFor(await createUser({ email: 'stranger@example.com' }));
    const { body: session } = await startSession(owner);

    const response = await api().patch(`/api/sessions/${session._id}/abandon`).set('Authorization', stranger);

    expect(response.status).toBe(404);
    expect((await TypingSessionModel.findById(session._id))!.status).toBe('in_progress');
  });

  it('reads one session, and answers 404 to other users, even admins', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const { body: session } = await startSession(bearerFor(owner));

    const own = await api().get(`/api/sessions/${session._id}`).set('Authorization', bearerFor(owner));
    expect(own.status).toBe(200);
    expect(own.body._id).toBe(session._id);

    expect((await api().get(`/api/sessions/${session._id}`).set('Authorization', bearerFor(admin))).status).toBe(404);
    expect((await api().get('/api/sessions/not-an-id').set('Authorization', bearerFor(owner))).status).toBe(400);
  });

  it('lists only my sessions, newest first, with pagination and a status filter', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    const other = await createUser({ email: 'other@example.com' });
    await startSession(bearerFor(other));
    const first = await startSession(auth);
    await complete(auth, first.body._id, first.body.targetWords);
    const second = await startSession(auth);
    const third = await startSession(auth);

    const all = await api().get('/api/sessions?limit=2').set('Authorization', auth);
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(all.body.items.map((s: { _id: string }) => s._id)).toEqual([third.body._id, second.body._id]);

    const completed = await api().get('/api/sessions?status=completed').set('Authorization', auth);
    expect(completed.body.total).toBe(1);

    expect((await api().get('/api/sessions?sort=owner').set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/sessions')).status).toBe(401);
  });
});
