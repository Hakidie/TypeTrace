import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUND_MS } from '../lib/rain-game';
import { useRainGame } from './use-rain-game';

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useRainGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    setVisibility('visible');
    vi.useRealTimers();
  });

  it('does not tick before the round starts', () => {
    const { result } = renderHook(() => useRainGame());

    advance(1000);

    expect(result.current.state.elapsed).toBe(0);
  });

  it('ticks every 100 ms while playing', () => {
    const { result } = renderHook(() => useRainGame());

    act(() => result.current.start(['nhà'], 6));
    advance(1000);

    expect(result.current.state.elapsed).toBeGreaterThanOrEqual(900);
    expect(result.current.state.elapsed).toBeLessThanOrEqual(1000);
    expect(result.current.state.drops).toHaveLength(1);
  });

  it('pauses while the tab is hidden', () => {
    const { result } = renderHook(() => useRainGame());
    act(() => result.current.start(['nhà'], 6));
    advance(500);

    setVisibility('hidden');
    const before = result.current.state.elapsed;
    advance(2000);

    expect(result.current.paused).toBe(true);
    expect(result.current.state.elapsed).toBe(before);
    setVisibility('visible');
    advance(500);
    expect(result.current.paused).toBe(false);
    expect(result.current.state.elapsed).toBeGreaterThan(before);
  });

  it('toggles the pause', () => {
    const { result } = renderHook(() => useRainGame());
    act(() => result.current.start(['nhà'], 6));

    act(() => result.current.togglePause());
    const before = result.current.state.elapsed;
    advance(1000);
    expect(result.current.paused).toBe(true);
    expect(result.current.state.elapsed).toBe(before);

    act(() => result.current.togglePause());
    advance(1000);
    expect(result.current.state.elapsed).toBeGreaterThan(before);
  });

  it('stops ticking when the round is over', () => {
    const { result } = renderHook(() => useRainGame());
    act(() => result.current.start(['nhà'], 6));

    advance(ROUND_MS + 1000);

    expect(result.current.state.phase).toBe('won');
    expect(vi.getTimerCount()).toBe(0);
  });
});
