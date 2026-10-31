import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '@/shared/api/http';
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

    expect(screen.getByText('Đấu tập · không tính điểm')).toBeInTheDocument();
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

  it('can be skipped', () => {
    const onSkip = vi.fn();
    renderWithProviders(<PracticeDuel words={['nhà']} onDone={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));

    expect(onSkip).toHaveBeenCalledOnce();
  });
});
