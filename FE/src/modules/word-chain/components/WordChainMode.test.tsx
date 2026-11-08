import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { wordChainApi } from '../api/word-chain.api';
import { WordChainMode } from './WordChainMode';

vi.mock('../api/word-chain.api', () => ({ wordChainApi: { words: vi.fn() } }));
vi.mock('@/modules/auth/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { _id: 'u1' } }) }));
vi.mock('@/shared/components/lottie', () => ({ Lottie: () => null }));

// The bot starts with "học sinh" (Math.random is 0) and answers "sinh viên" with "viên chức".
const LIST = ['*học sinh', 'sinh viên', '*viên chức', 'chức vụ', 'sinh sôi'].join('\n');

describe('WordChainMode', () => {
  beforeEach(() => {
    vi.mocked(wordChainApi.words).mockResolvedValue(LIST);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const startGame = async () => {
    renderWithProviders(<WordChainMode />);
    await userEvent.click(await screen.findByRole('button', { name: 'Bắt đầu' }));
    expect(await screen.findByRole('listitem', { name: 'Bot: học sinh' })).toBeInTheDocument();
  };

  it('shows the rules and the time bonus by speed before the game', async () => {
    renderWithProviders(<WordChainMode />);
    expect(await screen.findByRole('heading', { name: 'Nối từ' })).toBeInTheDocument();
    expect(screen.getByText('≥ 40 WPM:')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('60s');
  });

  it('takes a right word, scores it, adds time and gets the bot to answer', async () => {
    await startGame();
    await userEvent.type(screen.getByRole('textbox', { name: 'Từ nối tiếp' }), 'sinh viên{Enter}');
    expect(await screen.findByRole('listitem', { name: 'Bạn: sinh viên' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Bot: viên chức' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Đúng! \+1 điểm, \+\d giây/);
    expect(screen.getByRole('textbox', { name: 'Từ nối tiếp' })).toHaveValue('');
    expect(screen.getByText('Điểm').nextSibling).toHaveTextContent('1');
  });

  it('says why a word is refused and keeps it in the box', async () => {
    await startGame();
    const box = screen.getByRole('textbox', { name: 'Từ nối tiếp' });
    await userEvent.type(box, 'chức vụ{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Từ phải bắt đầu bằng "sinh".');
    await userEvent.clear(box);
    await userEvent.type(box, 'sinh tố{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('"sinh tố" chưa có trong danh sách từ.');
    expect(box).toHaveValue('sinh tố');
  });

  it('a hint costs 3 s and a skip 5 s', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Gợi ý/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Gợi ý: sinh (viên|sôi) \(−3 giây\)/);
    expect(screen.getByRole('timer')).toHaveTextContent('57s');
    await userEvent.click(screen.getByRole('button', { name: /Bỏ qua/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Bỏ qua "học sinh", −5 giây');
    expect(screen.getByRole('timer')).toHaveTextContent('52s');
  });

  it('ends at 0 s and keeps a new best score', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    await startGame();
    await userEvent.type(screen.getByRole('textbox', { name: 'Từ nối tiếp' }), 'sinh viên{Enter}');
    vi.setSystemTime(new Date('2026-11-09T10:05:00Z'));
    expect(await screen.findByRole('heading', { name: 'Kỷ lục mới!' })).toBeInTheDocument();
    expect(localStorage.getItem('typetrace:noi-tu-best:u1')).toBe('1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chơi lại' })).toBeInTheDocument());
  });

  it('shows an error with a retry when the word list cannot load', async () => {
    vi.mocked(wordChainApi.words).mockRejectedValue(new Error('offline'));
    renderWithProviders(<WordChainMode />);
    expect(await screen.findByRole('button', { name: /try again|thử lại/i })).toBeInTheDocument();
  });
});
