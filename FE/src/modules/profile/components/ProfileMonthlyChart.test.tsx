import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { MonthlyProgressPoint } from '../types/profile.types';
import { shortMonth } from '../lib/month-label';
import { MonthlyChartTooltip, ProfileMonthlyChart } from './ProfileMonthlyChart';

const getMonthlyProgress = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getMonthlyProgress: () => getMonthlyProgress() },
}));

const MONTHS = [
  '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
];
const noData = (): MonthlyProgressPoint[] => MONTHS.map((month) => ({ month, avgWpm: null, totalErrors: null, carriedOver: false }));

beforeEach(() => {
  getMonthlyProgress.mockReset();
});

describe('ProfileMonthlyChart (SCRUM-240)', () => {
  it('shows a placeholder while the data loads', () => {
    getMonthlyProgress.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ProfileMonthlyChart />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the chart and its legend when there is data', async () => {
    const months = noData();
    months[10] = { month: '2026-01', avgWpm: 42.5, totalErrors: 7, carriedOver: false };
    months[11] = { month: '2026-02', avgWpm: 42.5, totalErrors: 7, carriedOver: true };
    getMonthlyProgress.mockResolvedValue({ months });
    renderWithProviders(<ProfileMonthlyChart />);

    expect(await screen.findByRole('img', { name: 'Biểu đồ WPM và số lỗi theo 12 tháng' })).toBeInTheDocument();
    expect(screen.getByText('WPM')).toBeInTheDocument();
    expect(screen.getByText('Số lỗi')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có dữ liệu')).not.toBeInTheDocument();
  });

  it('still shows the chart, with "Chưa có dữ liệu" over it, when there is no data', async () => {
    getMonthlyProgress.mockResolvedValue({ months: noData() });
    renderWithProviders(<ProfileMonthlyChart />);

    expect(await screen.findByRole('img', { name: 'Biểu đồ WPM và số lỗi theo 12 tháng, chưa có dữ liệu' })).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('WPM')).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    getMonthlyProgress.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ months: noData() });
    renderWithProviders(<ProfileMonthlyChart />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the monthly chart');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('img', { name: /chưa có dữ liệu/ })).toBeInTheDocument();
  });
});

describe('MonthlyChartTooltip', () => {
  it('shows the figures of a month with sessions', () => {
    render(<MonthlyChartTooltip point={{ month: '2026-01', avgWpm: 42.5, totalErrors: 7, carriedOver: false }} />);

    expect(screen.getByText('01/2026')).toBeInTheDocument();
    expect(screen.getByText(/WPM:/).closest('p')).toHaveTextContent('WPM: 42.5');
    expect(screen.getByText(/Số lỗi:/).closest('p')).toHaveTextContent('Số lỗi: 7');
    expect(screen.queryByText(/giữ số liệu tháng trước/)).not.toBeInTheDocument();
  });

  it('says so when the figures are the ones of the month before', () => {
    render(<MonthlyChartTooltip point={{ month: '2026-02', avgWpm: 42.5, totalErrors: 7, carriedOver: true }} />);

    expect(screen.getByText('Không có phiên, giữ số liệu tháng trước')).toBeInTheDocument();
  });

  it('says there is no data for a month before the first placement', () => {
    render(<MonthlyChartTooltip point={{ month: '2025-03', avgWpm: null, totalErrors: null, carriedOver: false }} />);

    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
  });
});

describe('shortMonth', () => {
  it('writes a month as MM/YY', () => {
    expect(shortMonth('2025-03')).toBe('03/25');
    expect(shortMonth('2026-12')).toBe('12/26');
  });
});
