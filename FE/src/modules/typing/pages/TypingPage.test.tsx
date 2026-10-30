import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Link, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingPage } from './TypingPage';

const start = vi.fn();
const begin = vi.fn();
const complete = vi.fn();
const passages = vi.fn();

vi.mock('../api/typing.api', () => ({
  typingApi: {
    start: (input: unknown) => start(input),
    begin: (id: string) => begin(id),
    complete: (id: string, typedWords: string[], typedAtMs: number[], timeLimitSeconds: number) =>
      complete(id, typedWords, typedAtMs, timeLimitSeconds),
    passages: (mode: string) => passages(mode),
  },
}));

vi.mock('@/modules/ranked/api/ranked.api', () => ({
  rankedApi: {
    get: (code: string) =>
      Promise.resolve({ code, status: 'waiting', rated: false, passageTitle: 'A quiet morning', wordCount: 3, players: [] }),
  },
  openMatchStream: () => () => undefined,
}));

vi.mock('@/modules/rain/api/rain.api', () => ({
  rainApi: { words: () => Promise.resolve({ words: ['nhà', 'cửa'], focus: [] }) },
}));

vi.mock('@/modules/daily/api/daily.api', () => ({
  dailyApi: {
    today: () =>
      Promise.resolve({
        date: '2026-10-29',
        passageTitle: 'Hà Nội vào thu',
        preview: 'Hà Nội vào thu',
        seconds: 60,
        triesLeft: 3,
        best: null,
        rank: null,
        streak: 0,
        coins: 0,
        lastTry: null,
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        yesterdayWinner: null,
      }),
    leaderboard: () => Promise.resolve({ date: '2026-10-29', players: 0, items: [], me: null }),
    history: () => Promise.resolve([]),
  },
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));

const session = {
  _id: 's1',
  mode: 'practice',
  status: 'in_progress',
  targetWords: ['Tiếng', 'Việt'],
  startedAt: new Date().toISOString(),
};

const renderPage = () =>
  renderWithProviders(<TypingPage />, { route: '/typing', otherRoutes: { '/typing/result/s1': 'result page' } });

/** Shows the query string of the URL, to check what the page leaves in it. */
const UrlSearch = () => <p aria-label="URL search">{useLocation().search}</p>;

beforeEach(() => {
  sessionStorage.clear();
  start.mockReset().mockResolvedValue(session);
  begin.mockReset().mockResolvedValue(session);
  complete.mockReset().mockResolvedValue({ ...session, status: 'completed' });
  passages.mockReset().mockResolvedValue([
    { _id: 'p1', title: 'Hà Nội vào thu', wordCount: 40 },
    { _id: 'p2', title: 'Bữa cơm gia đình', wordCount: 35 },
  ]);
});

describe('TypingPage', () => {
  it('starts a session when the page opens and shows the passage, without a start button', async () => {
    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Tiếng');
    expect(screen.queryByRole('button', { name: /start typing/i })).not.toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'practice' });
  });

  it('types the placement passage when opened from the placement intro, also after Restart', async () => {
    const user = userEvent.setup();
    start.mockResolvedValue({ ...session, mode: 'placement' });
    renderWithProviders(<TypingPage />, { route: '/typing?mode=placement' });

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'placement' });

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'placement' });
  });

  it('starts a practice session when the learner leaves the placement test for normal practice', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Link to="/typing">Typing</Link>
        <TypingPage />
      </>,
      { route: '/typing?mode=placement' },
    );
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('link', { name: 'Typing' }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'practice' });
  });

  it('tells the server about the first key only once the learner types', async () => {
    const user = userEvent.setup();
    renderPage();
    const area = await screen.findByRole('textbox', { name: 'Typing area' });
    expect(begin).not.toHaveBeenCalled();

    await user.type(area, 'Ti');

    await waitFor(() => expect(begin).toHaveBeenCalledTimes(1));
    expect(begin).toHaveBeenCalledWith('s1');
  });

  it('shows an error with a retry when the session cannot be started', async () => {
    const user = userEvent.setup();
    start.mockRejectedValueOnce(new Error('down'));
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
  });

  it('sends only the typed words when finished, then opens the result', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet ');

    await waitFor(() => expect(complete).toHaveBeenCalledWith('s1', ['Tiếng', 'Viet'], [expect.any(Number), expect.any(Number)], 20));
    expect(await screen.findByText('result page')).toBeInTheDocument();
  });

  it('starts a new session on Restart', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox');

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
  });

  it('has Practice, Placement, Rank and Minigames tabs and shows the name of the passage', async () => {
    start.mockResolvedValue({ ...session, passageTitle: 'Mùa thu Hà Nội' });
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    expect(within(screen.getByRole('radiogroup', { name: 'Mode' })).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['Practice', 'Placement', 'Rank', 'Minigames']);
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Rank' })).toBeEnabled();
    expect(screen.getByText('Mùa thu Hà Nội')).toBeInTheDocument();
  });

  it('opens the ranked duels from the Rank tab, without a passage to choose or a time limit (ranked duel, phase 4)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Rank' }));

    expect(await screen.findByRole('button', { name: 'Create room' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Rank' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Choose passage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
  });

  const renderWithUrl = (route: string) =>
    renderWithProviders(
      <>
        <UrlSearch />
        <TypingPage />
      </>,
      { route },
    );

  it('shows a card for Rain and for Daily in the Minigames tab, without a passage to choose or a typing session', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing');
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Minigames' }));

    expect(await screen.findByRole('button', { name: /^Rain/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Daily/ })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames');
    expect(screen.getByRole('radio', { name: 'Minigames' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Choose passage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
    // Tests load no CSS: the time tabs are hidden by the `hidden` class of their frame.
    expect(screen.getByRole('radiogroup', { name: 'Time', hidden: true }).parentElement).toHaveClass('hidden');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('opens word rain from its card and goes back to the cards', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing?mode=minigames');

    await user.click(await screen.findByRole('button', { name: /^Rain/ }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=rain');

    await user.click(screen.getByRole('button', { name: 'All minigames' }));

    expect(await screen.findByRole('button', { name: /^Daily/ })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames');
    expect(screen.getByLabelText('URL search')).not.toHaveTextContent('game=');
    expect(start).not.toHaveBeenCalled();
  });

  it('opens the daily challenge from its card, without a practice session', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing?mode=minigames');

    await user.click(await screen.findByRole('button', { name: /^Daily/ }));

    expect(await screen.findByRole('button', { name: 'Start try 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=daily');
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    ['rain', 'Start'],
    ['daily', 'Start try 1'],
  ])('opens the game of an old ?mode=%s link and rewrites it to the Minigames URL', async (name, button) => {
    renderWithUrl(`/typing?mode=${name}`);

    expect(await screen.findByRole('button', { name: button })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('URL search')).toHaveTextContent(`?mode=minigames&game=${name}`));
    expect(screen.getByRole('radio', { name: 'Minigames' })).toHaveAttribute('aria-checked', 'true');
    expect(start).not.toHaveBeenCalled();
  });

  it('stays in the room when the active Rank tab is clicked again (ranked duel, phase 4)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <UrlSearch />
        <TypingPage />
      </>,
      { route: '/typing?mode=rank&room=ABC234' },
    );
    expect(await screen.findByText('ABC234')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Rank' }));

    expect(screen.getByLabelText('URL search')).toHaveTextContent('room=ABC234');
  });

  it('comes back to the room after a look at Practice (ranked duel, phase 4)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <UrlSearch />
        <TypingPage />
      </>,
      { route: '/typing?mode=rank&room=ABC234' },
    );
    expect(await screen.findByText('ABC234')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Practice' }));
    await screen.findByRole('textbox', { name: 'Typing area' });
    await user.click(screen.getByRole('radio', { name: 'Rank' }));

    await waitFor(() => expect(screen.getByLabelText('URL search')).toHaveTextContent('room=ABC234'));
  });

  it('asks first when the Placement tab is picked, and starts the placement session on Start', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Placement' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/all-time average WPM and accuracy/i);
    expect(start).toHaveBeenCalledTimes(1); // nothing changed yet

    await user.click(within(dialog).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement' }));
    expect(screen.getByRole('radio', { name: 'Placement' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays in practice when the placement question is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'true');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('gives the focus back to the typing area after the placement question is cancelled or started', async () => {
    const user = userEvent.setup();
    renderPage();
    const area = await screen.findByRole('textbox', { name: 'Typing area' });
    expect(area).toHaveFocus();

    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Typing area' })).toHaveFocus());

    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Typing area' })).toHaveFocus());
    await user.keyboard('T');
    expect(screen.getByRole('textbox', { name: 'Typing area' })).toHaveValue('T');
  });

  it('lets the learner type in placement mode after picking a specific practice passage first', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Hà Nội vào thu/ }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: 'p1' }));
    await screen.findByRole('textbox', { name: 'Typing area' });

    start.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ ...session, mode: 'placement', _id: 's2' }), 150)));
    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Typing area' })).toHaveFocus());
    await user.keyboard('T');
    expect(screen.getByRole('textbox', { name: 'Typing area' })).toHaveValue('T');
  });

  it('goes back to Random when the mode changes after a passage was picked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Hà Nội vào thu/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Random' })).not.toHaveClass('text-primary'));
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Random' })).toHaveClass('text-primary'));
    expect(passages).toHaveBeenCalledWith('practice');

    // Still Random back in practice: the pick is gone, so Restart types a random passage too.
    await user.click(screen.getByRole('radio', { name: 'Practice' }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice' }));
    await screen.findByRole('textbox', { name: 'Typing area' });
    expect(screen.getByRole('button', { name: 'Random' })).toHaveClass('text-primary');
    await user.click(screen.getByRole('button', { name: /restart/i }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: undefined }));
  });

  it('keeps the word count and the clock on screen while a new session loads', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    start.mockImplementation(() => new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument());
    expect(screen.getByText(/Words 0 \/ 0/)).toBeInTheDocument();
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:00');
  });

  it('has 10, 20 and 30 second tabs on the right of the passage name, 20 selected, and a button that switches to minutes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    const time = screen.getByRole('radiogroup', { name: 'Time' });
    const unit = screen.getByRole('button', { name: /seconds and minutes/i });
    expect(within(time).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['10', '20', '30']);
    expect(unit).toHaveTextContent('Sec');
    expect(within(time).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(time).getByRole('radio', { name: '10' }));
    expect(within(time).getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');

    await user.click(unit);

    expect(unit).toHaveTextContent('Min');
    expect(within(time).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['01', '02', '03']);
    expect(within(time).getByRole('radio', { name: '01' })).toHaveAttribute('aria-checked', 'true');

    await user.click(unit);
    expect(within(time).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['10', '20', '30']);
  });

  it('keeps the same session and passage when the time choice changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });
    const time = screen.getByRole('radiogroup', { name: 'Time' });

    await user.click(within(time).getByRole('radio', { name: '10' }));
    expect(within(time).getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /seconds and minutes/i }));
    expect(within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', { name: '01' })).toHaveAttribute('aria-checked', 'true');

    expect(screen.getByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('keeps the focus in the typing area when the time choice changes, so the learner can go on typing', async () => {
    const user = userEvent.setup();
    renderPage();
    const area = await screen.findByRole('textbox', { name: 'Typing area' });
    await user.type(area, 'Ti');

    await user.click(within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', { name: '10' }));
    await user.click(screen.getByRole('button', { name: /seconds and minutes/i }));

    expect(area).toHaveFocus();
    await user.keyboard('ế');
    expect(area).toHaveValue('Tiế');
  });

  it('types the passage picked in the name menu, then goes back to a random one with Random', async () => {
    const user = userEvent.setup();
    start.mockResolvedValueOnce({ ...session, passageTitle: 'Bữa cơm gia đình' });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Choose passage' })).toHaveTextContent('Bữa cơm gia đình');
    expect(screen.getByRole('button', { name: 'Random' })).toHaveClass('text-primary');

    start.mockResolvedValueOnce({ ...session, passageTitle: 'Hà Nội vào thu' });
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Hà Nội vào thu/ }));

    expect(passages).toHaveBeenCalledWith('practice');
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: 'p1' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose passage' })).toHaveTextContent('Hà Nội vào thu'));
    expect(screen.getByRole('button', { name: 'Choose passage' })).toHaveClass('text-primary');
    expect(screen.getByRole('button', { name: 'Random' })).not.toHaveClass('text-primary');

    // Restart keeps the picked passage.
    await user.click(screen.getByRole('button', { name: /restart/i }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: 'p1' }));

    await user.click(screen.getByRole('button', { name: 'Random' }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: undefined }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Random' })).toHaveClass('text-primary'));
  });

  it('types the passage from the URL first, as when Practice is clicked on the Passages page', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <TypingPage />
        <UrlSearch />
      </>,
      { route: '/typing?passage=p2' },
    );

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'practice', passageId: 'p2' });
    expect(screen.getByRole('button', { name: 'Random' })).not.toHaveClass('text-primary');
    // Read once, then left out of the URL: a reload after Random or another pick must not bring it back.
    await waitFor(() => expect(screen.getByLabelText('URL search')).toBeEmptyDOMElement());

    // Restart keeps the passage, Random leaves it.
    await user.click(screen.getByRole('button', { name: /restart/i }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: 'p2' }));
    await user.click(screen.getByRole('button', { name: 'Random' }));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'practice', passageId: undefined }));
  });

  it('shows an error in the name menu when the passages cannot be loaded', async () => {
    const user = userEvent.setup();
    passages.mockRejectedValue(new Error('boom'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Choose passage' }));

    expect(await screen.findByText('Could not load passages')).toBeInTheDocument();
  });
});

