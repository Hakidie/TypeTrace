import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';
import { weakSpotsAi } from '../../src/config/weak-spots-ai';
import { PASSAGE_LIST } from '../../src/data/passages';
import { WORD_LIST } from '../../src/data/words';
import { PassageModel } from '../../src/models/passage.model';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { WordModel } from '../../src/models/word.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { LESSON_MAX_WORDS, LESSON_MIN_WORDS, trainsErrorType } from '../../src/services/targeted-practice.service';
import { importWords } from '../../src/services/word-import.service';
import { tagWord, WordError, type WordErrorType } from '../../src/utils/vietnamese-errors';
import { api } from '../helpers/api';
import { geminiRecorder, promptOf } from '../helpers/gemini-recorder';
import { bearerFor, createUser } from '../helpers/user-factory';

type Learner = Awaited<ReturnType<typeof createUser>>;

const startLesson = (learner: Learner, body: Record<string, unknown> = {}) =>
  api().post('/api/sessions').set('Authorization', bearerFor(learner)).send({ mode: 'targeted', ...body });

const trainsAny = (focus: readonly WordErrorType[]) => (text: string) =>
  focus.some((type) => trainsErrorType({ text, tags: tagWord(text) }, type));

/** A learner on Premium for a month: the plan that has weak spots practice (`canCreateErrorPractice`). */
const premiumLearner = async (email = 'premium@example.com') => {
  const learner = await createUser({ email });
  await SubscriptionModel.create({
    user: learner._id,
    plan: 'premium',
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    source: 'admin',
    changedBy: null
  });
  return learner;
};

/** A counted practice session with hỏi / ngã wrong 1 time in 4 and đ 1 time in 5: both weak, hỏi / ngã the weakest. */
const makeWeak = (learner: Learner) =>
  TypingSessionModel.create({
    owner: learner._id,
    passageId: 'p1',
    targetWords: ['a'],
    status: 'completed',
    isCounted: true,
    completedAt: new Date(Date.now() - 60_000),
    durationMs: 60_000,
    wpm: 30,
    accuracy: 90,
    errorCounts: { BASE_LETTER: 1, D_MISSING: 8, MARK_WRONG: 1, TONE_WRONG: 1, HOI_NGA_CONFUSION: 10 },
    opportunityCounts: { BASE_LETTER: 40, D_MISSING: 40, MARK_WRONG: 40, TONE_WRONG: 40, HOI_NGA_CONFUSION: 40 }
  });

/** The words of the bank, with and without đ. */
const bankWords = async () => {
  const words = await WordModel.find().select('text').lean();
  const texts = words.map((item) => item.text);
  return { withD: texts.filter(trainsAny([WordError.D_MISSING])), without: texts.filter((text) => !trainsAny([WordError.D_MISSING])(text)) };
};

/** The words of one line of the prompt sent to the AI ("Từ cần luyện: a, b" → ['a', 'b']). */
const promptWords = (request: Record<string, unknown>, label: string) => {
  const line = promptOf(request).split('\n').find((text) => text.startsWith(`${label}: `));
  return line ? line.slice(label.length + 2).split(', ') : [];
};

/**
 * Gemini writing a passage from the practice words it was given: `share` of them, then "và" up to `padding` more words,
 * in the Markdown and quotation marks the server takes off.
 */
const writesWith =
  (share = 1, padding = 0) =>
  (request: Record<string, unknown>) => {
    const practice = promptWords(request, 'Từ cần luyện');
    const used = practice.slice(0, Math.ceil(practice.length * share));
    return `**"Hôm nay ${[...used, ...Array(padding).fill('và')].join(' ')}, rồi cả nhà cùng về."**`;
  };

// The tests start with an empty database: load the starter passages (the fallback) and the starter word list (the lessons).
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
  await importWords(WORD_LIST);
});

