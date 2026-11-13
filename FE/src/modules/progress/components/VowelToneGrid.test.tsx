import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TONES, toneLetter, VOWELS } from '../lib/vowel-tone';
import type { VowelToneCell, VowelToneGridData } from '../types/progress.types';
import { VowelToneGrid } from './VowelToneGrid';

const getVowelTone = vi.fn();

vi.mock('../api/progress.api', () => ({ progressApi: { getVowelTone: () => getVowelTone() } }));

/** The whole grid (72 cells), every cell seen 10 times and never wrong, except the ones given. */
const gridOf = (overrides: Record<string, Partial<VowelToneCell>> = {}, extra: Partial<VowelToneGridData> = {}): VowelToneGridData => ({
  language: 'vi',
  window: 10,
  minSeen: 5,
  sessionsUsed: 4,
  cells: VOWELS.flatMap((vowel) =>
    TONES.map((tone) => ({ vowel, tone: tone.id, seen: 10, wrong: 0, examples: [], ...overrides[`${vowel}:${tone.id}`] })),
  ),
  ...extra,
});

const grid = () => screen.findByRole('group', { name: 'Error rate of each vowel with each tone' });

beforeEach(() => {
  getVowelTone.mockReset().mockResolvedValue(
    gridOf({
      'a:huyen': { seen: 20, wrong: 8, examples: [{ target: 'bà', typed: 'bá' }, { target: 'nhà', typed: 'nhả' }] },
      'ă:nang': { seen: 3, wrong: 3 },
      'y:ngang': { seen: 5, wrong: 1 },
    }),
  );
});

describe('VowelToneGrid', () => {
  it('draws 12 vowels × 6 tones: 72 cells, with the tone names above', async () => {
    renderWithProviders(<VowelToneGrid />);

    const group = await grid();
    expect(within(group).getAllByRole('button')).toHaveLength(72);
    for (const tone of TONES) expect(within(group).getByText(tone.label)).toBeInTheDocument();
    for (const vowel of VOWELS) expect(within(group).getAllByText(vowel).length).toBeGreaterThan(0);
  });

  it('puts the letter with its tone and its error rate in each cell, colored with the theme only', async () => {
    renderWithProviders(<VowelToneGrid />);
    await grid();

    expect(toneLetter('a', 'huyen')).toBe('à');
    expect(toneLetter('ă', 'nang')).toBe('ặ');
    expect(toneLetter('ơ', 'ngang')).toBe('ơ');
    const worst = screen.getByRole('button', { name: 'à: 40% wrong' });
    expect(worst).toHaveTextContent('40%');
    expect(worst.getAttribute('style')).toContain('var(--primary)');
    // 1 wrong in 5 sightings is at the threshold: colored, not grey.
    expect(screen.getByRole('button', { name: 'y: 20% wrong' })).toBeInTheDocument();
  });

  it('greys the cells seen fewer times than the backend\'s minimum', async () => {
    renderWithProviders(<VowelToneGrid />);
    await grid();

    // ặ: 3 sightings, all wrong, but under 5: no rate, not colored.
    const thin = screen.getByRole('button', { name: 'ặ: not enough data' });
    expect(thin).toHaveTextContent('–');
    expect(thin.getAttribute('style')).toBeNull();
    expect(screen.getByText('Fewer than 5 sightings: not enough data')).toBeInTheDocument();
  });

  it('tells the sightings, the errors and the wrong words of a cell on hover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VowelToneGrid />);
    await grid();

    await user.hover(screen.getByRole('button', { name: 'à: 40% wrong' }));

    expect((await screen.findAllByText('Seen: 20 · Wrong: 8 · 40%'))[0]).toBeInTheDocument();
    expect((await screen.findAllByText('Typed wrong: bà → bá, nhà → nhả'))[0]).toBeInTheDocument();
  });

  it('tells a grey cell needs more data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VowelToneGrid />);
    await grid();

    await user.hover(screen.getByRole('button', { name: 'ặ: not enough data' }));

    expect((await screen.findAllByText('Not enough data yet: needs 5 sightings.'))[0]).toBeInTheDocument();
    expect((await screen.findAllByText('Seen: 3 · Wrong: 3'))[0]).toBeInTheDocument();
  });

  it('uses the minimum the backend sends, never one written in the page', async () => {
    getVowelTone.mockResolvedValue(gridOf({ 'a:huyen': { seen: 8, wrong: 4 } }, { minSeen: 9 }));
    renderWithProviders(<VowelToneGrid />);
    await grid();

    expect(screen.getByRole('button', { name: 'à: not enough data' })).toBeInTheDocument();
    expect(screen.getByText('Fewer than 9 sightings: not enough data')).toBeInTheDocument();
  });

  it('shares the height of the screen between the rows, so the spacing follows the screen', async () => {
    renderWithProviders(<VowelToneGrid />);

    const group = await grid();
    expect(group).toHaveClass('flex-1');
    expect(group.className).toMatch(/grid-rows-\[auto_repeat\(12,minmax\(2\.75rem,1fr\)\)\]/);
    expect(screen.getByRole('region', { name: 'Vowel × tone' })).toHaveClass('flex-1');
  });

  it('shows a loading state while the grid loads', () => {
    getVowelTone.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VowelToneGrid />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the grid cannot be loaded', async () => {
    const user = userEvent.setup();
    getVowelTone.mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<VowelToneGrid />);

    expect(await screen.findByText('Could not load the vowel × tone grid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await grid()).toBeInTheDocument();
  });

  it('says there is nothing yet when the learner has no counted Vietnamese session', async () => {
    getVowelTone.mockResolvedValue(gridOf({}, { sessionsUsed: 0 }));
    renderWithProviders(<VowelToneGrid />);

    expect(await screen.findByText('No counted Vietnamese sessions yet')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
