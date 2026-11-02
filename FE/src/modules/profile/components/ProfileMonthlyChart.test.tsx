import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { ChartRange, MonthlyProgressPoint } from '../types/profile.types';
import { ComparisonTooltip, MonthlyChartTooltip, ProfileMonthlyChart } from './ProfileMonthlyChart';

const getMonthlyProgress = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getMonthlyProgress: (range: ChartRange, date?: string) => getMonthlyProgress(range, date) },
}));

const MONTHS = [
  '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
];
const noData = (): MonthlyProgressPoint[] => MONTHS.map((key) => ({ key, avgWpm: null, avgAccuracy: null, carriedOver: false }));
const answer = (points: MonthlyProgressPoint[], range: ChartRange = 'year') => ({ range, points });

beforeEach(() => {
  getMonthlyProgress.mockReset();
});

describe('ProfileMonthlyChart (SCRUM-240)', () => {
  it('shows a placeholder while the data loads', () => {
    getMonthlyProgress.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ProfileMonthlyChart range="year" />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it.each(['year', 'month', 'week'] as const)('asks for the range it is given (%s)', async (range) => {
    getMonthlyProgress.mockResolvedValue(answer(noData(), range));
    renderWithProviders(<ProfileMonthlyChart range={range} />);

    await screen.findByRole('img');
    expect(getMonthlyProgress).toHaveBeenCalledWith(range, undefined);
  });

  it('asks for the year, month or week that holds the chosen day', async () => {
    getMonthlyProgress.mockResolvedValue(answer(noData(), 'month'));
    renderWithProviders(<ProfileMonthlyChart range="month" date="2026-02-20" />);

    await screen.findByRole('img');
    expect(getMonthlyProgress).toHaveBeenCalledWith('month', '2026-02-20');
  });

  it('has no switch of the range: the page around it picks the range', async () => {
    getMonthlyProgress.mockResolvedValue(answer(noData(), 'week'));
    renderWithProviders(<ProfileMonthlyChart range="week" />);

    await screen.findByRole('img');
    expect(screen.queryByRole('radiogroup', { name: 'Chart range' })).not.toBeInTheDocument();
  });

  it('has no legend: the tooltip names the lines', async () => {
    getMonthlyProgress.mockResolvedValue(answer(noData()));
    renderWithProviders(<ProfileMonthlyChart range="year" />);

    await screen.findByRole('img');
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });

  it('shows the chart when there is data', async () => {
    const points = noData();
    points[10] = { key: '2026-01', avgWpm: 42.5, avgAccuracy: 96.5, carriedOver: false };
    points[11] = { key: '2026-02', avgWpm: 42.5, avgAccuracy: 96.5, carriedOver: true };
    getMonthlyProgress.mockResolvedValue(answer(points));
    renderWithProviders(<ProfileMonthlyChart range="year" />);

    expect(await screen.findByRole('img', { name: 'WPM and accuracy by month' })).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  });

  it('names the chart after its range', async () => {
    getMonthlyProgress.mockResolvedValue(answer([{ key: '2026-03-09', avgWpm: 40, avgAccuracy: 95, carriedOver: false }], 'week'));
    renderWithProviders(<ProfileMonthlyChart range="week" />);

    expect(await screen.findByRole('img', { name: 'WPM and accuracy by day' })).toBeInTheDocument();
  });

  it('still shows the chart, with "No data yet" over it, when there is no data', async () => {
    getMonthlyProgress.mockResolvedValue(answer(noData()));
    renderWithProviders(<ProfileMonthlyChart range="year" />);

    expect(await screen.findByRole('img', { name: 'WPM and accuracy by month, no data yet' })).toBeInTheDocument();
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    getMonthlyProgress.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(answer(noData()));
    renderWithProviders(<ProfileMonthlyChart range="year" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the monthly chart');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('img', { name: /no data yet/ })).toBeInTheDocument();
  });
});

describe('MonthlyChartTooltip', () => {
  it('shows the figures of a period with sessions', () => {
    render(<MonthlyChartTooltip range="year" point={{ key: '2026-01', avgWpm: 42.5, avgAccuracy: 96.5, carriedOver: false }} />);

    expect(screen.getByText('JAN 2026')).toBeInTheDocument();
    expect(screen.getByText(/WPM:/).closest('p')).toHaveTextContent('WPM: 42.5');
    expect(screen.getByText(/Accuracy:/).closest('p')).toHaveTextContent('Accuracy: 96.5%');
    expect(screen.queryByText(/same figures as/)).not.toBeInTheDocument();
  });

  it.each([
    ['year', '2026-02', 'FEB 2026', 'month'],
    ['month', '2026-03-08', 'W2 MAR 2026', 'week'],
    ['week', '2026-03-09', 'MON 09 MAR', 'day'],
  ] as const)('says so when the figures are the ones of the period before (%s)', (range, key, title, before) => {
    render(<MonthlyChartTooltip range={range} point={{ key, avgWpm: 42.5, avgAccuracy: 96.5, carriedOver: true }} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(`No sessions: same figures as the ${before} before`)).toBeInTheDocument();
  });

  it('says there is no data for a period before the first placement', () => {
    render(<MonthlyChartTooltip range="year" point={{ key: '2025-03', avgWpm: null, avgAccuracy: null, carriedOver: false }} />);

    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('asks for each period put on the chart, and names the chart after it', async () => {
    getMonthlyProgress.mockResolvedValue(answer([{ key: '2026-01', avgWpm: 40, avgAccuracy: 95, carriedOver: false }]));
    renderWithProviders(
      <ProfileMonthlyChart
        range="month"
        date="2026-03-10"
        compare={[
          { range: 'year', date: '2025-03-10' },
          { range: 'week', date: '2026-02-08' },
        ]}
      />,
    );

    expect(await screen.findByRole('img', { name: 'WPM and accuracy by month, with other periods' })).toBeInTheDocument();
    expect(getMonthlyProgress).toHaveBeenCalledWith('month', '2026-03-10');
    expect(getMonthlyProgress).toHaveBeenCalledWith('year', '2025-03-10');
    expect(getMonthlyProgress).toHaveBeenCalledWith('week', '2026-02-08');
  });

  it('does not ask for anything else without periods put on the chart', async () => {
    getMonthlyProgress.mockResolvedValue(answer(noData()));
    renderWithProviders(<ProfileMonthlyChart range="year" date="2026-03-10" />);

    await screen.findByRole('img');
    expect(getMonthlyProgress).toHaveBeenCalledTimes(1);
  });

  it('tells the figures of each period in the tooltip of a column, the ones added with fainter samples', () => {
    const a = { key: '2026-03', avgWpm: 50, avgAccuracy: 96, carriedOver: false };
    const b = { key: '2025-03', avgWpm: 40, avgAccuracy: 92.5, carriedOver: false };
    render(
      <ComparisonTooltip
        points={[
          { point: a, range: 'year', opacity: 1 },
          { point: b, range: 'year', opacity: 0.6 },
          { point: null, range: 'year', opacity: 0.4 },
        ]}
      />,
    );

    expect(screen.getAllByText(/WPM:/)).toHaveLength(2);
    expect(screen.getByText('MAR 2026').parentElement).toHaveTextContent('WPM: 50Accuracy: 96%');
    expect(screen.getByText('MAR 2025').parentElement).toHaveTextContent('WPM: 40Accuracy: 92.5%');
  });

  it('tells only the figures of the lines that show in the tooltip', () => {
    const point = { key: '2026-03', avgWpm: 50, avgAccuracy: 96, carriedOver: false };
    const { rerender } = render(<MonthlyChartTooltip point={point} range="year" lines="wpm" />);
    expect(screen.getByText(/WPM:/)).toBeInTheDocument();
    expect(screen.queryByText(/Accuracy:/)).not.toBeInTheDocument();

    rerender(<MonthlyChartTooltip point={point} range="year" lines="accuracy" />);
    expect(screen.queryByText(/WPM:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Accuracy:/)).toBeInTheDocument();

    rerender(<ComparisonTooltip points={[{ point, range: 'year', opacity: 1 }]} lines="accuracy" />);
    expect(screen.queryByText(/WPM:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Accuracy:/)).toBeInTheDocument();
  });

  it.each([
    ['WPM', /The bottom of this axis is 40, the lowest WPM on the chart, not 0/],
    ['Accuracy', /The bottom of this axis is 92%, the lowest accuracy on the chart, not 0%/],
  ])('names the %s axis above it, with a hint of what the bottom of the axis is', async (name, hint) => {
    const user = userEvent.setup();
    getMonthlyProgress.mockResolvedValue(
      answer([
        { key: '2026-01', avgWpm: 40.4, avgAccuracy: 92.2, carriedOver: false },
        { key: '2026-02', avgWpm: 55, avgAccuracy: 96, carriedOver: false },
      ]),
    );
    renderWithProviders(<ProfileMonthlyChart range="year" axes />);

    await user.hover(await screen.findByText(name));

    expect((await screen.findAllByText(hint))[0]).toBeInTheDocument();
  });

  it('has no axis names without axes, and only the one of the line that shows', async () => {
    getMonthlyProgress.mockResolvedValue(answer([{ key: '2026-01', avgWpm: 40, avgAccuracy: 95, carriedOver: false }]));
    const { unmount } = renderWithProviders(<ProfileMonthlyChart range="year" />);
    await screen.findByRole('img');
    expect(screen.queryByText('WPM')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ProfileMonthlyChart range="year" axes lines="wpm" />);
    expect(await screen.findByText('WPM')).toBeInTheDocument();
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });
});