describe('POST /api/sessions in Weak spots (targeted, US3.2)', () => {
  it('answers 403 to a learner whose plan has no weak spots practice, and starts nothing', async () => {
    const learner = await createUser({});
    await makeWeak(learner);

    const response = await startLesson(learner);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Your plan does not include weak spots practice');
    expect(await TypingSessionModel.countDocuments({ mode: 'targeted' })).toBe(0);
    expect(geminiRecorder.requests).toHaveLength(0);
  });

  it('picks 30 to 50 words of the bank for the two weakest types, 60 to 70 % of them training them', async () => {
    const learner = await premiumLearner();
    await makeWeak(learner);

    const response = await startLesson(learner);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mode: 'targeted',
      status: 'in_progress',
      focusErrorTypes: ['HOI_NGA_CONFUSION', 'D_MISSING'],
      passageTitle: 'Weak spots: hỏi / ngã, đ'
    });
    expect(response.body).not.toHaveProperty('passageId');
    const words: string[] = response.body.lessonWords;
    expect(words.length).toBeGreaterThanOrEqual(LESSON_MIN_WORDS);
    expect(words.length).toBeLessThanOrEqual(LESSON_MAX_WORDS);
    const trained = words.filter(trainsAny(['HOI_NGA_CONFUSION', 'D_MISSING'])).length;
    expect(trained).toBeGreaterThanOrEqual(Math.ceil(words.length * 0.6));
    expect(trained).toBeLessThanOrEqual(Math.floor(words.length * 0.7));
  });

  it('aims at the two types with the highest error rates when none is weak: an error profile is enough', async () => {
    const learner = await premiumLearner();
    // hỏi / ngã 10 %, vowel marks 5 %, the rest lower: all ok, none weak.
    await TypingSessionModel.create({
      owner: learner._id,
      passageId: 'p1',
      targetWords: ['a'],
      status: 'completed',
      isCounted: true,
      completedAt: new Date(Date.now() - 60_000),
      durationMs: 60_000,
      wpm: 30,
      accuracy: 97,
      errorCounts: { BASE_LETTER: 1, D_MISSING: 0, MARK_WRONG: 2, TONE_WRONG: 1, HOI_NGA_CONFUSION: 4 },
      opportunityCounts: { BASE_LETTER: 40, D_MISSING: 40, MARK_WRONG: 40, TONE_WRONG: 40, HOI_NGA_CONFUSION: 40 }
    });

    const response = await startLesson(learner);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mode: 'targeted',
      focusErrorTypes: ['HOI_NGA_CONFUSION', 'MARK_WRONG'],
      passageTitle: 'Weak spots: hỏi / ngã, vowel marks'
    });
    expect(response.body).not.toHaveProperty('passageId');
  });

  it('practices the one error type the learner chose, weak or not', async () => {
    const learner = await premiumLearner();
    await makeWeak(learner);

    const response = await startLesson(learner, { errorType: 'MARK_WRONG' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ focusErrorTypes: ['MARK_WRONG'], passageTitle: 'Weak spots: vowel marks' });
  });

  it('uses only the words an admin did not hide', async () => {
    const learner = await premiumLearner();
    const { withD } = await bankWords();
    const shown = withD.slice(0, 5);
    await WordModel.updateMany({ text: { $in: withD.slice(5) } }, { isActive: false });
    await WordModel.updateMany({ text: { $in: ['em', 'anh', 'chị'] } }, { isActive: false });

    const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

    const active = new Set((await WordModel.find({ isActive: true }).select('text').lean()).map((item) => item.text));
    expect(body.lessonWords.every((text: string) => active.has(text))).toBe(true);
    // Only 5 words with đ are left: the lesson repeats them rather than take a hidden one.
    expect(body.lessonWords.filter(trainsAny(['D_MISSING'])).every((text: string) => shown.includes(text))).toBe(true);
  });

  it('leaves out the words of the next lesson that were in the last one, while the bank has others', async () => {
    const learner = await premiumLearner();
    const { withD } = await bankWords();

    const first: string[] = (await startLesson(learner, { errorType: 'D_MISSING' })).body.lessonWords;
    const second: string[] = (await startLesson(learner, { errorType: 'D_MISSING' })).body.lessonWords;

    // The words without đ are many: none comes back.
    expect(second.filter((text) => !withD.includes(text)).some((text) => first.includes(text))).toBe(false);
    // The words with đ are few (52): the ones not in the first lesson are all taken before one of it comes back.
    const freshD = withD.filter((text) => !first.includes(text));
    const secondD = second.filter((text) => withD.includes(text));
    if (secondD.length <= freshD.length) expect(secondD.every((text) => freshD.includes(text))).toBe(true);
    else expect(freshD.every((text) => secondD.includes(text))).toBe(true);
    // The first lesson was left in progress: starting the second one abandoned it.
    expect(await TypingSessionModel.countDocuments({ owner: learner._id, mode: 'targeted', status: 'abandoned' })).toBe(1);
  });

  it('leaves out only the words of the last 3 lessons, not those of an older lesson or of other sessions', async () => {
    const learner = await premiumLearner();
    const { withD, without } = await bankWords();
    // The words the new lesson may take: enough for the biggest lesson (35 with đ, 20 without).
    const allowed = [...withD.slice(0, 40), ...without.slice(0, 25)];
    const others = [...withD.slice(40), ...without.slice(25)];
    const third = Math.ceil(others.length / 3);
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
    const lesson = (lessonWords: string[], createdAt: Date, fields: Record<string, unknown> = {}) => ({
      owner: learner._id,
      mode: 'targeted',
      focusErrorTypes: ['D_MISSING'],
      // The AI's passage: its words are not the picked ones, and never left out.
      targetWords: allowed,
      lessonWords,
      status: 'completed',
      createdAt,
      ...fields
    });
    await TypingSessionModel.create([
      // An older lesson: its words may come back.
      lesson(allowed, minutesAgo(10)),
      // The last 3 lessons, one of them left behind and one from before the AI passages (its typed words were the picked ones).
      lesson(others.slice(0, third), minutesAgo(3)),
      lesson(others.slice(third, third * 2), minutesAgo(2), { status: 'abandoned' }),
      lesson([], minutesAgo(1), { lessonWords: undefined, targetWords: others.slice(third * 2) }),
      // Newer, but not lessons: a random passage typed in Weak spots, and a practice session.
      lesson(allowed, minutesAgo(0.5), { focusErrorTypes: [], passageId: 'p1', lessonWords: undefined }),
      { owner: learner._id, mode: 'practice', passageId: 'p1', targetWords: allowed, status: 'completed', createdAt: minutesAgo(0.2) }
    ]);

    const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(body.lessonWords.every((text: string) => allowed.includes(text))).toBe(true);
  });

  it('types a random published passage and has no focus when the learner has no error profile yet, without asking the AI', async () => {
    const learner = await premiumLearner();

    const response = await startLesson(learner);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ mode: 'targeted', focusErrorTypes: [], lessonSource: 'passage' });
    expect(response.body).not.toHaveProperty('lessonWords');
    const passage = await PassageModel.findById(response.body.passageId);
    expect(passage).toMatchObject({ status: 'published', visibility: 'public', isPlacement: false });
    expect(response.body.passageTitle).toBe(passage!.title);
    expect(response.body.targetWords).toEqual(passage!.content.split(/\s+/));
    expect(geminiRecorder.requests).toHaveLength(0);
  });

  it('types a random passage when no active word trains the error type chosen', async () => {
    const learner = await premiumLearner();
    await WordModel.updateMany({ tags: 'D_MISSING' }, { isActive: false });

    const response = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(response.status).toBe(201);
    expect(response.body.focusErrorTypes).toEqual([]);
    expect(response.body.passageId).toEqual(expect.any(String));
  });

  it('refuses a passage in Weak spots, an error type in another mode and an unknown error type', async () => {
    const learner = await premiumLearner();
    const passage = (await PassageModel.findOne({ isPlacement: false }))!;
    const auth = bearerFor(learner);

    expect((await startLesson(learner, { passageId: String(passage._id) })).status).toBe(400);
    expect((await api().post('/api/sessions').set('Authorization', auth).send({ mode: 'practice', errorType: 'D_MISSING' })).status).toBe(400);
    expect((await startLesson(learner, { errorType: 'NOT_AN_ERROR' })).status).toBe(400);
    expect(await TypingSessionModel.countDocuments({ owner: learner._id })).toBe(0);
  });

  it('grades and counts a finished lesson like a practice session', async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(1);
    const { body: started } = await startLesson(learner, { errorType: 'D_MISSING' });
    // Opened 2 minutes ago: an ordinary pace for the whole lesson.
    await TypingSessionModel.findByIdAndUpdate(started._id, { startedAt: new Date(Date.now() - 120_000) });

    const response = await api()
      .patch(`/api/sessions/${started._id}/complete`)
      .set('Authorization', bearerFor(learner))
      .send({ typedWords: started.targetWords });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'completed', mode: 'targeted', accuracy: 100, isCounted: true, lessonSource: 'ai' });
  });
});

