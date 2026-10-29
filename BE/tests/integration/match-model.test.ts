import { describe, expect, it } from 'vitest';
import { MatchModel } from '../../src/models/match.model';
import { PassageModel } from '../../src/models/passage.model';
import { generateRoomCode, pickRankedPassage, ROOM_CODE_ALPHABET, toPublicMatch } from '../../src/services/match-view';
import { createUser } from '../helpers/user-factory';

const words = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
const english = { source: 'Written for TypeTrace', status: 'published', visibility: 'public', language: 'en' };

let hosts = 0;
const newMatch = async (code: string, status = 'waiting') => {
  hosts += 1;
  const host = await createUser({ email: `host${hosts}@example.com` });
  return MatchModel.create({
    code,
    status,
    passageId: host._id,
    passageTitle: 'A quiet morning',
    targetWords: ['The', 'sun', 'rose.'],
    players: [{ user: host._id, displayName: 'Lan', avatar: host.avatar }]
  });
};

describe('room codes (ranked duel, phase 3)', () => {
  it('makes 6-character codes without look-alike characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OI]/);
    for (let i = 0; i < 200; i++) expect(generateRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('keeps a code unique among open rooms only', async () => {
    await MatchModel.init();
    await newMatch('ABCDEF');
    await expect(newMatch('ABCDEF')).rejects.toThrow(/duplicate key/);

    await MatchModel.updateOne({ code: 'ABCDEF' }, { status: 'finished' });
    await expect(newMatch('ABCDEF')).resolves.toBeDefined();
  });
});

describe('pickRankedPassage', () => {
  it('picks only published public English passages of 30 to 80 words', async () => {
    await PassageModel.create({ ...english, title: 'Vietnamese', language: 'vi', content: words(40) });
    await PassageModel.create({ ...english, title: 'Too short', content: words(20) });
    await PassageModel.create({ ...english, title: 'Draft', status: 'draft', content: words(40) });
    await PassageModel.create({ ...english, title: 'Private', visibility: 'private', content: words(40) });
    await PassageModel.create({ ...english, title: 'Good one', content: words(40) });

    for (let i = 0; i < 10; i++) expect((await pickRankedPassage())?.title).toBe('Good one');
  });

  it('finds nothing when the bank has no English passage', async () => {
    await PassageModel.create({ ...english, title: 'Vietnamese', language: 'vi', content: words(40) });

    expect(await pickRankedPassage()).toBeUndefined();
  });
});

describe('toPublicMatch', () => {
  it('hides the passage words while the room waits, and never sends typed words or emails', async () => {
    const match = await newMatch('QWERTY');
    const view = toPublicMatch(match);

    expect(view).toMatchObject({ code: 'QWERTY', status: 'waiting', passageTitle: 'A quiet morning', wordCount: 3 });
    expect(view.targetWords).toBeUndefined();
    expect(view.players[0]).toMatchObject({ displayName: 'Lan', ready: false, typedCount: 0, finished: false });
    expect(JSON.stringify(view)).not.toMatch(/typedWords|typedAtMs|@example\.com|passageId/);

    match.status = 'running';
    expect(toPublicMatch(match).targetWords).toEqual(['The', 'sun', 'rose.']);
  });
});
