import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProgressPage } from './ProgressPage';

const getMonthlyProgress = vi.fn();
const getDailyTasks = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getMonthlyProgress: (range: string, date?: string) => getMonthlyProgress(range, date), getDailyTasks: () => getDailyTasks() },
}));

// Today: Tuesday 10 March 2026 (the browser's UTC day: the test user has no time zone).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  getDailyTasks.mockReset().mockResolvedValue({
    date: '2026-03-10',
    tasks: [
      { id: 't1', title: 'Warm-up', description: '', type: 'sessions', target: 3, progress: 2, completed: false },
      { id: 't2', title: 'Phân biệt hỏi/ngã', description: 'Practise hỏi and ngã.', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION', progress: 92.5, completed: true },
    ],
  });
  getMonthlyProgress.mockReset().mockImplementation((range: string) =>
    Promise.resolve({ range, points: [{ key: '2026-02', avgWpm: null, avgAccuracy: null, carriedOver: false }] }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProgressPage (SCRUM-240)', () => {
  it('shows this year at first, with Year, Month and Week buttons on the right of the title', async () => {
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /WPM and accuracy by month/ })).toBeInTheDocument();
    expect(getMonthlyProgress).toHaveBeenCalledWith('year', '2026-03-10');
    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent('2026');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent('March');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveTextContent('Week 2');
  });

  it('opens the choices of each button and shows the one picked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await screen.findByRole('img');

    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['January', 'February', 'March']);
    await user.click(screen.getByRole('menuitemradio', { name: 'February' }));
    await waitFor(() => expect(getMonthlyProgress).toHaveBeenLastCalledWith('month', '2026-02-01'));
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent('February');
    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent('2026');

    await user.click(screen.getByRole('button', { name: 'Week' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Week 2' }));
    await waitFor(() => expect(getMonthlyProgress).toHaveBeenLastCalledWith('week', '2026-02-08'));
    expect(screen.getByRole('button', { name: 'Week' })).toHaveTextContent('Week 2');

    await user.click(screen.getByRole('button', { name: 'Year' }));
    await user.click(await screen.findByRole('menuitemradio', { name: '2025' }));
    await waitFor(() => expect(getMonthlyProgress).toHaveBeenLastCalledWith('year', '2025-02-08'));
  });

  it("shows today's daily tasks with their progress bars under the chart", async () => {
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    const tasks = await screen.findByRole('region', { name: 'Daily tasks' });
    expect(await within(tasks).findByRole('progressbar', { name: 'Warm-up' })).toHaveAttribute('aria-valuenow', '2');
    expect(within(tasks).getByText('2 / 3 sessions')).toBeInTheDocument();
    expect(within(tasks).getByText('Done')).toBeInTheDocument();
    expect(getDailyTasks).toHaveBeenCalledOnce();
    expect((await screen.findByRole('img', { name: /WPM and accuracy by/ })).compareDocumentPosition(tasks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
