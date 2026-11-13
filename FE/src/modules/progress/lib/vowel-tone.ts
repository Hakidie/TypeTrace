// The vowel × tone grid (SCRUM-29, US4.1): the layout (the vowels and tones in the order of the backend's grid) and the pure
// helpers that color and name a cell. The numbers come from `GET /api/profile/vowel-tone`, with the threshold `minSeen`.
import type { VowelToneCell } from '../types/progress.types';

export const VOWELS = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y'] as const;

export const TONES = [
  { id: 'ngang', label: 'Ngang', mark: '' },
  { id: 'sac', label: 'Sắc', mark: '́' },
  { id: 'huyen', label: 'Huyền', mark: '̀' },
  { id: 'hoi', label: 'Hỏi', mark: '̉' },
  { id: 'nga', label: 'Ngã', mark: '̃' },
  { id: 'nang', label: 'Nặng', mark: '̣' },
] as const;

export type Vowel = (typeof VOWELS)[number];
export type ToneId = (typeof TONES)[number]['id'];

/** The vowel with its tone mark as one letter: `a` + sắc = `á`, `ă` + nặng = `ặ`. */
export const toneLetter = (vowel: Vowel, tone: ToneId) => (vowel.normalize('NFD') + TONES.find((item) => item.id === tone)!.mark).normalize('NFC');

/** The error rate of a cell in %, a whole number; `null` while it is grey (seen fewer than `minSeen` times). */
export const cellRate = (cell: Pick<VowelToneCell, 'seen' | 'wrong'>, minSeen: number) =>
  cell.seen < minSeen ? null : Math.round((cell.wrong / cell.seen) * 100);

/** The error rate of the worst cell of the grid, at least 1: the darkest color. */
export const worstRate = (cells: VowelToneCell[], minSeen: number) => Math.max(1, ...cells.map((cell) => cellRate(cell, minSeen) ?? 0));
