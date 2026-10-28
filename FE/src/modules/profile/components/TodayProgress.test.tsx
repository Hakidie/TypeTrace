import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Streak } from '../types/profile.types';
import { TodayProgress } from './TodayProgress';

const streak = (today: Partial<Streak['today']>) =>
  ({
    data: { current: 3, longest: 7, today: { date: '2026-10-27', sessions: 0, missionGoal: 1, missionCompleted: false, ...today } },
  }) as UseQueryResult<Streak>;

const todayRegion = () => screen.getByRole('region', { name: 'Today' });

describe('TodayProgress (SCRUM-31)', () => {
  it("shows today's counted sessions and the daily mission done", () => {
    renderWithProviders(<TodayProgress streak={streak({ sessions: 2, missionCompleted: true })} />);

    expect(todayRegion()).toHaveTextContent('TODAY 2 counted sessions');
    expect(within(todayRegion()).getByText('Daily mission done')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the mission still to do, with a link to practice on the Typing page', () => {
    renderWithProviders(<TodayProgress streak={streak({ sessions: 0, missionCompleted: false })} />);

    expect(todayRegion()).toHaveTextContent('TODAY 0 counted sessions');
    expect(todayRegion()).toHaveTextContent('Daily mission: 0 / 1 counted session · Practice now');
    expect(screen.queryByText('Daily mission done')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice now' })).toHaveAttribute('href', '/typing');
  });

  it('takes the goal of the mission from the backend', () => {
    renderWithProviders(<TodayProgress streak={streak({ sessions: 1, missionGoal: 3, missionCompleted: false })} />);

    expect(todayRegion()).toHaveTextContent(/TODAY 1 counted session(?!s)/);
    expect(todayRegion()).toHaveTextContent('Daily mission: 1 / 3 counted sessions');
  });

  it('shows the same line with dashes while it loads, so nothing moves when the numbers come', () => {
    renderWithProviders(<TodayProgress streak={{ data: undefined } as UseQueryResult<Streak>} />);

    expect(todayRegion()).toHaveAttribute('aria-busy', 'true');
    expect(todayRegion()).toHaveTextContent('TODAY — counted sessions');
    expect(todayRegion()).toHaveTextContent('Daily mission: — / — counted sessions · Practice now');
  });

  it('is no longer busy once the numbers are there', () => {
    renderWithProviders(<TodayProgress streak={streak({ sessions: 1, missionCompleted: true })} />);

    expect(todayRegion()).toHaveAttribute('aria-busy', 'false');
    expect(todayRegion()).not.toHaveTextContent('—');
  });

  it('says why it could not load, with a retry', async () => {
    const refetch = vi.fn();
    const failed = { isError: true, error: { response: { status: 500, data: { message: 'Database offline' } } }, refetch } as unknown as UseQueryResult<Streak>;
    renderWithProviders(<TodayProgress streak={failed} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Today's progress could not load. Database offline · Try again");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
