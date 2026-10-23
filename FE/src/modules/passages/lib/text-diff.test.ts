import { describe, expect, it } from 'vitest';
import { diffWords } from './text-diff';

describe('diffWords', () => {
  it('has one same part for equal texts', () => {
    expect(diffWords('Hà Nội vào thu', 'Hà Nội vào thu')).toEqual([{ kind: 'same', text: 'Hà Nội vào thu' }]);
  });

  it('shows a changed word as removed then added, around the words that stay', () => {
    expect(diffWords('Hà Nội vào thu', 'Hà Nội vào đông')).toEqual([
      { kind: 'same', text: 'Hà Nội vào ' },
      { kind: 'removed', text: 'thu' },
      { kind: 'added', text: 'đông' },
    ]);
  });

  it('finds words that were added or taken out', () => {
    expect(diffWords('một hai ba', 'một hai bốn ba')).toEqual([
      { kind: 'same', text: 'một hai ' },
      { kind: 'added', text: 'bốn ' },
      { kind: 'same', text: 'ba' },
    ]);
    expect(diffWords('một hai ba', 'một ba')).toEqual([
      { kind: 'same', text: 'một ' },
      { kind: 'removed', text: 'hai ' },
      { kind: 'same', text: 'ba' },
    ]);
  });

  it('handles empty texts', () => {
    expect(diffWords('', 'mới')).toEqual([{ kind: 'added', text: 'mới' }]);
    expect(diffWords('cũ', '')).toEqual([{ kind: 'removed', text: 'cũ' }]);
    expect(diffWords('', '')).toEqual([]);
  });
});
