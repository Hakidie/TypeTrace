import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { TypingActivity } from '../types/profile.types';
import { ProfileHeatmap } from './ProfileHeatmap';

const today = new Date().toISOString().slice(0, 10);
const activity = (data?: TypingActivity) => ({ data }) as UseQueryResult<TypingActivity>;

describe('ProfileHeatmap (SCRUM-157)', () => {
  it('shows the sessions of each day of the last year', () => {
    renderWithProviders(<ProfileHeatmap activity={activity({ sessions: [{ date: today, sessions: 2 }] })} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByRole('img', { name: `Completed sessions in ${new Date().getUTCFullYear()}` })).toBeInTheDocument();
    expect(screen.getByTitle(`${today}: 2 sessions`)).toBeInTheDocument();
  });

  it('is the quarters of this year, with the months under each and the days to come with an upcoming tooltip', () => {
    renderWithProviders(<ProfileHeatmap activity={activity({ sessions: [] })} since="2020-01-01T00:00:00.000Z" />);

    const year = new Date().getUTCFullYear();
    ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'].forEach((months) => expect(screen.getByText(months)).toBeInTheDocument());
    expect(screen.getByTitle(`${year}-01-01: no activity`)).toBeInTheDocument();
    expect(screen.getByTitle(`${year}-12-31: ${new Date().toISOString().slice(0, 10) === `${year}-12-31` ? 'no activity' : 'upcoming'}`)).toBeInTheDocument();
  });

  it('keeps every column full: only the first and the last of the year have blanks', () => {
    const { container } = renderWithProviders(<ProfileHeatmap activity={activity({ sessions: [] })} since="2020-01-01T00:00:00.000Z" />);

    const blocks = Array.from(container.querySelectorAll('[role="img"] > div > div:first-child'));
    expect(blocks).toHaveLength(4);
    blocks.forEach((block) => expect(block.children.length % 7).toBe(0));
    const blanks = blocks.map((block) => Array.from(block.children).filter((cell) => !cell.hasAttribute('title')).length);
    expect(blanks[1] + blanks[2]).toBe(0);
    expect(blanks[0] + blanks[3]).toBeLessThanOrEqual(12);
  });

  it('shows empty cells while there is no activity data', () => {
    renderWithProviders(<ProfileHeatmap activity={activity()} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByTitle(`${today}: no data yet`)).toBeInTheDocument();
  });

  it('shows the error with a retry when the activity could not load', async () => {
    const refetch = vi.fn();
    const failed = { isError: true, error: { response: { status: 500, data: { message: 'Database offline' } } }, refetch } as unknown as UseQueryResult<TypingActivity>;
    renderWithProviders(<ProfileHeatmap activity={failed} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByText('Database offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('points a learner without a completed session to the Typing page', () => {
    const empty = { isSuccess: true, data: { sessions: [] } } as unknown as UseQueryResult<TypingActivity>;
    renderWithProviders(<ProfileHeatmap activity={empty} since="2026-01-15T12:00:00.000Z" />);

    expect(screen.getByText('No completed sessions yet.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice on the Typing page' })).toHaveAttribute('href', '/typing');
  });
});
