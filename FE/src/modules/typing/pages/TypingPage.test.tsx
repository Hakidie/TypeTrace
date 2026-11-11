import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Link, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMinigameLang } from '@/shared/hooks/use-minigame-lang';
import { renderWithProviders } from '@/test/render-with-providers';
import { decodeReplay, replayTextAt } from '../utils/session-replay';
import { TypingPage } from './TypingPage';

const start = vi.fn();
const begin = vi.fn();
const complete = vi.fn();
const passages = vi.fn();

vi.mock('../api/typing.api', () => ({
  typingApi: {
    start: (input: unknown) => start(input),
    begin: (id: string) => begin(id),
    complete: (id: string, typedWords: string[], typedAtMs: number[], timeLimitSeconds: number, replay?: unknown) =>
      complete(id, typedWords, typedAtMs, timeLimitSeconds, replay),
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

const FREE_PLAN = { plan: 'free', expiresAt: null, maxPassages: 9, usedPassages: 2, canUsePublicPassages: false, canCreateErrorPractice: false, plans: { free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false }, premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true } } };
const getPlan = vi.fn();
vi.mock('@/modules/plan/api/plan.api', () => ({
  planApi: { get: () => getPlan() },
}));

/** The error profile the Weak spots cards read: hỏi / ngã and đ weak, the tone without enough data yet. */
const typeProfile = (type: string, rate: number, level = 'ok', trend = 'unchanged', opportunities = 100) => ({ type, errors: rate, opportunities, rate, level, previousRate: rate, trend });
const ERROR_PROFILE = {
  window: 10,
  minOpportunities: 20,
  weakRate: 15,
  sessionsUsed: 10,
  types: [
    typeProfile('BASE_LETTER', 2),
    typeProfile('D_MISSING', 20, 'weak'),
    typeProfile('MARK_WRONG', 3),
    typeProfile('TONE_WRONG', 0, 'insufficient_data', 'insufficient_data', 5),
    typeProfile('HOI_NGA_CONFUSION', 25.5, 'weak', 'worse'),
  ],
  weakTypes: ['HOI_NGA_CONFUSION', 'D_MISSING'],
};

// The Weak spots cards read the learner's error profile (US3.2, SCRUM-74).
const getErrorProfile = vi.fn();
vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getErrorProfile: () => getErrorProfile() },
}));

const startTutorial = vi.fn();
vi.mock('@/modules/tutorial/api/tutorial.api', () => ({
  tutorialApi: { start: () => startTutorial(), update: vi.fn(), reset: vi.fn(), coach: vi.fn() },
}));

vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));
vi.mock('@/modules/word-chain/api/word-chain.api', () => ({
  wordChainApi: {
    words: vi.fn().mockResolvedValue('*học sinh\nsinh viên'),
    board: vi.fn().mockResolvedValue({ range: 'week', items: [], me: null }),
    saveScore: vi.fn(),
  },
}));

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
  startTutorial.mockReset();
  sessionStorage.clear();
  getPlan.mockReset().mockResolvedValue(FREE_PLAN);
  getErrorProfile.mockReset().mockResolvedValue(ERROR_PROFILE);
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
    expect(start).toHaveBeenCalledWith({ mode: 'placement', timeLimitSeconds: 60 });

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'placement', timeLimitSeconds: 60 });
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

  describe('the placement leaderboard needs 3 minutes (US10.1)', () => {
    const openPlacement = async () => {
      start.mockResolvedValue({ ...session, mode: 'placement' });
      const user = userEvent.setup();
      renderWithProviders(<TypingPage />, { route: '/typing?mode=placement' });
      await screen.findByRole('textbox', { name: 'Typing area' });
      return user;
    };

    it('warns that a placement session of another time is not ranked, and stops once 3 minutes are picked', async () => {
      const user = await openPlacement();
      expect(screen.getByRole('status')).toHaveTextContent('Only 3-minute placement sessions go on the leaderboard');

      await user.click(screen.getByRole('radio', { name: '03' }));

      expect(screen.queryByText(/Only 3-minute placement sessions/)).not.toBeInTheDocument();
    });

    it('starts a new session with the new time, on a new random passage (the passage is chosen again)', async () => {
      const user = await openPlacement();
      expect(start).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('radio', { name: '03' }));

      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      expect(start).toHaveBeenLastCalledWith({ mode: 'placement', timeLimitSeconds: 180 });
    });

    it('keeps the passage picked in the menu when the time changes', async () => {
      const user = await openPlacement();
      await user.click(screen.getByRole('button', { name: 'Choose passage' }));
      await user.click(await screen.findByRole('menuitemradio', { name: /Hà Nội vào thu/ }));
      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));

      await user.click(screen.getByRole('radio', { name: '03' }));

      await waitFor(() => expect(start).toHaveBeenCalledTimes(3));
      expect(start).toHaveBeenLastCalledWith({ mode: 'placement', passageId: 'p1', timeLimitSeconds: 180 });
    });

    it('starts no new session when the unit button switches between seconds and minutes, only when a specific time is picked', async () => {
      const user = await openPlacement();

      await user.click(screen.getByRole('button', { name: 'Switch between seconds and minutes' }));

      expect(start).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('radio', { name: '30' }));
      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'placement', timeLimitSeconds: 30 }));
    });

    it('starts no new session when the time picked is the one already chosen', async () => {
      const user = await openPlacement();

      await user.click(screen.getByRole('radio', { name: '01' }));

      expect(start).toHaveBeenCalledTimes(1);
    });

    it('keeps the same session when the time changes in Practice', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByRole('textbox', { name: 'Typing area' });

      await user.click(screen.getByRole('radio', { name: '30' }));

      expect(start).toHaveBeenCalledTimes(1);
    });

    it('does not warn in Practice', async () => {
      renderPage();
      await screen.findByRole('textbox', { name: 'Typing area' });

      expect(screen.queryByText(/Only 3-minute placement sessions/)).not.toBeInTheDocument();
    });
  });

  it('shows an error with a retry when the session cannot be started', async () => {
    const user = userEvent.setup();
    start.mockRejectedValueOnce(new Error('down'));
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
  });

  it('sends only the typed words and the replay when finished, then opens the result', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet ');

    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith('s1', ['Tiếng', 'Viet'], [expect.any(Number), expect.any(Number)], 20, expect.any(Array)),
    );
    // The replay of the typing area (SCRUM-35) ends with what was typed.
    expect(replayTextAt(decodeReplay(complete.mock.calls[0][4]), Infinity)).toEqual({ shown: 'Tiếng Viet ', committed: 'Tiếng Viet ' });
    expect(await screen.findByText('result page')).toBeInTheDocument();
  });

  it('starts a new session on Restart', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox');

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
  });

  it('has Practice, Placement, Weak spots, Rank and Minigames tabs and shows the name of the passage', async () => {
    start.mockResolvedValue({ ...session, passageTitle: 'Mùa thu Hà Nội' });
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    expect(within(screen.getByRole('radiogroup', { name: 'Mode' })).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['Practice', 'Placement', 'Weak spots', 'Rank', 'Minigames']);
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

  it('shows the Rain card, and no Daily card, in the Minigames tab, without a passage to choose or a typing session', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing');
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Minigames' }));

    expect(await screen.findByRole('button', { name: /^Rain/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Daily/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames');
    expect(screen.getByRole('radio', { name: 'Minigames' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Choose passage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
    // Tests load no CSS: the time tabs are hidden by the `hidden` class of their frame.
    expect(screen.getByRole('radiogroup', { name: 'Time', hidden: true }).parentElement).toHaveClass('hidden');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('opens the bot duel from its card', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing?mode=minigames');

    await user.click(await screen.findByRole('button', { name: /^Bot duel/ }));

    expect(await screen.findByRole('button', { name: /^Dạ · Hard/ })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=bot');
    expect(start).not.toHaveBeenCalled();
  });

  it('writes the minigame tiles in Vietnamese when the player chose it in a game', async () => {
    resetMinigameLang('vi');
    renderWithUrl('/typing?mode=minigames');

    expect(await screen.findByRole('button', { name: /^Nối từ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Đấu bot/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
  });

  it('opens Word chain from its card', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing?mode=minigames');

    await user.click(await screen.findByRole('button', { name: /^Word chain/ }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=chain');
    expect(start).not.toHaveBeenCalled();
  });

  it('opens word rain from its card and goes back to the cards', async () => {
    const user = userEvent.setup();
    renderWithUrl('/typing?mode=minigames');

    await user.click(await screen.findByRole('button', { name: /^Rain/ }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=rain');

    await user.click(screen.getByRole('button', { name: 'All minigames' }));

    expect(await screen.findByRole('button', { name: /^Rain/ })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames');
    expect(screen.getByLabelText('URL search')).not.toHaveTextContent('game=');
    expect(start).not.toHaveBeenCalled();
  });

  it('opens the game of an old ?mode=rain link and rewrites it to the Minigames URL', async () => {
    renderWithUrl('/typing?mode=rain');

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=minigames&game=rain'));
    expect(screen.getByRole('radio', { name: 'Minigames' })).toHaveAttribute('aria-checked', 'true');
    expect(start).not.toHaveBeenCalled();
  });

  it('opens Practice from an old ?mode=daily link (the daily challenge is now the streak reward of Practice)', async () => {
    renderWithUrl('/typing?mode=daily');

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'true');
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

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement', timeLimitSeconds: 60 }));
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

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement', timeLimitSeconds: 60 }));
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

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement', timeLimitSeconds: 60 }));
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
    // Only the times shown change: none is selected until the learner picks one.
    expect(within(time).getAllByRole('radio').every((tab) => tab.getAttribute('aria-checked') === 'false')).toBe(true);
    await user.click(within(time).getByRole('radio', { name: '02' }));
    expect(within(time).getByRole('radio', { name: '02' })).toHaveAttribute('aria-checked', 'true');

    await user.click(unit);
    expect(within(time).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['10', '20', '30']);
  });

  it('selects 1 minute in the placement test, and 20 seconds again in Practice', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });
    const time = screen.getByRole('radiogroup', { name: 'Time' });
    expect(within(time).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Placement' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /seconds and minutes/i })).toHaveTextContent('Min'));
    expect(within(time).getByRole('radio', { name: '01' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Practice' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /seconds and minutes/i })).toHaveTextContent('Sec'));
    expect(within(time).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');
  });

  it('opens the placement test from the link with 1 minute selected, and sends 60 seconds when it finishes', async () => {
    const user = userEvent.setup();
    start.mockResolvedValue({ ...session, mode: 'placement' });
    renderWithProviders(<TypingPage />, { route: '/typing?mode=placement', otherRoutes: { '/typing/result/s1': 'result page' } });

    const typing = await screen.findByRole('textbox', { name: 'Typing area' });
    expect(within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', { name: '01' })).toHaveAttribute('aria-checked', 'true');

    await user.type(typing, 'Tiếng Viet ');

    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith('s1', ['Tiếng', 'Viet'], [expect.any(Number), expect.any(Number)], 60, expect.any(Array)),
    );
  });

  it('keeps the same session and passage when the time choice changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });
    const time = screen.getByRole('radiogroup', { name: 'Time' });

    await user.click(within(time).getByRole('radio', { name: '10' }));
    expect(within(time).getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /seconds and minutes/i }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', { name: '01' }));
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

  it('shows the passages locked by the plan or by the limit and does not start them', async () => {
    const user = userEvent.setup();
    passages.mockResolvedValue([
      { _id: 'p1', title: 'Hà Nội vào thu', wordCount: 40 },
      { _id: 'p9', title: 'Của người khác', wordCount: 30, lockedByPlan: true },
      { _id: 'p8', title: 'Quá hạn mức', wordCount: 20, locked: true },
    ]);
    start.mockResolvedValue({ ...session, passageTitle: 'Bữa cơm gia đình' });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Choose passage' }));
    const startedBefore = start.mock.calls.length;

    // A passage of another learner on the Free plan: the plan opens instead of the session.
    await user.click(await screen.findByRole('menuitemradio', { name: /Của người khác.*Premium/ }));
    expect(await screen.findByRole('group', { name: 'Free plan' })).toBeInTheDocument();
    // The page has the plan already (the Weak spots tab needs it), so the dialog opens with the focus on the first tooltip of a
    // card, which a first Escape would only close: the dialog is closed with its button.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A passage past the owner's limit: nothing happens.
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));
    const locked = await screen.findByRole('menuitemradio', { name: /Quá hạn mức.*Locked/ });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    await user.click(locked);

    expect(start.mock.calls.length).toBe(startedBefore);
    expect(start).not.toHaveBeenCalledWith(expect.objectContaining({ passageId: 'p9' }));
    expect(start).not.toHaveBeenCalledWith(expect.objectContaining({ passageId: 'p8' }));
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

describe('TypingPage: Weak spots (US3.2, SCRUM-74)', () => {
  const PREMIUM_PLAN = { ...FREE_PLAN, plan: 'premium', canUsePublicPassages: true, canCreateErrorPractice: true };
  const lesson = {
    ...session,
    _id: 's2',
    mode: 'targeted',
    passageTitle: 'Weak spots: hỏi / ngã, đ',
    focusErrorTypes: ['HOI_NGA_CONFUSION', 'D_MISSING'],
    lessonSource: 'ai',
  };

  const renderAt = (route: string) =>
    renderWithProviders(
      <>
        <UrlSearch />
        <TypingPage />
      </>,
      { route },
    );

  beforeEach(() => {
    getPlan.mockResolvedValue(PREMIUM_PLAN);
    start.mockImplementation((input: { mode?: string }) => Promise.resolve(input.mode === 'targeted' ? lesson : session));
  });

  it('shows the cards from its tab, the auto lesson first, and starts nothing until one is picked', async () => {
    const user = userEvent.setup();
    renderAt('/typing');
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Weak spots' }));

    const auto = await screen.findByRole('button', { name: 'Practice your weak spots' });
    // The auto card names the two weakest error types and their rates, as the server picks them.
    expect(auto).toHaveTextContent('Hỏi / ngã confusion25.5%');
    expect(auto).toHaveTextContent('Missing stroke on đ20%');
    // The five error types, the cards of the error profile; the auto card comes first (on top on phones).
    const types = screen.getByRole('region', { name: 'Error types' });
    expect(within(types).getAllByRole('button', { name: /^Practice / })).toHaveLength(5);
    expect(within(types).getAllByText('Weak')).toHaveLength(2);
    expect(auto.compareDocumentPosition(types) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('?mode=targeted');
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalledWith(expect.objectContaining({ mode: 'targeted' }));
  });

  it('starts the auto lesson from its card with 1 minute, says what it trains, restarts it and goes back to the cards', async () => {
    const user = userEvent.setup();
    renderAt('/typing?mode=targeted');

    await user.click(await screen.findByRole('button', { name: 'Practice your weak spots' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'targeted' }));
    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Training: Hỏi / ngã confusion · Missing stroke on đ');
    expect(screen.getByText('Weak spots: hỏi / ngã, đ')).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).toHaveTextContent('focus=auto');
    expect(within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', { name: '01' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Choose passage' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restart/i }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'targeted' });
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('button', { name: 'All weak spots' }));

    expect(await screen.findByRole('button', { name: 'Practice your weak spots' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).not.toHaveTextContent('focus=');
  });

  it('starts a lesson of the error type of the card picked, also one without enough data yet', async () => {
    const user = userEvent.setup();
    renderAt('/typing?mode=targeted');

    await user.click(await screen.findByRole('button', { name: 'Practice Wrong vowel mark (â ê ô ă ơ ư)' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'targeted', errorType: 'MARK_WRONG' }));
    expect(screen.getByLabelText('URL search')).toHaveTextContent('focus=MARK_WRONG');
    await screen.findByRole('textbox', { name: 'Typing area' });
    await user.click(screen.getByRole('button', { name: /restart/i }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'targeted', errorType: 'MARK_WRONG' });

    await user.click(screen.getByRole('button', { name: 'All weak spots' }));
    const tone = await screen.findByRole('button', { name: 'Practice Wrong tone' });
    expect(within(tone.closest('li')!).getByText(/Needs 15 more/)).toBeInTheDocument();
    await user.click(tone);

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'targeted', errorType: 'TONE_WRONG' }));
  });

  it('says on the auto card that a random passage comes without a weak error type, and says it again in the lesson', async () => {
    const user = userEvent.setup();
    getErrorProfile.mockResolvedValue({ ...ERROR_PROFILE, weakTypes: [] });
    start.mockResolvedValue({ ...session, mode: 'targeted', passageId: 'p1', passageTitle: 'Hà Nội vào thu', focusErrorTypes: [], lessonSource: 'passage' });
    renderAt('/typing?mode=targeted');

    const auto = await screen.findByRole('button', { name: 'Practice your weak spots' });
    expect(auto).toHaveTextContent('You have no weak error type yet, so this starts a random passage.');
    await user.click(auto);

    expect(await screen.findByRole('status')).toHaveTextContent('You have no weak error type yet, so here is a random passage.');
  });

  it('says the lesson is being written while the AI writes it', async () => {
    start.mockImplementation(() => new Promise(() => {}));
    renderAt('/typing?mode=targeted&focus=auto');

    expect(await screen.findByText('Writing your lesson…')).toBeInTheDocument();
  });

  it('shows the cards with a lock on a plan without Weak spots, and a card opens the plan instead of a lesson', async () => {
    const user = userEvent.setup();
    getPlan.mockResolvedValue(FREE_PLAN);
    renderAt('/typing?mode=targeted');

    expect(await screen.findByRole('button', { name: 'Practice your weak spots (Premium)' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\(Premium\)$/ })).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'Practice Hỏi / ngã confusion (Premium)' }));

    expect(await screen.findByRole('group', { name: 'Free plan' })).toBeInTheDocument();
    expect(screen.getByLabelText('URL search')).not.toHaveTextContent('focus=');
    expect(start).not.toHaveBeenCalled();
  });

  it('shows what the plan lacks instead of a lesson when a link opens one on a plan without Weak spots', async () => {
    const user = userEvent.setup();
    getPlan.mockResolvedValue(FREE_PLAN);
    renderAt('/typing?mode=targeted&focus=auto');

    expect(await screen.findByText(/Your plan does not include it/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
    // The lesson waited for the plan: no request, so no 403 and no error toast.
    expect(start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'See plans' }));

    expect(await screen.findByRole('group', { name: 'Free plan' })).toBeInTheDocument();
  });
});

describe('TypingPage: a learner who has just created their account (Ping tutorial)', () => {
  /** Shows the history state of the URL, to check that the tour starts only once. */
  const UrlState = () => <p aria-label="URL state">{JSON.stringify(useLocation().state)}</p>;

  const renderForNewAccount = () =>
    renderWithProviders(
      <>
        <TypingPage />
        <UrlState />
      </>,
      { route: '/typing', state: { newAccount: true } },
    );

  it("starts Ping's tour instead of asking for the placement test", async () => {
    renderForNewAccount();

    await waitFor(() => expect(startTutorial).toHaveBeenCalledTimes(1));
    // Once: the history entry no longer says the account is new, so a reload does not start it again.
    await waitFor(() => expect(screen.getByLabelText('URL state')).toHaveTextContent('null'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(start).toHaveBeenCalledWith({ mode: 'practice' });
  });

  it('does not start the tour for a learner who only logs in', async () => {
    renderPage();

    await screen.findByRole('textbox', { name: 'Typing area' });
    expect(startTutorial).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
