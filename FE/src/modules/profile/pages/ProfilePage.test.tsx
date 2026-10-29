import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProfilePage } from './ProfilePage';

const getMe = vi.fn();
const getActivity = vi.fn();
const getSessions = vi.fn();
const getStreak = vi.fn();
const getDailyTasks = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: {
    getActivity: () => getActivity(),
    getSessions: (params: unknown) => getSessions(params),
    getStreak: () => getStreak(),
    getDailyTasks: () => getDailyTasks(),
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

const session = (overrides = {}) => ({
  _id: 's1',
  mode: 'practice',
  passageTitle: 'Tiếng Việt rất đẹp',
  status: 'completed',
  wpm: 41.6,
  accuracy: 97.2,
  durationMs: 30000,
  timeLimitSeconds: 30,
  isCounted: true,
  timeline: { status: 'ok', points: [{ second: 1, wpm: 30, errors: 0 }, { second: 2, wpm: 45, errors: 1 }] },
  startedAt: '2026-03-02T10:00:00.000Z',
  completedAt: '2026-03-02T10:00:35.000Z',
  createdAt: '2026-03-02T10:00:00.000Z',
  ...overrides,
});
const page = (items: unknown[], overrides = {}) => ({ items, page: 1, limit: 3, total: items.length, totalPages: 1, ...overrides });

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
/** Today's counted sessions and daily mission, over the heatmap. */
const todayRegion = () => screen.getByRole('region', { name: 'Today' });
const year = new Date().getUTCFullYear();
const hoverDay = (date: string) => fireEvent.mouseOver(document.querySelector(`[data-date="${date}"]`) as HTMLElement);

beforeEach(() => {
  tokenStore.set('jwt-value');
  getMe.mockReset().mockResolvedValue(profile);
  getSessions.mockReset().mockResolvedValue(page([session()]));
  getActivity.mockReset().mockResolvedValue({
    stats: { wpm: 66.3, accuracy: 96.3 },
    timezone: 'UTC',
    sessions: [{ date: today, sessions: 2, missionCompleted: true }],
  });
  getStreak.mockReset().mockResolvedValue(streakOf(1, 4, { sessions: 2, missionCompleted: true }));
  getDailyTasks.mockReset().mockResolvedValue({
    date: today,
    tasks: [
      { id: 't1', title: 'Warm-up', description: '', type: 'sessions', target: 3, progress: 2, completed: false },
      { id: 't2', title: 'Phân biệt hỏi/ngã', description: '', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION', progress: 92.5, completed: true },
    ],
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

  it('has the header, today and the heatmap, and no Profile, Edit profile or Security panel (Security is on the Settings page)', async () => {
    renderPage();

    expect(await screen.findByRole('region', { name: 'Profile header' })).toBeInTheDocument();
    // Screen readers get the year in words.
    expect(await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, daily mission done on 1 day` })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Email code at login' })).not.toBeInTheDocument();
  });

  it('shows who the learner is and how they type: speed, accuracy, current and longest streak and the sessions of the year', async () => {
    renderPage();
    await within(await screen.findByRole('region', { name: 'Profile header' })).findByText('96%');

    const card = header();
    expect(within(card).getByText('Alice')).toBeInTheDocument();
    expect(within(card).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveValue('Hello');
    expect(await within(card).findByText('001D')).toBeInTheDocument();
    expect(within(card).getByTitle('Longest streak')).toHaveTextContent('BEST 004D');
    expect(within(card).getByText('66')).toBeInTheDocument();
    expect(within(card).getByText('Joined 15 Jan 2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
    hoverDay(today);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 counted sessions');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mission done');
    expect(getMe).toHaveBeenCalledOnce();
  });

  it("shows today's counted sessions and the daily mission done next to the heatmap", async () => {
    renderPage();

    expect(await screen.findByRole('region', { name: 'Today' })).toHaveTextContent('TODAY 2 counted sessions');
    expect(within(todayRegion()).getByText('Daily mission done')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Practice now' })).not.toBeInTheDocument();
  });

  it("shows today's tasks with their progress bars under the heatmap, above the sessions", async () => {
    renderPage();

    const tasks = await screen.findByRole('region', { name: 'Daily tasks' });
    expect(await within(tasks).findByRole('progressbar', { name: 'Warm-up' })).toHaveAttribute('aria-valuenow', '2');
    expect(within(tasks).getByText('2 / 3 sessions')).toBeInTheDocument();
    expect(within(tasks).getByText('Reach 90% accuracy on hỏi and ngã in a session with at least 5 words with hỏi or ngã')).toBeInTheDocument();
    expect(within(tasks).getByText('Done')).toBeInTheDocument();
    expect(getDailyTasks).toHaveBeenCalledOnce();

    const heatmap = await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, daily mission done on 1 day` });
    expect(heatmap.compareDocumentPosition(tasks)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tasks.compareDocumentPosition(screen.getByRole('region', { name: 'My sessions' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows zeros and a way to start to a new learner, and asks for a display name instead of the email twice', async () => {
    getMe.mockResolvedValue({ ...profile, displayName: undefined, bio: undefined });
    getActivity.mockResolvedValue({ timezone: 'UTC', sessions: [] });
    getStreak.mockResolvedValue(streakOf(0, 0, { sessions: 0, missionCompleted: false }));
    getSessions.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('No counted sessions this year: your practice days show here.')).toBeInTheDocument();
    const card = header();
    expect(await within(card).findAllByText('000D')).toHaveLength(2);
    expect(within(card).getByText('000%')).toBeInTheDocument();
    expect(within(card).getByText('0000')).toBeInTheDocument();
    // One way to start, in the line of today: the heatmap does not add a second link for the same thing.
    expect(todayRegion()).toHaveTextContent('Daily mission: 0 / 1 counted session · Practice now');
    expect(within(todayRegion()).getByRole('link', { name: 'Practice now' })).toHaveAttribute('href', '/typing');
    expect(screen.getAllByRole('link', { name: /practice/i })).toHaveLength(1);
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

    expect(await screen.findByRole('img', { name: `Counted sessions in ${year}: 2 on 1 day, daily mission done on 1 day` })).toBeInTheDocument();
    expect(screen.queryByText('Database offline')).not.toBeInTheDocument();
  });

  it('lists the finished sessions as cards under the heatmap, each one linking to its result page', async () => {
    getSessions.mockResolvedValue(
      page([session(), session({ _id: 's2', passageTitle: undefined, mode: 'placement', timeLimitSeconds: 120, isCounted: false, wpm: 20, accuracy: 80, timeline: { status: 'no_data', points: [] } })]),
    );
    renderPage();

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Tiếng Việt rất đẹp')).toBeInTheDocument();
    expect(within(cards[0]).getByText('42')).toBeInTheDocument();
    expect(within(cards[0]).getByText('97.2%')).toBeInTheDocument();
    expect(within(cards[0]).getByText('02 Mar 2026')).toBeInTheDocument();
    expect(within(cards[0]).getByText('30s')).toBeInTheDocument();
    expect(within(cards[0]).queryByText('Practice', { exact: false })).not.toBeInTheDocument(); // the mode is only the icon
    expect(within(cards[0]).getByRole('img', { name: 'Speed and errors over time' })).toBeInTheDocument();
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(getSessions).toHaveBeenCalledWith({ page: 1, limit: 3, sort: '-createdAt', status: 'completed' });

    expect(within(cards[1]).getByText('Untitled passage')).toBeInTheDocument();
    expect(within(cards[1]).getByText('02 Mar 2026')).toBeInTheDocument();
    expect(within(cards[1]).getByText('2m')).toBeInTheDocument();
    expect(screen.queryByText('Not counted')).not.toBeInTheDocument(); // an uncounted session looks like the others
    expect(within(cards[1]).getByText('No time data for this session')).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('img', { name: 'Speed and errors over time' })).not.toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /Open the result of/ });
    expect(links[0]).toHaveAttribute('href', '/typing/result/s1');
    expect(links[1]).toHaveAttribute('href', '/typing/result/s2');
  });

  it('sorts the sessions and goes to the next page', async () => {
    getSessions.mockResolvedValue(page([session()], { total: 8, totalPages: 2 }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 2, limit: 3, sort: '-createdAt', status: 'completed' }));

    await user.click(screen.getByRole('button', { name: /Sort/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Fastest' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 3, sort: '-wpm', status: 'completed' }));
  });

  it('searches the sessions by passage name and filters them by mode and time', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('article');

    await user.type(screen.getByLabelText('Search sessions'), 'thu{Enter}');
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 3, sort: '-createdAt', status: 'completed', q: 'thu' }));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(within(await screen.findByRole('group', { name: 'Mode' })).getByRole('menuitemradio', { name: 'Placement' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'thu', mode: 'placement' })));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(within(await screen.findByRole('group', { name: 'Time' })).getByRole('menuitemradio', { name: '2m' }));
    await waitFor(() =>
      expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 3, sort: '-createdAt', status: 'completed', q: 'thu', mode: 'placement', timeLimitSeconds: 120 }),
    );
  });

  it('says that nothing matches, not that there is no session, when a search or filter finds none', async () => {
    getSessions.mockResolvedValue(page([]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search sessions'), 'zzz{Enter}');
    expect(await screen.findByText('No matching sessions')).toBeInTheDocument();
  });

  it('says so when there is no session yet, and shows an error with a retry when the list cannot load', async () => {
    getSessions.mockResolvedValueOnce(page([]));
    const first = renderPage();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
    first.unmount();

    getSessions.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Sessions offline' } } });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Sessions offline')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Profile header' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  it('shows dashes in the header and in the line of today while the streak loads', async () => {
    getStreak.mockReturnValue(new Promise(() => undefined));
    renderPage();

    const card = await screen.findByRole('region', { name: 'Profile header' });
    expect(within(card).getAllByText('—')).toHaveLength(2);
    expect(todayRegion()).toHaveAttribute('aria-busy', 'true');
    expect(todayRegion()).toHaveTextContent('TODAY — counted sessions');
  });

  it('shows dashes and why the streak could not load, with a retry that brings it', async () => {
    getStreak.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Streak offline' } } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent("Today's progress could not load. Streak offline");
    expect(within(header()).getAllByText('—')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await within(header()).findByText('001D')).toBeInTheDocument();
    expect(todayRegion()).toHaveTextContent('Daily mission done');
    expect(screen.queryByText('Streak offline', { exact: false })).not.toBeInTheDocument();
  });

  it("draws the heatmap in the learner's time zone", async () => {
    // 18:00 UTC on 10 March is already the 11th in Ho Chi Minh City: that day is today, with its session.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T18:00:00Z'));
    getActivity.mockResolvedValue({
      stats: { wpm: 66.3, accuracy: 96.3 },
      timezone: 'Asia/Ho_Chi_Minh',
      sessions: [{ date: '2026-03-11', sessions: 2, missionCompleted: true }],
    });
    renderPage();

    await within(await screen.findByRole('region', { name: 'Profile header' })).findByText('96%');
    expect(screen.getByRole('img', { name: 'Counted sessions in 2026: 2 on 1 day, daily mission done on 1 day' })).toBeInTheDocument();
    hoverDay('2026-03-11');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Today · Wed, 11 Mar 2026');
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 counted sessions');
    hoverDay('2026-03-12');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Upcoming');
  });
});
