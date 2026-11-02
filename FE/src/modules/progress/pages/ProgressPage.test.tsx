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
  it('shows the month before this one at first, with Week, Month and Year buttons on the right of the title', async () => {
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /WPM and accuracy by week/ })).toBeInTheDocument();
    expect(getMonthlyProgress).toHaveBeenCalledWith('month', '2026-02-01'); // today is 10 March
    expect(screen.getAllByRole('button').slice(0, 3).map((button) => button.getAttribute('aria-label'))).toEqual(['Week', 'Month', 'Year']);
    expect(screen.getByRole('button', { name: 'Lines' })).toHaveTextContent('All lines');
    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent('2026');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent('February');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveTextContent('Week 1');
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

  it('adds weeks, months and years to the chart with the +, each as a tag that can be taken away', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await screen.findByRole('img');
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();

    // On a month only a month and a year can be added, never a week. Each row says what it is set to (this year, this month) and opens a second menu beside it.
    await user.click(screen.getByRole('button', { name: 'Add comparison' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['MonthMarch', 'Year2026']);
    await user.click(screen.getByRole('menuitem', { name: 'Month' }));
    const months = await screen.findByRole('menu', { name: 'Month periods' });
    expect(within(months).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['January', 'February', 'March']); // the months so far of 2026
    await user.click(within(months).getByRole('menuitemradio', { name: 'February' }));
    expect(await screen.findByText('February 2026')).toBeInTheDocument();
    await waitFor(() => expect(getMonthlyProgress).toHaveBeenCalledWith('month', '2026-02-01'));
    expect(await screen.findByRole('img', { name: /with other periods/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove February 2026' }));
    expect(screen.queryByText('February 2026')).not.toBeInTheDocument();

    // On a week the menu has all three; the weeks are the ones of the month the menu is set to.
    await user.click(screen.getByRole('button', { name: 'Week' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Week 2' }));
    await user.click(screen.getByRole('button', { name: 'Add comparison' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('aria-label'))).toEqual(['Week', 'Month', 'Year']);
    await user.click(screen.getByRole('menuitem', { name: 'Week' }));
    await user.click(within(await screen.findByRole('menu', { name: 'Week periods' })).getByRole('menuitemradio', { name: 'Week 1' }));
    expect(await screen.findByText('Week 1 February 2026')).toBeInTheDocument(); // the menu was set to February by the pick before
    await waitFor(() => expect(getMonthlyProgress).toHaveBeenCalledWith('week', '2026-02-01'));

    // Picking a year sets the year of the Month row: all its months.
    await user.click(screen.getByRole('button', { name: 'Add comparison' }));
    await user.click(screen.getByRole('menuitem', { name: 'Year' }));
    await user.click(within(await screen.findByRole('menu', { name: 'Year periods' })).getByRole('menuitemradio', { name: '2024' }));
    expect(await screen.findByText('2024')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add comparison' }));
    expect(screen.getByRole('menuitem', { name: 'Year' })).toHaveTextContent('2024');
    await user.click(screen.getByRole('menuitem', { name: 'Month' }));
    expect(within(await screen.findByRole('menu', { name: 'Month periods' })).getAllByRole('menuitemradio')).toHaveLength(12); // January to December 2024

    await user.click(screen.getByRole('button', { name: 'Remove Week 1 February 2026' }));
    expect(screen.queryByText('Week 1 February 2026')).not.toBeInTheDocument();
  });

  it('has a last button that switches between all lines, only the WPM and only the accuracy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await screen.findByRole('img');
    // Under the chart: the + Add comparison (and the tags) at the left, Lines at the right.
    const chart = screen.getByRole('img', { name: /WPM and accuracy by/ });
    const add = screen.getByRole('button', { name: 'Add comparison' });
    const linesButton = screen.getByRole('button', { name: 'Lines' });
    expect(chart.compareDocumentPosition(linesButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(add.compareDocumentPosition(linesButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(add).toHaveTextContent('Add comparison');
    expect(screen.getByRole('button', { name: 'Year' }).compareDocumentPosition(chart)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(screen.getByRole('button', { name: 'Lines' }));
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['All lines', 'WPM only', 'Accuracy only']);
    await user.click(screen.getByRole('menuitemradio', { name: 'WPM only' }));
    expect(screen.getByRole('button', { name: 'Lines' })).toHaveTextContent('WPM only');

    await user.click(screen.getByRole('button', { name: 'Lines' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Accuracy only' }));
    expect(screen.getByRole('button', { name: 'Lines' })).toHaveTextContent('Accuracy only');
  });

  it('turns the + off after three time ranges', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await screen.findByRole('img');

    for (const year of ['2022', '2023', '2024']) {
      await user.click(screen.getByRole('button', { name: 'Add comparison' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Year' }));
      await user.click(within(await screen.findByRole('menu', { name: 'Year periods' })).getByRole('menuitemradio', { name: year }));
    }

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add comparison' })).toBeDisabled());
  });
});
