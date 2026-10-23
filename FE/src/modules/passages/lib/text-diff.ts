export interface DiffPart {
  text: string;
  /** `same` = in both texts, `removed` = only in the old one, `added` = only in the new one. */
  kind: 'same' | 'removed' | 'added';
}

/**
 * The words that differ between two texts, in reading order (longest common subsequence of the words, so a changed word
 * is a `removed` followed by an `added`). Spaces and line breaks stay attached to their word. Texts are at most 5000
 * characters, so the table is small.
 */
export const diffWords = (before: string, after: string): DiffPart[] => {
  const split = (text: string) => text.match(/\S+\s*/g) ?? [];
  const a = split(before);
  const b = split(after);
  // `same[i][j]`: how many words the tails `a[i..]` and `b[j..]` have in common.
  const same = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      same[i][j] = a[i].trim() === b[j].trim() ? same[i + 1][j + 1] + 1 : Math.max(same[i + 1][j], same[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].trim() === b[j].trim()) {
      push('same', b[j]);
      i += 1;
      j += 1;
    } else if (same[i + 1][j] >= same[i][j + 1]) {
      push('removed', a[i]);
      i += 1;
    } else {
      push('added', b[j]);
      j += 1;
    }
  }
  for (; i < a.length; i += 1) push('removed', a[i]);
  for (; j < b.length; j += 1) push('added', b[j]);
  return parts;
};
