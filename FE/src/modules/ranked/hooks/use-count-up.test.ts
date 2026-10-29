import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountUp } from './use-count-up';

describe('useCountUp', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs from the start value to the end value', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(1020, 1000, { duration: 500 }));
    expect(result.current).toBe(1000);

    act(() => vi.advanceTimersByTime(600));

    expect(result.current).toBe(1020);
  });

  it('shows the end value at once for people who ask for less motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { result } = renderHook(() => useCountUp(20));

    expect(result.current).toBe(20);
  });
});
