import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProgressPage } from './ProgressPage';

const getMonthlyProgress = vi.fn();
const getErrorProfile = vi.fn();
const getSessions = vi.fn();
const getVowelTone = vi.fn();
const getErrorTrend = vi.fn();

vi.mock('../api/progress.api', () => ({ progressApi: { getVowelTone: () => getVowelTone(), getErrorTrend: (range: string, language: string, date?: string) => getErrorTrend(range, language, date) } }));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getMonthlyProgress: (range: string, date?: string) => getMonthlyProgress(range, date), getErrorProfile: () => getErrorProfile(), getSessions: (params: unknown) => getSessions(params) },
}));

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

/** The page with My Sessions shown: the error profile is under the chart at first, and its switch button shows the sessions. */
const renderSessions = async () => {
  const view = renderWithProviders(<ProgressPage />, { route: '/progress' });
  const region = await screen.findByRole('region', { name: 'Error profile' });
  await within(region).findAllByRole('listitem');
  await userEvent.setup().click(within(region).getByRole('button', { name: 'Switch to My Sessions' }));
  return view;
};

// Today: Tuesday 10 March 2026 (the browser's UTC day: the test user has no time zone).
beforeEach(() => {
  getErrorTrend.mockReset().mockImplementation((range: string, language: string) =>
    Promise.resolve({
      range,
      language,
      types: language === 'en' ? ['LETTER_WRONG', 'LETTER_MISSING', 'LETTER_EXTRA', 'LETTERS_SWAPPED', 'CASE_WRONG', 'PUNCTUATION_WRONG'] : ['BASE_LETTER', 'D_MISSING', 'MARK_WRONG', 'TONE_WRONG', 'HOI_NGA_CONFUSION'],
      points: [{ key: '2026-03-01', rates: { BASE_LETTER: 5, TONE_WRONG: 12 } }],
    }),
  );
  getVowelTone.mockReset().mockResolvedValue({ language: 'vi', window: 10, minSeen: 5, sessionsUsed: 0, cells: [] });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  getSessions.mockReset().mockResolvedValue(page([session()]));
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
    expect(screen.getAllByRole('button').slice(1, 4).map((button) => button.getAttribute('aria-label'))).toEqual(['Week', 'Month', 'Year']);
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

  it('shows the error profile under the chart and switches to My Sessions and back with the title (SCRUM-27)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    const errorProfile = await screen.findByRole('region', { name: 'Error profile' });
    expect(screen.queryByRole('region', { name: 'My sessions' })).not.toBeInTheDocument();
    expect(getSessions).not.toHaveBeenCalled();
    expect(await within(errorProfile).findAllByRole('listitem')).toHaveLength(5);
    expect(within(errorProfile).getByText('Weak')).toBeInTheDocument();
    expect((await screen.findByRole('img', { name: /WPM and accuracy by/ })).compareDocumentPosition(errorProfile)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(within(errorProfile).getByRole('button', { name: 'Switch to My Sessions' }));
    expect(await screen.findByRole('region', { name: 'My sessions' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Error profile' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to Error profile' }));
    expect(await screen.findByRole('region', { name: 'Error profile' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'My sessions' })).not.toBeInTheDocument();
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

  it('lists the finished sessions as cards under the error profile, each one linking to its result page', async () => {
    getSessions.mockResolvedValue(
      page([
        session(),
        session({ _id: 's2', passageTitle: undefined, mode: 'placement', timeLimitSeconds: 120, isCounted: false, wpm: 20, accuracy: 80, timeline: { status: 'no_data', points: [] } }),
        session({ _id: 's3', passageTitle: 'Watering the Plants', language: 'en' }),
      ]),
    );
    await renderSessions();

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('Tiếng Việt rất đẹp')).toBeInTheDocument();
    expect(within(cards[0]).getByText('42')).toBeInTheDocument();
    expect(within(cards[0]).getByText('97.2%')).toBeInTheDocument();
    expect(within(cards[0]).getByText('02 Mar 2026')).toBeInTheDocument();
    // The history holds both languages, each card with its own (SCRUM-219); a session from before has none: Vietnamese.
    expect(within(cards[0]).getByText('VI')).toBeInTheDocument();
    expect(within(cards[2]).getByText('EN')).toBeInTheDocument();
    expect(within(cards[0]).getByText('30s')).toBeInTheDocument();
    expect(within(cards[0]).queryByText('Practice', { exact: false })).not.toBeInTheDocument(); // the mode is only the icon
    expect(within(cards[0]).getByRole('img', { name: /Speed over time/  })).toBeInTheDocument();
    expect(screen.getByText('Sessions').parentElement).toHaveTextContent('3Sessions');
    expect(getSessions).toHaveBeenCalledWith({ page: 1, limit: 5, sort: '-createdAt', status: 'completed' });

    expect(within(cards[1]).getByText('Untitled passage')).toBeInTheDocument();
    expect(within(cards[1]).getByText('02 Mar 2026')).toBeInTheDocument();
    expect(within(cards[1]).getByText('2m')).toBeInTheDocument();
    expect(screen.queryByText('Not counted')).not.toBeInTheDocument(); // an uncounted session looks like the others
    expect(within(cards[1]).getByText('No time data for this session')).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('img', { name: /Speed over time/  })).not.toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /Open the result of/ });
    expect(links[0]).toHaveAttribute('href', '/typing/result/s1');
    expect(links[1]).toHaveAttribute('href', '/typing/result/s2');
  });

  it('sorts the sessions and goes to the next page', async () => {
    getSessions.mockResolvedValue(page([session()], { total: 8, totalPages: 2 }));
    const user = userEvent.setup();
    await renderSessions();

    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 2, limit: 5, sort: '-createdAt', status: 'completed' }));

    await user.click(screen.getByRole('button', { name: /Sort/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Fastest' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 5, sort: '-wpm', status: 'completed' }));
  });

  it('searches the sessions by passage name and filters them by mode and time', async () => {
    const user = userEvent.setup();
    await renderSessions();
    await screen.findByRole('article');

    await user.click(screen.getByRole('button', { name: 'Search sessions' }));
    await user.type(screen.getByRole('textbox', { name: 'Search sessions' }), 'thu{Enter}');
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 5, sort: '-createdAt', status: 'completed', q: 'thu' }));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(within(await screen.findByRole('group', { name: 'Mode' })).getByRole('menuitemradio', { name: 'Placement' }));
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'thu', mode: 'placement' })));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(within(await screen.findByRole('group', { name: 'Time' })).getByRole('menuitemradio', { name: '2m' }));
    await waitFor(() =>
      expect(getSessions).toHaveBeenLastCalledWith({ page: 1, limit: 5, sort: '-createdAt', status: 'completed', q: 'thu', mode: 'placement', timeLimitSeconds: 120 }),
    );
  });

  it('says that nothing matches, not that there is no session, when a search or filter finds none', async () => {
    getSessions.mockResolvedValue(page([]));
    const user = userEvent.setup();
    await renderSessions();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search sessions' }));
    await user.type(screen.getByRole('textbox', { name: 'Search sessions' }), 'zzz{Enter}');
    expect(await screen.findByText('No matching sessions')).toBeInTheDocument();
  });

  it('says so when there is no session yet, and shows an error with a retry when the list cannot load', async () => {
    getSessions.mockResolvedValueOnce(page([]));
    const first = await renderSessions();
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
    first.unmount();

    getSessions.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Sessions offline' } } });
    const user = userEvent.setup();
    await renderSessions();
    expect(await screen.findByText('Sessions offline')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /WPM and accuracy by/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
  });
});