describe('TypingPage: a learner who has just created their account (SCRUM-157)', () => {
  /** Shows the history state of the URL, to check that the question is asked only once. */
  const UrlState = () => <p aria-label="URL state">{JSON.stringify(useLocation().state)}</p>;

  const renderForNewAccount = () =>
    renderWithProviders(
      <>
        <TypingPage />
        <UrlState />
      </>,
      { route: '/typing', state: { newAccount: true } },
    );

  it('asks first to take the placement test, and starts it on Start the test', async () => {
    const user = userEvent.setup();
    renderForNewAccount();

    const dialog = await screen.findByRole('dialog', { name: 'Welcome! Take the placement test?' });
    expect(dialog).toHaveTextContent(/later from the Placement tab/);
    // Asked once: the history entry no longer says the account is new, so a reload does not ask again.
    await waitFor(() => expect(screen.getByLabelText('URL state')).toHaveTextContent('null'));
    await user.click(within(dialog).getByRole('button', { name: 'Start the test' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement' }));
    expect(screen.getByRole('radio', { name: 'Placement' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays in practice on Not now', async () => {
    const user = userEvent.setup();
    renderForNewAccount();

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'practice' });
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'true');
  });

  it('does not ask a learner who only logs in', async () => {
    renderPage();

    await screen.findByRole('textbox', { name: 'Typing area' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
