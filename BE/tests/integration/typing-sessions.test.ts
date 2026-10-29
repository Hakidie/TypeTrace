import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { DailyProgressModel } from '../../src/models/daily-progress.model';
import { PassageModel } from '../../src/models/passage.model';
import { UserDailyTasksModel } from '../../src/models/user-daily-tasks.model';
import { SessionWord, TypingSessionModel } from '../../src/models/typing-session.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { timelineOf } from '../../src/services/typing-session.service';
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
    expect(response.body.passageTitle).toBe((await PassageModel.findById(response.body.passageId))?.title);
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

  it('picks a random published placement passage in placement mode, never a practice or hidden one', async () => {
    await PassageModel.updateOne({ title: 'Bài kiểm tra đầu vào' }, { status: 'archived' });
    const auth = bearerFor(await createUser({}));
    const allowed = await PassageModel.find({ isPlacement: true, status: 'published' });
    expect(allowed.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const response = await startSession(auth, { mode: 'placement' });
      expect(response.body.mode).toBe('placement');
      seen.add(response.body.passageId);
    }

    const allowedIds = allowed.map((passage) => String(passage._id));
    expect([...seen].every((id) => allowedIds.includes(id))).toBe(true);
    expect(seen.size).toBeGreaterThan(1); // not always the same passage
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

describe('GET /api/sessions/:id/stats (SCRUM-186)', () => {
  const statsOf = (authorization: string, id: string) =>
    api().get(`/api/sessions/${id}/stats`).set('Authorization', authorization);

  it('counts right and wrong words and the error rate per type from the stored words', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startOn(auth, 'Tiếng Việt rất đẹp');
    const typed = [...session.targetWords];
    typed[5] = 'truong'; // trường typed without the horn marks and the tone
    await complete(auth, session._id, typed);

    const response = await statsOf(auth, session._id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ totalWords: typed.length, correctWords: typed.length - 1, wrongWords: 1 });
    expect(response.body.wrongRate).toBe(Math.round((100 / typed.length) * 10) / 10);
    const tone = response.body.errorTypes.find((row: { type: string }) => row.type === 'TONE_WRONG');
    expect(tone).toMatchObject({ errors: 1, opportunities: typed.length });
    expect(tone.rate).toBe(Math.round((100 / typed.length) * 10) / 10);
    // a type with no chance in the passage is left out
    expect(response.body.errorTypes.every((row: { opportunities: number }) => row.opportunities > 0)).toBe(true);
    expect(response.body.isCounted).toBe(false);
  });

  it('works out the numbers from the words, not from the stored totals', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startOn(auth, 'Tiếng Việt rất đẹp');
    await complete(auth, session._id, [...session.targetWords]);
    await TypingSessionModel.updateOne({ _id: session._id }, { wpm: 999, accuracy: 0, 'errorCounts.TONE_WRONG': 50 });

    const response = await statsOf(auth, session._id);

    expect(response.body.wrongWords).toBe(0);
    expect(response.body.errorTypes.every((row: { errors: number }) => row.errors === 0)).toBe(true);
  });

  it('answers 404 to other users, even admins, and 409 until the session is completed', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const session = await startOn(bearerFor(owner), 'Tiếng Việt rất đẹp');

    expect((await statsOf(bearerFor(owner), session._id)).status).toBe(409);
    await complete(bearerFor(owner), session._id, [...session.targetWords]);
    expect((await statsOf(bearerFor(owner), session._id)).status).toBe(200);
    expect((await statsOf(bearerFor(admin), session._id)).status).toBe(404);
    expect((await statsOf(bearerFor(owner), 'not-an-id')).status).toBe(400);
    expect((await api().get(`/api/sessions/${session._id}/stats`)).status).toBe(401);
  });
});

