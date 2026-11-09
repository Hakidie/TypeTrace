import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '@/shared/api/http';
import { resetMinigameLang } from '@/shared/hooks/use-minigame-lang';
import { renderWithProviders } from '@/test/render-with-providers';
import { PracticeDuel } from './PracticeDuel';

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('PracticeDuel', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is tagged unrated and throws a typed word to Ping', () => {
    renderWithProviders(<PracticeDuel words={['nhà']} onDone={vi.fn()} onSkip={vi.fn()} />);
    advance(200);

    expect(screen.getByText('Bronze')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Type a falling word' }), { target: { value: 'nhà ' } });

    expect(screen.getByRole('region', { name: 'Your field' })).toHaveTextContent('1 words');
    expect(screen.getByText('Ối, chữ bay tới kìa!')).toBeInTheDocument();
  });

  it('ends by K.O. with the numbers, without a word to the ranked API', () => {
    const get = vi.spyOn(http, 'get');
    const post = vi.spyOn(http, 'post');
    const onDone = vi.fn();
    renderWithProviders(<PracticeDuel words={['nhà', 'cửa', 'bàn', 'ghế', 'mưa', 'đèn']} onDone={onDone} onSkip={vi.fn()} />);

    // Nobody types on my side: three words land.
    advance(40_000);

    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0][0]).toMatchObject({ result: 'loss', livesLeft: 0, hits: 0 });
    expect(onDone.mock.calls[0][0].missedWords.length).toBeGreaterThan(0);
    const urls = [...get.mock.calls, ...post.mock.calls].map(([url]) => String(url));
    expect(urls.some((url) => url.includes('/matches') || url.includes('/ranked'))).toBe(false);
  });

  it('shows the level bot instead of Ping', () => {
    renderWithProviders(<PracticeDuel words={['nhà']} level="hard" skipLabel="Thoát" onDone={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('region', { name: "Dạ's field" })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dạ' })).toBeInTheDocument();
    expect(screen.getByText('Diamond')).toBeInTheDocument();
    // the Bot duel has no leave button of its own (the page has one under the game)
    expect(screen.queryByRole('button', { name: 'Thoát' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ping' })).not.toBeInTheDocument();
  });

  it('writes the Bot duel in Vietnamese when the player chose it', () => {
    resetMinigameLang('vi');
    renderWithProviders(<PracticeDuel words={['nhà']} level="easy" onDone={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Màn của bạn' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Màn của Bông' })).toBeInTheDocument();
    expect(screen.getAllByText('từ')).toHaveLength(2);
  });

  it('moves the bot field to the other side of mine and back', () => {
    renderWithProviders(<PracticeDuel words={['nhà']} level="easy" onDone={vi.fn()} onSkip={vi.fn()} />);
    const mine = screen.getByRole('region', { name: 'Your field' });

    expect(mine).toHaveClass('lg:order-1');
    fireEvent.click(screen.getByRole('button', { name: "Move the bot's field to the left" }));
    expect(mine).toHaveClass('lg:order-2');
    fireEvent.click(screen.getByRole('button', { name: "Move the bot's field to the right" }));
    expect(mine).toHaveClass('lg:order-1');
  });

  it('can be skipped', () => {
    const onSkip = vi.fn();
    renderWithProviders(<PracticeDuel words={['nhà']} onDone={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));

    expect(onSkip).toHaveBeenCalledOnce();
  });
});
