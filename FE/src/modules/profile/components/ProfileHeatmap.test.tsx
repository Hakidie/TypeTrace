import userEvent from '@testing-library/user-event';
import { fireEvent, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayInWords } from '@/shared/lib/local-date';
import { renderWithProviders } from '@/test/render-with-providers';
import type { TypingActivity } from '../types/profile.types';
import { ProfileHeatmap } from './ProfileHeatmap';

// The activity of these tests is in UTC, so today is the UTC day.
const today = new Date().toISOString().slice(0, 10);
const activity = (data?: TypingActivity) => ({ data }) as UseQueryResult<TypingActivity>;
const year = new Date().getUTCFullYear();

/** The cell of a day, and the tooltip shown when the mouse is over it. */
const cell = (date: string) => document.querySelector(`[data-date="${date}"]`) as HTMLElement;
const tooltipOf = (date: string) => {
  fireEvent.mouseOver(cell(date));
  return screen.getByRole('tooltip');
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ProfileHeatmap (SCRUM-157, SCRUM-31)', () => {
  it('shows the counted sessions of each day of this year in one tooltip, with the day in words', () => {
    renderWithProviders(
      <ProfileHeatmap activity={activity({ timezone: 'UTC', sessions: [{ date: today, sessions: 2, tasksTotal: 3, tasksDone: 2 }] })} since="2026-01-15T12:00:00.000Z" />,
    );

    const heatmap = screen.getByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, 2 daily tasks done` });
    expect(heatmap.querySelectorAll('[title]')).toHaveLength(0);
    const tooltip = tooltipOf(today);
    expect(tooltip).toHaveTextContent(`Today · ${dayInWords(today)}`);
    expect(tooltip).toHaveTextContent('2 counted sessions');
    expect(tooltip).toHaveTextContent('2 / 3 daily tasks done');
  });

  it('is the quarters of this year, with the months under each and the days to come as upcoming', () => {
    renderWithProviders(<ProfileHeatmap activity={activity({ timezone: 'UTC', sessions: [] })} since="2020-01-01T00:00:00.000Z" />);

    ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'].forEach((months) => expect(screen.getByText(months)).toBeInTheDocument());
    expect(tooltipOf(`${year}-01-01`)).toHaveTextContent(`${dayInWords(`${year}-01-01`)}No counted sessions`);
    expect(tooltipOf(`${year}-12-31`)).toHaveTextContent(today === `${year}-12-31` ? 'No counted sessions' : 'Upcoming');
  });

  it('keeps every column full: only the first and the last of the year have blanks', () => {
    const { container } = renderWithProviders(<ProfileHeatmap activity={activity({ timezone: 'UTC', sessions: [] })} since="2020-01-01T00:00:00.000Z" />);

    const blocks = Array.from(container.querySelectorAll('[role="img"] > div > div:first-child'));
    expect(blocks).toHaveLength(4);
    blocks.forEach((block) => expect(block.children.length % 7).toBe(0));
    const blanks = blocks.map((block) => Array.from(block.children).filter((day) => !day.hasAttribute('data-date')).length);
    expect(blanks[1] + blanks[2]).toBe(0);
    expect(blanks[0] + blanks[3]).toBeLessThanOrEqual(12);
  });

  it('draws no mark in the cells, and the tooltip of a day without tasks says nothing about them', () => {
    renderWithProviders(
      <ProfileHeatmap
        activity={activity({
          timezone: 'UTC',
          sessions: [
            { date: `${year}-01-01`, sessions: 1 },
            { date: today, sessions: 2, tasksTotal: 3, tasksDone: 1 },
          ],
        })}
        since="2020-01-01T00:00:00.000Z"
      />,
    );

    expect(document.querySelectorAll('[data-mission]')).toHaveLength(0);
    if (today !== `${year}-01-01`) expect(tooltipOf(`${year}-01-01`)).not.toHaveTextContent('daily tasks');
    expect(tooltipOf(today)).toHaveTextContent('1 / 3 daily tasks done');
    // The legend is in the title row of the page, not under the grid.
    expect(screen.queryByText('Less')).not.toBeInTheDocument();
  });

  it("counts the days in the learner's time zone", () => {
    // 18:00 UTC on 31 December is already 1 January in Ho Chi Minh City: the heatmap is the new year's.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T18:00:00Z'));
    renderWithProviders(
      <ProfileHeatmap
        activity={activity({ timezone: 'Asia/Ho_Chi_Minh', sessions: [{ date: '2027-01-01', sessions: 1, tasksTotal: 1, tasksDone: 1 }] })}
        since="2026-01-15T12:00:00.000Z"
      />,
    );

    expect(screen.getByRole('img', { name: 'Counted sessions in 2027: 1 on 1 day, 1 daily task done' })).toBeInTheDocument();
    expect(tooltipOf('2027-01-01')).toHaveTextContent('Today · Fri, 1 Jan 2027');
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 counted session');
    expect(tooltipOf('2027-01-02')).toHaveTextContent('Upcoming');
  });

  it('shows empty cells while there is no activity data', () => {
    renderWithProviders(<ProfileHeatmap activity={activity()} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByRole('img', { name: `Counted sessions in ${year}` })).toBeInTheDocument();
    expect(tooltipOf(today)).toHaveTextContent('No data yet');
    expect(screen.queryByText(/No counted sessions this year/)).not.toBeInTheDocument();
  });

  it('tells screen readers the year in words: sessions, days and daily tasks done', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T08:00:00Z'));
    const sessions = [
      { date: '2025-12-30', sessions: 9, tasksTotal: 3, tasksDone: 3 }, // last year: in the 371 days, not in the heatmap
      { date: '2026-03-02', sessions: 1, tasksTotal: 3, tasksDone: 0 },
      { date: '2026-03-03', sessions: 4, tasksTotal: 3, tasksDone: 2 },
      { date: '2026-10-27', sessions: 2 },
    ];
    renderWithProviders(<ProfileHeatmap activity={activity({ timezone: 'UTC', sessions })} since="2025-01-15T12:00:00.000Z" />);

    expect(screen.getByRole('img', { name: 'Counted sessions in 2026: 7 on 3 days, 2 daily tasks done' })).toBeInTheDocument();
  });

  it('shows the error with a retry when the activity could not load', async () => {
    const refetch = vi.fn();
    const failed = { isError: true, error: { response: { status: 500, data: { message: 'Database offline' } } }, refetch } as unknown as UseQueryResult<TypingActivity>;
    renderWithProviders(<ProfileHeatmap activity={failed} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByText('Database offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows only empty cells for a year without a counted session, with no message', () => {
    renderWithProviders(<ProfileHeatmap activity={activity({ timezone: 'UTC', sessions: [] })} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.queryByText(/No counted sessions this year/)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: `Counted sessions in ${year}: 0 on 0 days, 0 daily tasks done` })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
