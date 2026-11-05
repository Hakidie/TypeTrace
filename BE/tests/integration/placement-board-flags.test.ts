import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingModel } from '../../src/models/app-setting.model';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import * as settingsService from '../../src/services/app-setting.service';
import { rebuildPlacementBoardFlags } from '../../src/services/typing-session.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

beforeAll(() => AppSettingModel.init());

const START = new Date('2026-03-10T08:00:00.000Z');
const TARGET = ['một', 'hai', 'ba', 'bốn'];
const WORDS = Array.from({ length: 30 }, (_, index) => `chữ${index + 1}`);

beforeEach(() => {
  adminAuth = undefined;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

interface Seed {
  accuracy: number;
  mode?: 'placement' | 'practice';
  /** `null`: the session was started without a chosen time. */
  chosenLimitSeconds?: number | null;
  isCounted?: boolean;
  durationMs?: number;
  /** How many words were typed, out of the 4 of the passage. */
  typed?: number;
  status?: 'completed' | 'abandoned';
  /** The flag as it is saved (some tests start from a wrong one). */
  flag?: boolean;
}

const seed = (owner: { _id: unknown }, { accuracy, mode = 'placement', chosenLimitSeconds = 180, isCounted = true, durationMs = 180_000, typed = 4, status = 'completed', flag = false }: Seed) =>
  TypingSessionModel.create({
    owner: owner._id,
    mode,
    passageId: 'p1',
    targetWords: TARGET,
    words: TARGET.slice(0, typed).map((target, index) => ({ index, target, typed: target, errorTypes: [] })),
    status,
    accuracy,
    chosenLimitSeconds: chosenLimitSeconds ?? undefined,
    isCounted,
    durationMs,
    completedAt: START,
    isOnPlacementBoard: flag
  });

const flagOf = async (id: unknown) => (await TypingSessionModel.findById(id))!.isOnPlacementBoard;
// One admin for the whole test: saving a minimum twice must not make the account twice.
let adminAuth: string | undefined;
const signInAdmin = async () => (adminAuth ??= bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' })));
const saveMinimum = async (minAccuracy: number) => api().put('/api/admin/placement/settings').set('Authorization', await signInAdmin()).send({ minAccuracy });

describe('saving a new minimum accuracy sets the flag again on every completed placement session', () => {
  it('takes off the board the sessions under a higher minimum (90 to 95)', async () => {
    const user = await createUser({});
    const sessions = await Promise.all([85, 90, 92, 94.9, 95, 99].map((accuracy) => seed(user, { accuracy, flag: accuracy >= 90 })));

    expect((await saveMinimum(95)).status).toBe(200);

    expect(await Promise.all(sessions.map((session) => flagOf(session._id)))).toEqual([false, false, false, false, true, true]);
  });

  it('puts on the board the sessions that reach a lower minimum (90 to 80)', async () => {
    const user = await createUser({});
    const sessions = await Promise.all([79.9, 80, 85, 89.9, 90].map((accuracy) => seed(user, { accuracy, flag: accuracy >= 90 })));

    await saveMinimum(80);

    expect(await Promise.all(sessions.map((session) => flagOf(session._id)))).toEqual([false, true, true, true, true]);
  });

  it('heals a flag that was wrong before: a session of 89.2% saved with a false flag is on the board at 85, though it is outside the old band', async () => {
    const user = await createUser({});
    const session = await seed(user, { accuracy: 89.2, flag: false });
    await saveMinimum(80); // already 80 and the flag is still wrong: the first save of the story
    expect(await flagOf(session._id)).toBe(true);
    await TypingSessionModel.updateOne({ _id: session._id }, { isOnPlacementBoard: false }); // wrong again

    await saveMinimum(85);

    expect(await flagOf(session._id)).toBe(true);
  });

  it('puts on the board only the sessions that pass the other rules too', async () => {
    const user = await createUser({});
    const ok = await seed(user, { accuracy: 85 });
    const finishedEarly = await seed(user, { accuracy: 85, durationMs: 100_000, typed: 4 }); // typed the whole passage: on
    const stoppedEarly = await seed(user, { accuracy: 85, durationMs: 100_000, typed: 2, flag: true });
    const shortTime = await seed(user, { accuracy: 85, chosenLimitSeconds: 60, flag: true });
    const noTime = await seed(user, { accuracy: 85, chosenLimitSeconds: null, flag: true });
    const notCounted = await seed(user, { accuracy: 85, isCounted: false, flag: true });
    const practice = await seed(user, { accuracy: 85, mode: 'practice' });
    const abandoned = await seed(user, { accuracy: 85, status: 'abandoned' });

    await saveMinimum(80);

    expect(await Promise.all([ok, finishedEarly, stoppedEarly, shortTime, noTime, notCounted, practice, abandoned].map((session) => flagOf(session._id)))).toEqual([
      true, true, false, false, false, false, false, false
    ]);
  });

  it('changes nothing when it runs again, even with the same minimum', async () => {
    const user = await createUser({});
    await seed(user, { accuracy: 70 });
    await seed(user, { accuracy: 98, flag: true });
    await saveMinimum(95);
    const before = await TypingSessionModel.find().sort({ _id: 1 }).lean();

    await saveMinimum(95);

    expect(await TypingSessionModel.find().sort({ _id: 1 }).lean()).toEqual(before);
  });

  it('gives the same flags after the minimum goes up and then back down', async () => {
    const user = await createUser({});
    const sessions = await Promise.all([85, 90, 92, 97].map((accuracy) => seed(user, { accuracy, flag: accuracy >= 90 })));
    const flags = () => Promise.all(sessions.map((session) => flagOf(session._id)));
    const original = await flags();

    await saveMinimum(96);
    expect(await flags()).toEqual([false, false, false, true]);
    await saveMinimum(90);

    expect(await flags()).toEqual(original);
  });
});

describe('rebuildPlacementBoardFlags (npm run migrate:placement-board)', () => {
  it('sets the flag from the rules and the minimum in use (90 until an admin changes it)', async () => {
    const user = await createUser({});
    const high = await seed(user, { accuracy: 95 });
    const edge = await seed(user, { accuracy: 90 });
    const low = await seed(user, { accuracy: 89.2, flag: true });
    const practice = await seed(user, { accuracy: 95, mode: 'practice', flag: true });

    const changed = await rebuildPlacementBoardFlags();

    expect(await Promise.all([high, edge, low, practice].map((session) => flagOf(session._id)))).toEqual([true, true, false, true]); // a practice session is left alone
    expect(changed).toBe(3);
  });

  it('uses the minimum an admin saved', async () => {
    const user = await createUser({});
    await settingsService.updateAppSettings({ placementMinAccuracy: 85 });
    const session = await seed(user, { accuracy: 89.2 });

    await rebuildPlacementBoardFlags();

    expect(await flagOf(session._id)).toBe(true);
  });
});

describe('a session completed while an admin changes the minimum', () => {
  /** Completes a 3-minute placement session with `wrong` of 30 words wrong; `duringCompletion` runs after the completion read the minimum. */
  const completeWhile = async (wrong: number, duringCompletion: () => Promise<unknown>) => {
    await PassageModel.create({ title: 'Bài', content: WORDS.join(' '), source: 'Tự viết', status: 'published', visibility: 'public', isPlacement: true });
    const auth = bearerFor(await createUser({ email: 'learner@example.com' }));
    const session = (await api().post('/api/sessions').set('Authorization', auth).send({ mode: 'placement', timeLimitSeconds: 180 })).body;
    await api().patch(`/api/sessions/${session._id}/begin`).set('Authorization', auth);
    vi.setSystemTime(new Date(START.getTime() + 180_000));

    const realGetAppSettings = settingsService.getAppSettings;
    vi.spyOn(settingsService, 'getAppSettings').mockImplementationOnce(async () => {
      const read = await realGetAppSettings(); // the minimum the completion goes by
      await duringCompletion();
      return read;
    });
    const typedWords = WORDS.map((word, index) => (index < wrong ? `${word}x` : word));
    return api().patch(`/api/sessions/${session._id}/complete`).set('Authorization', auth).send({ typedWords });
  };

  it('is taken off the board by the session itself when the minimum went up after it was read (93.3%, 90 to 95)', async () => {
    const response = await completeWhile(2, () => saveMinimum(95));

    expect(response.status).toBe(200);
    expect(response.body.isOnPlacementBoard).toBe(false);
    expect(await flagOf(response.body._id)).toBe(false);
  });

  it('is put on the board by the session itself when the minimum went down after it was read (86.7%, 90 to 80)', async () => {
    const response = await completeWhile(4, () => saveMinimum(80));

    expect(response.body.isOnPlacementBoard).toBe(true);
    expect(await flagOf(response.body._id)).toBe(true);
  });

  it('keeps its flag when the minimum did not change', async () => {
    const response = await completeWhile(2, async () => undefined);

    expect(response.body.isOnPlacementBoard).toBe(true);
  });
});
