import { describe, expect, it } from 'vitest';
import { answerWpm, botReply, bonusMs, checkAnswer, hintFor, keyOf, parseWordList, sylKey } from './word-chain';

const LIST = ['*học sinh', '*sinh viên', '*sinh nhật', '*viên chức', '*viên phấn', '*nhật ký', '*nhật báo', 'sinh sôi', '*hoà bình', '*bình yên', '*bình minh', 'giỏi giắn', '*học giỏi'].join('\n');
const bank = parseWordList(LIST);
const none = new Set<string>();

describe('word chain rules', () => {
  it('reads the list: every word for the player, the starred ones for the bot', () => {
    expect(bank.byKey.size).toBe(13);
    expect(bank.botWords).toContain('học sinh');
    expect(bank.botWords).not.toContain('sinh sôi');
  });

  it('compares tone marks wherever they sit', () => {
    expect(sylKey('hòa')).toBe(sylKey('hoà'));
    expect(checkAnswer(bank, 'cuộc hoà', 'hòa bình', none)).toEqual({ ok: true, word: 'hoà bình' });
  });

  it('accepts a listed word that starts with the last syllable, in any case and spacing', () => {
    expect(checkAnswer(bank, 'học sinh', '  Sinh   VIÊN ', none)).toEqual({ ok: true, word: 'sinh viên' });
    expect(checkAnswer(bank, 'học sinh', 'sinh sôi', none)).toEqual({ ok: true, word: 'sinh sôi' });
  });

  it('turns down the wrong shape, start, an unknown word and a used one', () => {
    expect(checkAnswer(bank, 'học sinh', 'sinh', none)).toEqual({ ok: false, reason: 'shape' });
    expect(checkAnswer(bank, 'học sinh', 'viên chức', none)).toEqual({ ok: false, reason: 'start' });
    expect(checkAnswer(bank, 'học sinh', 'sinh tố', none)).toEqual({ ok: false, reason: 'unknown' });
    expect(checkAnswer(bank, 'học sinh', 'sinh viên', new Set([keyOf('sinh viên')]))).toEqual({ ok: false, reason: 'used' });
  });

  it('gives the time bonus by the speed of the answer', () => {
    // "sinh viên" is 9 characters = 1.8 words: 2.7 s is 40 WPM
    expect(answerWpm('sinh viên', 2_700)).toBeCloseTo(40);
    expect(bonusMs(40)).toBe(5_000);
    expect(bonusMs(39.9)).toBe(4_000);
    expect(bonusMs(25)).toBe(4_000);
    expect(bonusMs(15)).toBe(3_000);
    expect(bonusMs(14.9)).toBe(2_000);
    expect(bonusMs(0)).toBe(2_000);
  });

  it('the bot answers with a word that is easy to answer back, and only from its own list', () => {
    // after "học sinh" the bot can say "sinh viên" (2 answers) or "sinh nhật" (2 answers), never "sinh sôi"
    for (let i = 0; i < 20; i++) expect(['sinh viên', 'sinh nhật']).toContain(botReply(bank, 'học sinh', new Set([keyOf('học sinh')])));
  });

  it('the bot has no answer when its list has none left', () => {
    expect(botReply(bank, 'giỏi giắn', none)).toBeNull();
    expect(botReply(bank, 'viên chức', none)).toBeNull();
  });

  it('the bot starts a fresh chain with an unused word of its list', () => {
    const word = botReply(bank, null, none);
    expect(bank.botWords).toContain(word);
  });

  it('a hint is a common word when there is one, else any word, else nothing', () => {
    expect(['sinh viên', 'sinh nhật']).toContain(hintFor(bank, 'học sinh', none));
    expect(hintFor(bank, 'học sinh', new Set([keyOf('sinh viên'), keyOf('sinh nhật')]))).toBe('sinh sôi');
    expect(hintFor(bank, 'giỏi giắn', none)).toBeNull();
  });
});