describe('word times and the speed chart (SCRUM-187)', () => {
  const statsOf = (authorization: string, id: string) =>
    api().get(`/api/sessions/${id}/stats`).set('Authorization', authorization);

  /** A session whose first key was pressed `seconds` ago, so the server measures that duration. */
  const startedAgo = async (authorization: string, seconds: number) => {
    const session = await startOn(authorization, 'Tiếng Việt rất đẹp');
    await TypingSessionModel.updateOne({ _id: session._id }, { beganAt: new Date(Date.now() - seconds * 1000) });
    return session;
  };

  const send = (authorization: string, id: string, body: Record<string, unknown>) =>
    api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send(body);

  it('searches the history by passage name (accents optional) and filters it by mode and by the time chosen', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    const other = await createUser({ email: 'other@example.com' });
    const base = { passageId: 'p1', targetWords: ['a'], status: 'completed' };
    await TypingSessionModel.create([
      { ...base, owner: me._id, passageTitle: 'Hà Nội mùa thu', mode: 'practice', timeLimitSeconds: 30 },
      { ...base, owner: me._id, passageTitle: 'Sài Gòn', mode: 'placement', timeLimitSeconds: 120 },
      { ...base, owner: me._id, passageTitle: 'Hà Nội về đêm', mode: 'practice', timeLimitSeconds: 120 },
      { ...base, owner: me._id, mode: 'practice' }, // from before the title and the time were stored
      { ...base, owner: other._id, passageTitle: 'Hà Nội của người khác', mode: 'practice', timeLimitSeconds: 30 }
    ]);
    const titles = async (query: string) => {
      const response = await api().get(`/api/sessions?${query}`).set('Authorization', auth);
      expect(response.status).toBe(200);
      return response.body.items.map((item: { passageTitle?: string }) => item.passageTitle).sort();
    };

    expect(await titles('q=ha noi')).toEqual(['Hà Nội mùa thu', 'Hà Nội về đêm']); // accents optional, never another learner's
    expect(await titles('q=sài')).toEqual(['Sài Gòn']);
    expect(await titles('q=.*')).toEqual([]); // taken literally
    expect(await titles('mode=placement')).toEqual(['Sài Gòn']);
    expect(await titles('timeLimitSeconds=120')).toEqual(['Hà Nội về đêm', 'Sài Gòn']);
    expect(await titles('q=hà nội&mode=practice&timeLimitSeconds=120')).toEqual(['Hà Nội về đêm']);
    expect((await api().get('/api/sessions?mode=rank').set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/sessions?timeLimitSeconds=500').set('Authorization', auth)).status).toBe(400);
  });

  it('gives each session of the history list its speed line, the same as the stats, and never its words', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startedAgo(auth, 60);
    await send(auth, session._id, { typedWords: session.targetWords, typedAtMs: session.targetWords.map((_: string, index: number) => (index + 1) * 500) });

    const listed = (await api().get('/api/sessions?status=completed').set('Authorization', auth)).body.items[0];
    const stats = (await statsOf(auth, session._id)).body;
    expect(listed.timeline).toEqual(stats.timeline);
    expect(listed.timeline.status).toBe('ok');
    expect(listed).not.toHaveProperty('words');
  });

  it('stores the time of each word and draws the WPM and the errors of the last 10 seconds at every second', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startedAgo(auth, 60);
    const typed = [...session.targetWords];
    typed[0] = 'Tieng'; // wrong
    const typedAtMs = typed.map((_, index) => (index + 1) * 500); // two words every second

    const done = await send(auth, session._id, { typedWords: typed, typedAtMs });
    expect(done.status).toBe(200);
    expect(done.body.words.map((word: { typedAtMs: number }) => word.typedAtMs)).toEqual(typedAtMs);

    const { timeline } = (await statsOf(auth, session._id)).body;
    expect(timeline.status).toBe('ok');
    expect(timeline.points[0]).toEqual({ second: 1, wpm: 60, errors: 1 }); // 2 words, 1 wrong: 1 right in 1 s
    expect(timeline.points.map((point: { second: number }) => point.second).slice(0, 3)).toEqual([1, 2, 3]);
    const last = timeline.points[timeline.points.length - 1];
    expect(last.second).toBeCloseTo(done.body.durationMs / 1000, 0);
    expect(last).toMatchObject({ wpm: 0, errors: 0 }); // nothing was finished in the last 10 seconds
  });

  it('looks only at the last 10 seconds: older words and a quiet stretch do not count', () => {
    const word = (typedAtMs: number, wrong = false): SessionWord => ({
      index: 0,
      target: 'a',
      typed: 'a',
      errorTypes: wrong ? ['BASE_LETTER'] : [],
      typedAtMs
    });
    // right at 1 s, 2 s and 3 s, wrong at 8 s, then nothing until the end at 20 s
    const points = timelineOf([word(1000), word(2000), word(3000), word(8000, true)], 20_000);
    const at = (second: number) => points.find((point) => point.second === second);

    expect(at(3)).toEqual({ second: 3, wpm: 60, errors: 0 }); // 3 right words in 3 s: the window is cut at the start
    expect(at(8)).toEqual({ second: 8, wpm: 22.5, errors: 1 }); // 3 right words in 8 s, and the wrong one
    expect(at(10)).toEqual({ second: 10, wpm: 18, errors: 1 }); // all four words, 3 right in 10 s
    expect(at(12)).toEqual({ second: 12, wpm: 6, errors: 1 }); // (2 s, 12 s]: the word at 3 s and the wrong one
    expect(at(14)).toEqual({ second: 14, wpm: 0, errors: 1 }); // (4 s, 14 s]: only the wrong word
    expect(at(19)).toEqual({ second: 19, wpm: 0, errors: 0 }); // quiet: no word in the window
    expect(points).toHaveLength(20);
  });

  it('keeps the time the learner chose for the time axis, 3 minutes when none was sent, and rejects more than 3 minutes', async () => {
    const auth = bearerFor(await createUser({}));
    const chosen = await startedAgo(auth, 30);
    await send(auth, chosen._id, { typedWords: chosen.targetWords, timeLimitSeconds: 30 });
    expect((await statsOf(auth, chosen._id)).body.timeLimitSeconds).toBe(30);

    const plain = await startedAgo(auth, 30);
    await send(auth, plain._id, { typedWords: plain.targetWords });
    expect((await statsOf(auth, plain._id)).body.timeLimitSeconds).toBe(180);

    const tooLong = await startedAgo(auth, 30);
    expect((await send(auth, tooLong._id, { typedWords: tooLong.targetWords, timeLimitSeconds: 600 })).status).toBe(400);
    expect((await send(auth, tooLong._id, { typedWords: tooLong.targetWords, timeLimitSeconds: 0 })).status).toBe(400);
  });

  it('says there is no data for a session without word times, and that a short one is too short', async () => {
    const auth = bearerFor(await createUser({}));
    const old = await startedAgo(auth, 60);
    await send(auth, old._id, { typedWords: old.targetWords });
    expect((await statsOf(auth, old._id)).body.timeline).toEqual({ status: 'no_data', points: [] });

    const short = await startedAgo(auth, 6);
    await send(auth, short._id, { typedWords: short.targetWords, typedAtMs: short.targetWords.map(() => 1000) });
    expect((await statsOf(auth, short._id)).body.timeline).toEqual({ status: 'too_short', points: [] });
  });

  it('answers 400 for times that go back, are negative, or are later than the session', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startedAgo(auth, 60);
    const words = session.targetWords as string[];
    const rising = words.map((_, index) => index * 100);

    const back = [...rising];
    back[3] = 0;
    expect((await send(auth, session._id, { typedWords: words, typedAtMs: back })).status).toBe(400);
    expect((await send(auth, session._id, { typedWords: words, typedAtMs: rising.map((t) => t - 100) })).status).toBe(400);
    expect((await send(auth, session._id, { typedWords: words, typedAtMs: rising.map((t) => t + 70_000) })).status).toBe(400);
    expect((await send(auth, session._id, { typedWords: words, typedAtMs: rising.slice(1) })).status).toBe(400);
    expect((await send(auth, session._id, { typedWords: words, typedAtMs: rising.map(() => 1.5) })).status).toBe(400);

    expect((await send(auth, session._id, { typedWords: words, typedAtMs: rising })).status).toBe(200); // still in progress after the 400s
  });

  it('computes both lines itself: a speed or error rate sent by the client changes nothing', async () => {
    const auth = bearerFor(await createUser({}));
    const session = await startedAgo(auth, 60);
    const typedAtMs = session.targetWords.map((_: string, index: number) => (index + 1) * 500);
    await send(auth, session._id, { typedWords: session.targetWords, typedAtMs, timeline: [{ second: 5, wpm: 999, errors: 99 }] });

    const { timeline } = (await statsOf(auth, session._id)).body;
    expect(timeline.points[0].errors).toBe(0);
    expect(timeline.points.every((point: { wpm: number }) => point.wpm < 999)).toBe(true);
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

  it('never abandons a session completed while the request was on its way: 409, and it stays completed and counted once', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    const session = await startOn(auth, 'Tiếng Việt rất đẹp');
    await TypingSessionModel.findByIdAndUpdate(session._id, { startedAt: new Date(Date.now() - 120_000) });
    // What the abandon request read, before the completion below was saved.
    const stale = await TypingSessionModel.findById(session._id);
    expect((await complete(auth, session._id, session.targetWords)).body.isCounted).toBe(true);
    vi.spyOn(TypingSessionModel, 'findOne').mockResolvedValueOnce(stale);

    const response = await api().patch(`/api/sessions/${session._id}/abandon`).set('Authorization', auth);

    expect(response.status).toBe(409);
    expect((await TypingSessionModel.findById(session._id))!.status).toBe('completed');
    expect(await DailyProgressModel.find({ owner: user._id })).toMatchObject([{ sessions: 1 }]);
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
    // A card of the history needs the summary only, never the typed words.
    expect(completed.body.items[0]).toMatchObject({ _id: first.body._id, mode: 'practice', status: 'completed', isCounted: false });
    expect(completed.body.items[0]).toHaveProperty('wpm');
    expect(completed.body.items[0]).toHaveProperty('accuracy');
    // The speed line of the card: a session without word times has none to draw.
    expect(completed.body.items[0].timeline).toEqual({ status: 'no_data', points: [] });
    expect(completed.body.items[0]).not.toHaveProperty('words');
    expect(completed.body.items[0]).not.toHaveProperty('targetWords');
    expect(completed.body.items[0]).not.toHaveProperty('owner');

    expect((await api().get('/api/sessions?sort=owner').set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/sessions')).status).toBe(401);
  });
});

describe('GET /api/sessions/activity (the profile page, SCRUM-157 and SCRUM-31)', () => {
  // Today is fixed, so no test runs across a midnight: 10 March 2026, 15:00 in Vietnam.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const activityOf = (user: { _id: unknown; email: string }) =>
    api().get('/api/sessions/activity').set('Authorization', bearerFor(user));

  it("answers the learner's own averages, zone and days from DailyProgress, never another learner's", async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    const base = { owner: me._id, passageId: 'p1', targetWords: ['a'] };
    await TypingSessionModel.create([
      { ...base, status: 'completed', wpm: 40, accuracy: 90, completedAt: new Date() },
      { ...base, status: 'completed', wpm: 60, accuracy: 100, completedAt: new Date() },
      // In neither the average nor the days: still in progress, or left.
      { ...base, status: 'in_progress' },
      { ...base, status: 'abandoned' },
      // Older than the heatmap: still in the average.
      { ...base, status: 'completed', wpm: 99, accuracy: 99, completedAt: new Date('2020-01-01') },
      { ...base, owner: other._id, status: 'completed', wpm: 10, accuracy: 10, completedAt: new Date() }
    ]);
    // The days come from DailyProgress (counted sessions only), not from the sessions above.
    await DailyProgressModel.create([
      { owner: me._id, date: '2026-03-10', sessions: 2 },
      { owner: me._id, date: '2026-03-07', sessions: 4, missionCompletedAt: new Date() },
      { owner: me._id, date: '2025-03-04', sessions: 3, missionCompletedAt: new Date() }, // older than the heatmap
      { owner: other._id, date: '2026-03-10', sessions: 9, missionCompletedAt: new Date() },
      { owner: other._id, date: '2026-03-09', sessions: 1, missionCompletedAt: new Date() }
    ]);

    const response = await activityOf(me);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      stats: { wpm: 66.3, accuracy: 96.3 },
      timezone: 'Asia/Ho_Chi_Minh',
      sessions: [
        { date: '2026-03-07', sessions: 4 },
        { date: '2026-03-10', sessions: 2 }
      ]
    });
  });

  it('adds to each day how many daily tasks it had and how many were completed, and nothing to a day without tasks', async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await DailyProgressModel.create([
      { owner: me._id, date: '2026-03-10', sessions: 2 },
      { owner: me._id, date: '2026-03-09', sessions: 1 }
    ]);
    const task = (type: 'sessions' | 'wpm', target: number) => ({ taskId: new Types.ObjectId(), title: `${type} ${target}`, type, target });
    await UserDailyTasksModel.create([
      // Two sessions and a best of 40 WPM: the sessions task is done, the WPM one is not.
      { owner: me._id, date: '2026-03-10', timeZone: 'Asia/Ho_Chi_Minh', tasks: [task('sessions', 2), task('wpm', 60)], progress: { sessions: 2, bestWpm: 40 } },
      // Another learner's day is never mixed in.
      { owner: other._id, date: '2026-03-09', timeZone: 'Asia/Ho_Chi_Minh', tasks: [task('sessions', 1)], progress: { sessions: 5 } }
    ]);

    const { body } = await activityOf(me);

    expect(body.sessions).toEqual([
      { date: '2026-03-09', sessions: 1 },
      { date: '2026-03-10', sessions: 2, tasksTotal: 2, tasksDone: 1 }
    ]);
  });

  it("answers the days of the last 371 days in the learner's zone, today included, oldest first", async () => {
    // 17:30 UTC on 10 March: already 11 March in Vietnam, still 10 March in UTC.
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await api().patch('/api/profile/settings').set('Authorization', bearerFor(london)).send({ timezone: 'UTC' });
    // The 371 days up to 11 March 2026 start on 6 March 2025; up to 10 March 2026, on 5 March 2025.
    const dates = ['2026-03-11', '2025-03-05', '2026-03-10', '2025-03-06'];
    await DailyProgressModel.create(
      [vietnam._id, london._id].flatMap((owner) => dates.map((date) => ({ owner, date, sessions: 1, missionCompletedAt: new Date() })))
    );

    const inVietnam = (await activityOf(vietnam)).body;
    const inLondon = (await activityOf(london)).body;

    expect(inVietnam.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(inVietnam.sessions.map((day: { date: string }) => day.date)).toEqual(['2025-03-06', '2026-03-10', '2026-03-11']);
    // In UTC today is 10 March: 11 March has not come yet, and the 371 days start a day earlier.
    expect(inLondon.timezone).toBe('UTC');
    expect(inLondon.sessions.map((day: { date: string }) => day.date)).toEqual(['2025-03-05', '2025-03-06', '2026-03-10']);
  });

  it('has no stats and no days for a new learner, and needs a signed-in account', async () => {
    const response = await activityOf(await createUser({}));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ timezone: 'Asia/Ho_Chi_Minh', sessions: [] });
    expect((await api().get('/api/sessions/activity')).status).toBe(401);
  });
});

describe('English passages are not for practice (ranked duel, phase 1)', () => {
  const english = { title: 'A quiet morning', content: 'The sun rose over the quiet town.', source: 'Written for TypeTrace', status: 'published', visibility: 'public', language: 'en' };

  it('never picks an English passage at random', async () => {
    await PassageModel.deleteMany({});
    await PassageModel.create(english);

    expect((await startSession(bearerFor(await createUser({})))).status).toBe(404);
  });

  it('refuses an English passage chosen by id', async () => {
    const passage = await PassageModel.create(english);

    expect((await startSession(bearerFor(await createUser({})), { passageId: String(passage._id) })).status).toBe(400);
  });
});
