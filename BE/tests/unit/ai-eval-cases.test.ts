import { describe, expect, it } from 'vitest';
import { EVAL_CASES } from '../../src/scripts/ai-eval';
import { errorTypesOf } from '../../src/utils/typing-language';

describe('the cases of the AI evaluation (SCRUM-124)', () => {
  it('has 20 cases, 10 for each language', () => {
    expect(EVAL_CASES).toHaveLength(20);
    expect(EVAL_CASES.filter((testCase) => testCase.language === 'vi')).toHaveLength(10);
    expect(EVAL_CASES.filter((testCase) => testCase.language === 'en')).toHaveLength(10);
  });

  it('uses only the error types of the language of each case, and tries every type of both languages', () => {
    for (const testCase of EVAL_CASES) {
      for (const type of testCase.focus) expect(errorTypesOf(testCase.language)).toContain(type);
    }
    for (const language of ['vi', 'en'] as const) {
      const tried = new Set(EVAL_CASES.filter((testCase) => testCase.language === language).flatMap((testCase) => testCase.focus));
      expect([...tried].sort()).toEqual([...errorTypesOf(language)].sort());
    }
  });
});