describe('ProgressPage vowel × tone page (SCRUM-29)', () => {
  it('shows the grid as a page of its own with the button under the page, and goes back with the button under it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to Vowel × tone' }));

    expect(screen.getByRole('heading', { name: 'Vowel × tone' })).toBeInTheDocument();
    // A page of its own: neither the chart nor the panels under it.
    expect(screen.queryByRole('heading', { name: 'Progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Error profile' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to Progress' }));
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Error profile' })).toBeInTheDocument();
  });
});

describe('ProgressPage height', () => {
  it('lets the chart grow with the screen: the page fills the height, the chart box takes what is left', async () => {
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    const chart = await screen.findByRole('img', { name: /WPM and accuracy by/ });
    const box = chart.closest('section')!.parentElement!.parentElement!;
    expect(box).toHaveClass('lg:flex-1', 'lg:min-h-64');
    expect(chart).toHaveClass('h-full');
    expect(box.parentElement!.parentElement).toHaveClass('flex-1', 'flex', 'flex-col');
  });
});

describe('ProgressPage error rate chart (SCRUM-30)', () => {
  it('switches the chart of the top panel between Progress and Error rate with the button next to the title', async () => {
    const user = userEvent.setup();
    getMonthlyProgress.mockImplementation((range: string) =>
      Promise.resolve({ range, points: [{ key: '2026-02', avgWpm: 40, avgAccuracy: 95, carriedOver: false }] }),
    );
    renderWithProviders(<ProgressPage />, { route: '/progress' });

    expect(await screen.findByRole('img', { name: /WPM and accuracy by/ })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Error types shown' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to Error rate' }));

    expect(screen.getByRole('heading', { name: 'Error rate' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Error rate of each error type by/ })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /WPM and accuracy by/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Error types shown' })).getAllByRole('listitem')).toHaveLength(5);
    // The Week, Month and Year buttons stay, and the comparison of the WPM chart goes.
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add comparison' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to Progress' }));
    expect(await screen.findByRole('img', { name: /WPM and accuracy by/ })).toBeInTheDocument();
  });

  it('shows or hides lines with the Lines button at the bottom right: all of them, or one error type only', async () => {
    const user = userEvent.setup();
    getMonthlyProgress.mockImplementation((range: string) =>
      Promise.resolve({ range, points: [{ key: '2026-02', avgWpm: 40, avgAccuracy: 95, carriedOver: false }] }),
    );
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await user.click(await screen.findByRole('button', { name: 'Switch to Error rate' }));
    await screen.findByRole('img', { name: /Error rate of each error type by/ });

    await user.click(screen.getByRole('button', { name: 'Lines' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Wrong tone only' }));

    expect(screen.getByRole('button', { name: 'Lines' })).toHaveTextContent('Wrong tone');
    expect(within(screen.getByRole('list', { name: 'Error types shown' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Wrong tone']);

    await user.click(screen.getByRole('button', { name: 'Lines' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'All lines' }));
    expect(within(screen.getByRole('list', { name: 'Error types shown' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('has a language button at the bottom left that switches the lines to the English error types, and a wider Lines menu', async () => {
    const user = userEvent.setup();
    getMonthlyProgress.mockImplementation((range: string) =>
      Promise.resolve({ range, points: [{ key: '2026-02', avgWpm: 40, avgAccuracy: 95, carriedOver: false }] }),
    );
    renderWithProviders(<ProgressPage />, { route: '/progress' });
    await user.click(await screen.findByRole('button', { name: 'Switch to Error rate' }));
    await screen.findByRole('img', { name: /Error rate of each error type by/ });
    const legend = () => within(screen.getByRole('list', { name: 'Error types shown' })).getAllByRole('listitem');

    expect(legend()).toHaveLength(5);
    // The language button is before the legend, the Lines button after it.
    const language = screen.getByRole('button', { name: 'Error rate language: Vietnamese. Switch to English' });
    expect(language.compareDocumentPosition(screen.getByRole('list', { name: 'Error types shown' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Its word is always shown, not only on hover.
    expect(language).toHaveTextContent('Vietnamese');

    await user.click(language);
    expect(screen.getByRole('button', { name: 'Error rate language: English. Switch to Vietnamese' })).toBeInTheDocument();
    expect(legend()).toHaveLength(6);
    expect(legend().map((item) => item.textContent)).toContain('Swapped letters');

    await user.click(screen.getByRole('button', { name: 'Lines' }));
    expect(screen.getByRole('menu', { name: 'Lines options' })).toHaveClass('min-w-72');
    expect(screen.getByRole('menuitemradio', { name: 'Extra letter only' })).toBeInTheDocument();
  });
});
