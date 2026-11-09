import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { wordChainApi } from '../api/word-chain.api';
import { WordChainMode } from './WordChainMode';

vi.mock('../api/word-chain.api', () => ({ wordChainApi: { words: vi.fn(), saveScore: vi.fn(), board: vi.fn() } }));
vi.mock('@/modules/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { _id: 'u1' } }),
}));
vi.mock('@/shared/components/lottie', () => ({ Lottie: () => null }));

// The bot starts with "học sinh" (Math.random is 0) and answers "sinh viên" with "viên chức".
const LIST = ['*học sinh', 'sinh viên', '*viên chức', 'chức vụ', 'sinh sôi'].join('\n');
const BOX = { name: 'Second syllable (the syllable "sinh" is given)' };

describe('WordChainMode', () => {
  beforeEach(() => {
    vi.mocked(wordChainApi.words).mockResolvedValue(LIST);
    vi.mocked(wordChainApi.saveScore).mockResolvedValue({ score: 1 });
    vi.mocked(wordChainApi.board).mockResolvedValue({
      range: 'week',
      items: [{ rank: 1, displayName: 'Lan', avatar: { skin: 'a' } as never, score: 12, isMe: false }],
      me: { rank: 4, score: 3 },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const startGame = async () => {
    renderWithProviders(<WordChainMode />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('listitem', { name: 'Bot: học sinh' })).toBeInTheDocument();
  };

  it('shows the rules, the time bonus by speed, and the leaderboard in a modal that links to the Leaderboard page', async () => {
    renderWithProviders(<WordChainMode />);
    expect(await screen.findByRole('heading', { name: 'Word chain' })).toBeInTheDocument();
    expect(screen.getByText('≥ 40 WPM:')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('60s');
    expect(screen.queryByRole('region', { name: 'Word chain leaderboard' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    const dialog = await screen.findByRole('dialog', { name: 'Word chain leaderboard' });
    expect(within(dialog).getByRole('link', { name: 'Open the Leaderboard page' })).toHaveAttribute('href', '/leaderboard?tab=minigames');
    const board = within(dialog).getByRole('region', { name: 'Word chain leaderboard' });
    expect(await within(board).findByText('Lan')).toBeInTheDocument();
    expect(within(board).getByText(/You are/)).toHaveTextContent('You are #4 with 3 points.');
    await userEvent.click(within(board).getByRole('tab', { name: 'All time' }));
    await waitFor(() => expect(wordChainApi.board).toHaveBeenCalledWith('all'));
  });

  it('switches the texts between English and Vietnamese', async () => {
    renderWithProviders(<WordChainMode />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tiếng Việt' }));
    expect(await screen.findByRole('button', { name: 'Bắt đầu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('types the linking syllable for the player: only the second syllable is needed', async () => {
    await startGame();
    await userEvent.type(screen.getByRole('textbox', BOX), 'viên{Enter}');
    expect(await screen.findByRole('listitem', { name: 'You: sinh viên' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Bot: viên chức' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Right! \+1 point, \+\d+s/);
    expect(screen.getByRole('textbox', { name: 'Second syllable (the syllable "chức" is given)' })).toHaveValue('');
    expect(screen.getByText('Score').nextSibling).toHaveTextContent('1');
  });

  it('a refused word costs 3 s, says why and stays in the box', async () => {
    await startGame();
    const box = screen.getByRole('textbox', BOX);
    await userEvent.type(box, 'chức vụ{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('The word must start with "sinh". −3s');
    expect(screen.getByRole('timer')).toHaveTextContent('57s');
    await userEvent.clear(box);
    await userEvent.type(box, 'tố{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('"sinh tố" is not in the word list. −3s');
    expect(screen.getByRole('timer')).toHaveTextContent('54s');
    expect(box).toHaveValue('tố');
  });

  it('a hint costs 3 s and a skip 5 s', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Hint/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Hint: sinh (viên|sôi) \(−3s\)/);
    expect(screen.getByRole('timer')).toHaveTextContent('57s');
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Skipped "học sinh", −5s');
    expect(screen.getByRole('timer')).toHaveTextContent('52s');
  });

  it('ends at 0 s, keeps a new best score and sends the chain to the leaderboard', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    await startGame();
    await userEvent.type(screen.getByRole('textbox', BOX), 'viên{Enter}');
    vi.setSystemTime(new Date('2026-11-09T10:05:00Z'));
    expect(await screen.findByRole('heading', { name: 'New best!' })).toBeInTheDocument();
    expect(localStorage.getItem('typetrace:noi-tu-best:u1')).toBe('1');
    await waitFor(() =>
      expect(wordChainApi.saveScore).toHaveBeenCalledWith(
        [
          { by: 'bot', word: 'học sinh' },
          { by: 'me', word: 'sinh viên' },
          { by: 'bot', word: 'viên chức' },
        ],
        expect.anything(),
      ),
    );
    expect(wordChainApi.saveScore).toHaveBeenCalledTimes(1);
  });

  it('shows an error with a retry when the word list cannot load', async () => {
    vi.mocked(wordChainApi.words).mockRejectedValue(new Error('offline'));
    renderWithProviders(<WordChainMode />);
    expect(await screen.findByRole('button', { name: /try again|thử lại/i })).toBeInTheDocument();
  });
});
