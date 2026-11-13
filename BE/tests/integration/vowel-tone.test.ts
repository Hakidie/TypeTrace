import { describe, expect, it } from 'vitest';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { computeVowelToneGrid, MIN_VOWEL_TONE_SEEN, type VowelToneCell } from '../../src/services/vowel-tone.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Word = { target: string; typed: string };

const cellOf = (cells: VowelToneCell[], vowel: string, tone: string) => cells.find((cell) => cell.vowel === vowel && cell.tone === tone)!;
const sessionOf = (words: Word[]) => ({ words: words.map((word, index) => ({ index, ...word, errorTypes: [] })) });

describe('computeVowelToneGrid (SCRUM-29, pure)', () => {
  it('gives the whole grid: 12 vowels × 6 tones, all at 0 without a session', () => {
    const { cells, vowels, tones } = computeVowelToneGrid([]);

    expect(vowels).toEqual(['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y']);
    expect(tones).toEqual(['ngang', 'sac', 'huyen', 'hoi', 'nga', 'nang']);
    expect(cells).toHaveLength(72);
    expect(cells.every((cell) => cell.seen === 0 && cell.wrong === 0 && cell.examples.length === 0)).toBe(true);
  });

  it('counts a sighting for each vowel of the target word with the tone of the word', () => {
    const { cells } = computeVowelToneGrid([sessionOf([{ target: 'bà', typed: 'bà' }, { target: 'hoa', typed: 'hoa' }, { target: 'Mười', typed: 'Mười' }])]);

    expect(cellOf(cells, 'a', 'huyen').seen).toBe(1);
    expect(cellOf(cells, 'o', 'ngang').seen).toBe(1);
    expect(cellOf(cells, 'a', 'ngang').seen).toBe(1);
    // ư and ơ are their own vowels, and the tone of "Mười" (huyền) goes with each of its vowels: u→ư, ơ, i.
    expect(cellOf(cells, 'ư', 'huyen').seen).toBe(1);
    expect(cellOf(cells, 'i', 'huyen').seen).toBe(1);
    expect(cells.reduce((sum, cell) => sum + cell.wrong, 0)).toBe(0);
  });

  it('counts a wrong tone as wrong for every vowel of the word, and keeps the word as an example', () => {
    const { cells } = computeVowelToneGrid([sessionOf([{ target: 'bà', typed: 'bá' }])]);

    const cell = cellOf(cells, 'a', 'huyen');
    expect(cell).toMatchObject({ seen: 1, wrong: 1, examples: [{ target: 'bà', typed: 'bá' }] });
  });

  it('counts a hỏi/ngã confusion as a wrong tone', () => {
    const { cells } = computeVowelToneGrid([sessionOf([{ target: 'mã', typed: 'mả' }])]);

    expect(cellOf(cells, 'a', 'nga')).toMatchObject({ seen: 1, wrong: 1 });
  });

  it('blames only the vowel whose letter or mark differs, not the other vowels of a word with the right tone', () => {
    const { cells } = computeVowelToneGrid([sessionOf([{ target: 'hoa', typed: 'hôa' }, { target: 'đa', typed: 'do' }])]);

    // "hoa" typed "hôa": o is wrong, a is right.
    expect(cellOf(cells, 'o', 'ngang')).toMatchObject({ seen: 1, wrong: 1 });
    // "đa" typed "do": same length, and the a is not there: wrong. In "hoa" the a is right.
    expect(cellOf(cells, 'a', 'ngang')).toMatchObject({ seen: 2, wrong: 1 });
  });

  it('does not count a wrong consonant or a word typed with another length against a vowel', () => {
    const { cells } = computeVowelToneGrid([sessionOf([{ target: 'bà', typed: 'cà' }, { target: 'bà', typed: 'bàn' }, { target: 'bà', typed: 'bàng' }])]);

    // Seen three times, never a vowel or tone error: the consonant is wrong in the first, the others have another length and the right tone.
    expect(cellOf(cells, 'a', 'huyen')).toMatchObject({ seen: 3, wrong: 0 });
  });

  it('keeps at most three different wrong words per cell, the newest first, with no repeats', () => {
    const wrong = (typed: string) => ({ target: 'bà', typed });
    const { cells } = computeVowelToneGrid([
      sessionOf([wrong('bá'), wrong('bá')]),
      sessionOf([wrong('bả'), wrong('bã'), wrong('bạ')]),
    ]);

    const cell = cellOf(cells, 'a', 'huyen');
    expect(cell.wrong).toBe(5);
    expect(cell.examples).toEqual([wrong('bá'), wrong('bả'), wrong('bã')]);
  });

  it('only reads the newest 10 sessions', () => {
    const sessions = Array.from({ length: 12 }, () => sessionOf([{ target: 'ba', typed: 'ba' }]));

    expect(cellOf(computeVowelToneGrid(sessions).cells, 'a', 'ngang').seen).toBe(10);
  });
});

describe('GET /api/profile/vowel-tone (SCRUM-29)', () => {
  const sessionDoc = (owner: unknown, minutesAgo: number, words: Word[], fields: Record<string, unknown> = {}) => ({
    owner,
    passageId: 'p1',
    targetWords: words.map((word) => word.target),
    words: words.map((word, index) => ({ index, ...word, errorTypes: [] })),
    status: 'completed',
    isCounted: true,
    completedAt: new Date(Date.now() - minutesAgo * 60_000),
    durationMs: 60_000,
    wpm: 30,
    accuracy: 95,
    ...fields,
  });

  it('answers 401 without a token', async () => {
    await api().get('/api/profile/vowel-tone').expect(401);
  });

  it('gives a new learner the whole grid without data, with the threshold', async () => {
    const learner = await createUser({});

    const { body } = await api().get('/api/profile/vowel-tone').set('Authorization', bearerFor(learner)).expect(200);

    expect(body).toMatchObject({ language: 'vi', window: 10, minSeen: MIN_VOWEL_TONE_SEEN, sessionsUsed: 0 });
    expect(body.cells).toHaveLength(72);
  });

  it('reads only the learner\'s own counted, completed Vietnamese sessions', async () => {
    const learner = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await TypingSessionModel.insertMany([
      sessionDoc(learner._id, 5, [{ target: 'bà', typed: 'bá' }]),
      sessionDoc(learner._id, 6, [{ target: 'bà', typed: 'bà' }], { isCounted: false }),
      sessionDoc(learner._id, 7, [{ target: 'bà', typed: 'bà' }], { status: 'abandoned' }),
      sessionDoc(learner._id, 8, [{ target: 'bà', typed: 'bà' }], { language: 'en' }),
      sessionDoc(other._id, 9, [{ target: 'bà', typed: 'bà' }]),
    ]);

    const { body } = await api().get('/api/profile/vowel-tone').set('Authorization', bearerFor(learner)).expect(200);

    expect(body.sessionsUsed).toBe(1);
    expect(body.cells.find((cell: VowelToneCell) => cell.vowel === 'a' && cell.tone === 'huyen')).toMatchObject({ seen: 1, wrong: 1, examples: [{ target: 'bà', typed: 'bá' }] });
  });

  it('sends no email and no field of the sessions beyond the grid', async () => {
    const learner = await createUser({});

    const { body } = await api().get('/api/profile/vowel-tone').set('Authorization', bearerFor(learner)).expect(200);

    expect(JSON.stringify(body)).not.toContain('@');
    expect(Object.keys(body).sort()).toEqual(['cells', 'language', 'minSeen', 'sessionsUsed', 'tones', 'vowels', 'window']);
  });
});
