import { describe, expect, it } from 'vitest';
import { GAP_REM, lineRem, passageHeightRem, scrollStepRem } from './passage-layout';

describe('passage layout', () => {
  it('keeps the sizes the passage had at 2rem: a 2.75rem line, a 0.5rem gap, 9.25rem for 3 rows', () => {
    expect(lineRem(2)).toBe(2.75);
    expect(GAP_REM).toBe(0.5);
    expect(passageHeightRem(2, 3)).toBe(9.25);
    expect(scrollStepRem(2)).toBe(3.25);
  });

  it('follows the font size at the edges 1rem and 2.5rem', () => {
    expect(passageHeightRem(1, 3)).toBe(3 * 1.375 + 2 * 0.5);
    expect(passageHeightRem(2.5, 3)).toBe(3 * 3.4375 + 2 * 0.5);
    expect(scrollStepRem(1)).toBe(1.375 + 0.5);
  });
});
