import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { ERROR_TREND_STYLES, errorTrendTypes, hasNoTrend, shownTrendPoints } from '../lib/error-trend';
import type { ErrorTrend, ErrorTrendPoint } from '../types/progress.types';
import { ErrorTrendChart } from './ErrorTrendChart';
import { ErrorTrendLegend } from './ErrorTrendLegend';

const getErrorTrend = vi.fn();

vi.mock('../api/progress.api', () => ({
  progressApi: { getErrorTrend: (range: string, language: string, date?: string) => getErrorTrend(range, language, date) },
}));

const rates = (value: number | null, language: 'vi' | 'en' = 'vi') => Object.fromEntries(errorTrendTypes(language).map((type) => [type, value]));
const point = (key: string, value: number | null = 10): ErrorTrendPoint => ({ key, rates: rates(value) });
const trend = (points: ErrorTrendPoint[], overrides: Partial<ErrorTrend> = {}): ErrorTrend => ({ range: 'month', language: 'vi', types: errorTrendTypes('vi'), points, ...overrides });

beforeEach(() => {
  getErrorTrend.mockReset().mockResolvedValue(trend([point('2026-02-01'), point('2026-02-08', 12), point('2026-02-15', 8), point('2026-02-22', 6)]));
});

describe('shownTrendPoints and hasNoTrend', () => {
  const empty = point('a', null);
  const full = point('b', 5);

  it('starts a month or a year at the first period with a rate, and shows every day of a week', () => {
    expect(shownTrendPoints('month', [empty, empty, full, empty])).toEqual([full, empty]);
    expect(shownTrendPoints('year', [empty, full])).toEqual([full]);
    expect(shownTrendPoints('week', [empty, full])).toEqual([empty, full]);
  });

  it('keeps all the periods while there is no rate at all, and tells there is nothing to draw', () => {
    expect(shownTrendPoints('month', [empty, empty])).toEqual([empty, empty]);
    expect(hasNoTrend([empty, empty])).toBe(true);
    expect(hasNoTrend([empty, { key: 'c', rates: { TONE_WRONG: 0 } }])).toBe(false);
  });
});

describe('the error types of each language', () => {
  it('has five Vietnamese lines and six English ones, each with a theme token and no two with the same look', () => {
    expect(errorTrendTypes('vi')).toHaveLength(5);
    expect(errorTrendTypes('en')).toHaveLength(6);
    for (const language of ['vi', 'en'] as const) {
      const looks = errorTrendTypes(language).map((type) => `${ERROR_TREND_STYLES[type].color}|${ERROR_TREND_STYLES[type].dash ?? ''}`);
      expect(new Set(looks).size).toBe(looks.length);
      expect(looks.every((look) => look.startsWith('var(--'))).toBe(true);
    }
  });
});

describe('ErrorTrendChart', () => {
  it('asks for the range, the language and the day, and draws the chart', async () => {
    renderWithProviders(<ErrorTrendChart range="month" date="2026-02-10" language="vi" hidden={new Set()} />);

    expect(await screen.findByRole('img', { name: 'Error rate of each error type by week' })).toBeInTheDocument();
    expect(getErrorTrend).toHaveBeenCalledWith('month', 'vi', '2026-02-10');
  });

  it('asks again for the other language', async () => {
    getErrorTrend.mockResolvedValue(trend([point('2026-02-01')], { language: 'en', types: errorTrendTypes('en') }));
    renderWithProviders(<ErrorTrendChart range="month" language="en" hidden={new Set()} />);

    await screen.findByRole('img');
    expect(getErrorTrend).toHaveBeenCalledWith('month', 'en', undefined);
  });

  it('says how to get data when there is none: the placement test', async () => {
    getErrorTrend.mockResolvedValue(trend([point('2026-02-01', null)]));
    renderWithProviders(<ErrorTrendChart range="month" language="vi" hidden={new Set()} />);

    expect(await screen.findByText('No error rates yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take the placement test' })).toHaveAttribute('href', '/typing?mode=placement');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sends an English learner with no data to Practice', async () => {
    getErrorTrend.mockResolvedValue(trend([point('2026-02-01', null)], { language: 'en', types: errorTrendTypes('en') }));
    renderWithProviders(<ErrorTrendChart range="month" language="en" hidden={new Set()} />);

    expect(await screen.findByText(/first counted English session/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Practice' })).toHaveAttribute('href', '/typing');
  });

  it('shows a loading state and then an error with a retry', async () => {
    const user = userEvent.setup();
    getErrorTrend.mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<ErrorTrendChart range="month" language="vi" hidden={new Set()} />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    unmount();

    getErrorTrend.mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<ErrorTrendChart range="month" language="vi" hidden={new Set()} />);
    expect(await screen.findByText('Could not load the error rate chart')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });
});

describe('ErrorTrendLegend', () => {
  it('names the lines that show, centered, with a sample of each in a theme token', () => {
    renderWithProviders(<ErrorTrendLegend types={['TONE_WRONG', 'MARK_WRONG']} />);

    const legend = screen.getByRole('list', { name: 'Error types shown' });
    expect(legend).toHaveClass('justify-center');
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Wrong tone', 'Wrong vowel mark (â ê ô ă ơ ư)']);
    for (const line of legend.querySelectorAll('line')) expect(line.getAttribute('stroke')).toMatch(/^var\(--/);
  });
});