describe('the passage the AI writes for a Weak spots lesson (US3.2)', () => {
  it('types the passage the AI wrote from the picked words, cleaned, and never saves it as a passage', async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(1);
    const passagesBefore = await PassageModel.countDocuments();

    const { status, body } = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ lessonSource: 'ai', focusErrorTypes: ['D_MISSING'], passageTitle: 'Weak spots: đ' });
    // The AI was given the picked words: those with đ to practice, the others as hints.
    const [request] = geminiRecorder.requests;
    const practice = promptWords(request, 'Từ cần luyện');
    expect([...practice].sort()).toEqual([...new Set(body.lessonWords.filter(trainsAny(['D_MISSING'])))].sort());
    expect([...promptWords(request, 'Từ gợi ý')].sort()).toEqual([...new Set(body.lessonWords.filter((text: string) => !trainsAny(['D_MISSING'])(text)))].sort());
    expect(request).toMatchObject({
      systemInstruction: { parts: [{ text: weakSpotsAi.systemPrompt }] },
      generationConfig: { maxOutputTokens: weakSpotsAi.maxOutputTokens }
    });
    // What is typed is the passage, without its Markdown and quotation marks.
    expect(body.targetWords).toEqual(['Hôm', 'nay', ...practice.slice(0, -1), `${practice.at(-1)},`, 'rồi', 'cả', 'nhà', 'cùng', 'về.']);
    expect(await PassageModel.countDocuments()).toBe(passagesBefore);
  });

  it.each([429, 500, 503])('types the picked words when the AI answers %i, and the learner sees no error', async (status) => {
    const learner = await premiumLearner();
    geminiRecorder.errorStatus = status;

    const response = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ lessonSource: 'words', focusErrorTypes: ['D_MISSING'] });
    expect(response.body.targetWords).toEqual(response.body.lessonWords);
    expect(geminiRecorder.requests).toHaveLength(1);
  });

  it('types the picked words when the AI takes too long', async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(1);
    geminiRecorder.delayMs = 2000;
    const timeoutMs = weakSpotsAi.timeoutMs;
    weakSpotsAi.timeoutMs = 50;
    try {
      const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

      expect(body.lessonSource).toBe('words');
      expect(body.targetWords).toEqual(body.lessonWords);
    } finally {
      weakSpotsAi.timeoutMs = timeoutMs;
    }
  });

  it(`types the picked words when the passage is over ${weakSpotsAi.maxWords} words`, async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(1, weakSpotsAi.maxWords);

    const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(body.lessonSource).toBe('words');
  });

  it('types the picked words when the passage uses under 60 % of the practice words', async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(0.5, 30);

    const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

    expect(body.lessonSource).toBe('words');
    expect(geminiRecorder.requests).toHaveLength(1);
  });

  it('types the picked words without asking the AI when no key is set', async () => {
    const learner = await premiumLearner();
    geminiRecorder.replyWith = writesWith(1);
    const key = env.geminiApiKey;
    env.geminiApiKey = undefined;
    try {
      const { body } = await startLesson(learner, { errorType: 'D_MISSING' });

      expect(body.lessonSource).toBe('words');
      expect(geminiRecorder.requests).toHaveLength(0);
    } finally {
      env.geminiApiKey = key;
    }
  });

  it(`asks the AI for ${weakSpotsAi.perMinute} lessons a minute per learner, then types the picked words without an error`, async () => {
    const learner = await premiumLearner();
    const other = await premiumLearner('other@example.com');
    geminiRecorder.replyWith = writesWith(1);

    const sources: string[] = [];
    for (let i = 0; i <= weakSpotsAi.perMinute; i += 1) {
      const response = await startLesson(learner, { errorType: 'D_MISSING' });
      expect(response.status).toBe(201);
      sources.push(response.body.lessonSource);
    }

    expect(sources).toEqual([...Array(weakSpotsAi.perMinute).fill('ai'), 'words']);
    expect(geminiRecorder.requests).toHaveLength(weakSpotsAi.perMinute);
    // The limit is each learner's own.
    expect((await startLesson(other, { errorType: 'D_MISSING' })).body.lessonSource).toBe('ai');
    // Practice sessions do not count.
    expect((await api().post('/api/sessions').set('Authorization', bearerFor(learner)).send({ mode: 'practice' })).status).toBe(201);
  });
});

describe('GET /api/passages', () => {
  it('lists passages only for the modes that type one', async () => {
    const learner = await createUser({});

    const response = await api().get('/api/passages?mode=targeted').set('Authorization', bearerFor(learner));

    expect(response.status).toBe(400);
  });
});
