import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerClock } from './server-clock';

describe('createServerClock', () => {
  afterEach(() => vi.useRealTimers());

  it('follows the local clock before any server time', () => {
    vi.useFakeTimers({ now: 10_000 });

    expect(createServerClock().now()).toBe(10_000);
  });

  it('keeps the offset of the event that took the least time to arrive', () => {
    vi.useFakeTimers({ now: 10_000 });
    const clock = createServerClock();

    // The server is 500 ms ahead: one event took 120 ms to arrive, another 20 ms.
    clock.observe(10_380, 10_000);
    clock.observe(10_480, 10_000);
    clock.observe(10_400, 10_000);

    expect(clock.now()).toBe(10_480);
  });
});
