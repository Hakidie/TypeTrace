import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProfilePage } from './ProfilePage';

const getMe = vi.fn();
const getActivity = vi.fn();
const getStreak = vi.fn();
const getMonthlyProgress = vi.fn();
const getDailyTasks = vi.fn();
const getErrorProfile = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: {
    getActivity: () => getActivity(),
    getStreak: () => getStreak(),
    getMonthlyProgress: (range: string) => getMonthlyProgress(range),
    getDailyTasks: () => getDailyTasks(),
    getErrorProfile: () => getErrorProfile(),
    updateSecurity: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

const profile = {
  _id: 'user-1',
  email: 'alice@example.com',
  role: 'user',
  isEmailVerified: true,
  loginOtpEnabled: false,
  displayName: 'Alice',
  bio: 'Hello',
  phone: '0123456789',
  settings: { timezone: 'UTC' },
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

// The activity of these tests is in UTC (unless a test says otherwise), so today is the UTC day.
const today = new Date().toISOString().slice(0, 10);

const streakOf = (current: number, longest: number, today: { sessions: number; missionCompleted: boolean }) => ({
  current,
  longest,
  today: { date: new Date().toISOString().slice(0, 10), missionGoal: 1, ...today },
});

const renderPage = () => renderWithProviders(<ProfilePage />, { route: '/profile' });

/** The top of the page: who the learner is and how they type. */
const header = () => screen.getByRole('region', { name: 'Profile header' });
const year = new Date().getUTCFullYear();
const hoverDay = (date: string) => fireEvent.mouseOver(document.querySelector(`[data-date="${date}"]`) as HTMLElement);

beforeEach(() => {
  tokenStore.set('jwt-value');
  getMe.mockReset().mockResolvedValue(profile);
  getActivity.mockReset().mockResolvedValue({
    stats: { wpm: 66.3, accuracy: 96.3 },
    timezone: 'UTC',
    sessions: [{ date: today, sessions: 2, tasksTotal: 2, tasksDone: 1 }],
  });
  getStreak.mockReset().mockResolvedValue(streakOf(1, 4, { sessions: 2, missionCompleted: true }));
  getMonthlyProgress.mockReset().mockImplementation((range: string) =>
    Promise.resolve({
      range,
      points: Array.from({ length: 12 }, (_, i) => ({ key: `2025-${String(i + 1).padStart(2, '0')}`, avgWpm: null, avgAccuracy: null, carriedOver: false })),
    }),
  );
  getDailyTasks.mockReset().mockResolvedValue({
    date: '2026-03-10',
    tasks: [{ id: 't1', title: 'Warm-up', description: '', type: 'sessions', target: 3, progress: 2, completed: false }],
  });
  getErrorProfile.mockReset().mockResolvedValue({
    window: 10,
    minOpportunities: 20,
    weakRate: 15,
    sessionsUsed: 10,
    types: (['BASE_LETTER', 'D_MISSING', 'MARK_WRONG', 'TONE_WRONG', 'HOI_NGA_CONFUSION'] as const).map((type) => ({
      type,
      errors: type === 'HOI_NGA_CONFUSION' ? 8 : 1,
      opportunities: 40,
      rate: type === 'HOI_NGA_CONFUSION' ? 20 : 2.5,
      level: type === 'HOI_NGA_CONFUSION' ? 'weak' : 'ok',
      previousRate: 30,
      trend: 'improved',
    })),
    weakTypes: ['HOI_NGA_CONFUSION'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProfilePage (SCRUM-157, SCRUM-31, SCRUM-112)', () => {
  it('shows loading placeholders until the account is known', () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Profile header' })).not.toBeInTheDocument();
  });

  it('puts the monthly chart in the header, under the name and the bio (SCRUM-240)', async () => {
    renderPage();

    const chart = await within(await screen.findByRole('region', { name: 'Profile header' })).findByRole('img', { name: /WPM and accuracy by/ });
    const name = screen.getByText('Alice');
    const bio = screen.getByRole('textbox', { name: 'Description' });

    expect(name.compareDocumentPosition(bio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bio.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the chart of the last 7 days in the header, without a switch of the range (SCRUM-240)', async () => {
    renderPage();
    const header = await screen.findByRole('region', { name: 'Profile header' });

    expect(await within(header).findByRole('img', { name: /WPM and accuracy by/ })).toBeInTheDocument();
    expect(getMonthlyProgress).toHaveBeenCalledWith('week');
    expect(getMonthlyProgress).not.toHaveBeenCalledWith('year');
    expect(within(header).queryByRole('radiogroup', { name: 'Chart range' })).not.toBeInTheDocument();
  });

  it('has the header, the daily progress and the heatmap, and no Profile, Edit profile or Security panel (Security is on the Settings page)', async () => {
    renderPage();

    expect(await screen.findByRole('region', { name: 'Profile header' })).toBeInTheDocument();
    // Screen readers get the year in words.
    expect(await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, 1 daily task done` })).toBeInTheDocument();
    // The mission is done in these fixtures, so there is no line of today.
    expect(screen.queryByRole('region', { name: 'Today' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Daily Progress', 'Daily tasks']);
    expect(screen.queryByRole('switch', { name: 'Email code at login' })).not.toBeInTheDocument();
  });

  it('shows who the learner is and how they type: speed, accuracy, current and longest streak and the sessions of the year', async () => {
    renderPage();
    await within(await screen.findByRole('region', { name: 'Profile header' })).findByText('96%');

    const card = header();
    expect(within(card).getByText('Alice')).toBeInTheDocument();
    expect(within(card).queryByText('alice@example.com')).not.toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveValue('Hello');
    expect(await within(card).findByText('001D')).toBeInTheDocument();
    expect(within(card).queryByText(/BEST/)).not.toBeInTheDocument();
    expect(within(card).getByText('66')).toBeInTheDocument();
    expect(within(card).getByText('Joined 15 Jan 2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Use a picture' })).toBeInTheDocument();
    hoverDay(today);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 counted sessions');
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 / 2 daily tasks done');
    expect(getMe).toHaveBeenCalledOnce();
  });

  it('has no TODAY or daily mission line, shows the legend in the title row, and the daily tasks under the heatmap', async () => {
    renderPage();

    const title = await screen.findByRole('heading', { name: 'Daily Progress' });
    expect(screen.queryByText('TODAY')).not.toBeInTheDocument();
    // The legend is on the right of the title.
    expect(within(title.parentElement?.parentElement as HTMLElement).getByText('Less')).toBeInTheDocument();
    expect(screen.queryByText('Daily mission done')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Daily tasks' })).toBeInTheDocument();
  });

  it('shows the daily tasks under the heatmap', async () => {
    renderPage();

    const heatmap = await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, 1 daily task done` });
    const tasks = screen.getByRole('region', { name: 'Daily tasks' });
    expect(await within(tasks).findByRole('progressbar', { name: 'Warm-up' })).toHaveAttribute('aria-valuenow', '2');
    expect(heatmap.compareDocumentPosition(tasks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(getDailyTasks).toHaveBeenCalledOnce();
    expect(getErrorProfile).not.toHaveBeenCalled();
  });

  it('switches between the daily tasks and the error profile with the button next to the title', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Switch to Error profile' }));
    const errorProfile = await screen.findByRole('region', { name: 'Error profile' });
    expect(screen.queryByRole('region', { name: 'Daily tasks' })).not.toBeInTheDocument();
    expect(await within(errorProfile).findAllByRole('listitem')).toHaveLength(5);
    expect(within(errorProfile).getByText('Weak')).toBeInTheDocument();

    await user.click(within(errorProfile).getByRole('button', { name: 'Switch to Daily tasks' }));
    expect(await screen.findByRole('region', { name: 'Daily tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Error profile' })).not.toBeInTheDocument();
  });

  it('shows zeros to a new learner, and asks for a display name instead of the email twice', async () => {
    getMe.mockResolvedValue({ ...profile, displayName: undefined, bio: undefined });
    getActivity.mockResolvedValue({ timezone: 'UTC', sessions: [] });
    getStreak.mockResolvedValue(streakOf(0, 0, { sessions: 0, missionCompleted: false }));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Profile header' });
    expect(await within(card).findByText('000D')).toBeInTheDocument();
    expect(within(card).getByText('000%')).toBeInTheDocument();
    expect(within(card).getByText('0000')).toBeInTheDocument();
    // No line about the day's mission and no message about an empty year: the heatmap shows empty cells.
    expect(screen.queryByText(/Daily mission/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No counted sessions this year/)).not.toBeInTheDocument();
    expect(await screen.findByRole('img', { name: `Counted sessions in ${year}: 0 on 0 days, 0 daily tasks done` })).toBeInTheDocument();
    expect(within(card).getAllByText('alice@example.com')).toHaveLength(1);
    expect(within(card).getByText('No display name yet: hover the name to add one.')).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveAttribute('placeholder', 'No description');
  });

  it('shows why the activity could not load, with a retry, and the header still works', async () => {
    getActivity.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database offline' } } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit display name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, 1 daily task done` })).toBeInTheDocument();
    expect(screen.queryByText('Database offline')).not.toBeInTheDocument();
  });

  it('shows a dash in the header while the streak loads', async () => {
    getStreak.mockReturnValue(new Promise(() => undefined));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Profile header' });
    expect(within(card).getAllByText('—')).toHaveLength(1);
  });

  it('shows a dash in the header when the streak could not load', async () => {
    getStreak.mockRejectedValue({ response: { status: 500, data: { message: 'Streak offline' } } });
    renderPage();

    await waitFor(() => expect(getStreak).toHaveBeenCalled());
    expect(within(await screen.findByRole('region', { name: 'Profile header' })).getAllByText('—')).toHaveLength(1);
    expect(screen.queryByText('Streak offline', { exact: false })).not.toBeInTheDocument();
  });

  it("draws the heatmap in the learner's time zone", async () => {
    // 18:00 UTC on 10 March is already the 11th in Ho Chi Minh City: that day is today, with its session.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T18:00:00Z'));
    getActivity.mockResolvedValue({
      stats: { wpm: 66.3, accuracy: 96.3 },
      timezone: 'Asia/Ho_Chi_Minh',
      sessions: [{ date: '2026-03-11', sessions: 2, tasksTotal: 1, tasksDone: 1 }],
    });
    renderPage();

    await within(await screen.findByRole('region', { name: 'Profile header' })).findByText('96%');
    expect(screen.getByRole('img', { name: 'Counted sessions in 2026: 2 on 1 day, 1 daily task done' })).toBeInTheDocument();
    hoverDay('2026-03-11');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Today · Wed, 11 Mar 2026');
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 counted sessions');
    hoverDay('2026-03-12');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Upcoming');
  });
});
