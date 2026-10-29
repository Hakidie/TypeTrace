import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { DailyDayResult } from '../types/daily.types';
import { DailyProgress } from './DailyProgress';

const history = vi.fn();

vi.mock('../api/daily.api', () => ({ dailyApi: { history: () => history() } }));

const empty = (date: string): DailyDayResult => ({ date, score: null, wpm: null, accuracy: null });
const played = (date: string, wpm: number, accuracy: number): DailyDayResult => ({ date, score: Math.round((wpm * accuracy) / 100), wpm, accuracy });

describe('DailyProgress', () => {
  beforeEach(() => history.mockReset());

  it('shows the change against the previous daily', async () => {
    history.mockResolvedValue([played('2026-10-26', 58, 97), empty('2026-10-27'), played('2026-10-28', 62, 96.4), played('2026-10-29', 66, 95.2)]);
    renderWithProviders(<DailyProgress />);

    expect(await screen.findByText('+4 vs 28 Oct')).toBeInTheDocument();
    expect(screen.getByText('-1.2 vs 28 Oct')).toBeInTheDocument();
    expect(screen.getByLabelText('WPM, last daily')).toHaveTextContent('66');
    expect(screen.getByLabelText('Accuracy, last daily')).toHaveTextContent('95.2%');
  });

  it('compares with the last day played, skipping the days without a try', async () => {
    history.mockResolvedValue([played('2026-10-27', 50, 90), empty('2026-10-28'), played('2026-10-29', 55, 92)]);
    renderWithProviders(<DailyProgress />);

    expect(await screen.findByText('+5 vs 27 Oct')).toBeInTheDocument();
  });

  it('says there is nothing to compare yet after a first daily', async () => {
    history.mockResolvedValue([empty('2026-10-28'), played('2026-10-29', 40, 100)]);
    renderWithProviders(<DailyProgress />);

    expect(await screen.findByText('Come back tomorrow to see your progress')).toBeInTheDocument();
  });

  it('lists each day played in a table for screen readers', async () => {
    history.mockResolvedValue([played('2026-10-28', 62, 96.4), empty('2026-10-29')]);
    renderWithProviders(<DailyProgress />);

    const table = await screen.findByRole('table', { name: 'Daily results' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('28 Oct');
    expect(rows[1]).toHaveTextContent('62');
    expect(rows[1]).toHaveTextContent('96.4%');
  });

  it('invites to play when there is no daily yet', async () => {
    history.mockResolvedValue([empty('2026-10-28'), empty('2026-10-29')]);
    renderWithProviders(<DailyProgress />);

    expect(await screen.findByText('No daily tries yet')).toBeInTheDocument();
  });
});
