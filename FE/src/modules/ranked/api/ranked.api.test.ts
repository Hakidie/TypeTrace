import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openMatchStream } from './ranked.api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('openMatchStream (ranked duel, phase 4)', () => {
  it('stops for good when the server refuses the room (any 4xx but 429)', async () => {
    fetchMock.mockResolvedValue({ status: 400, ok: false });
    const onGone = vi.fn();
    const close = openMatchStream('bad code', () => undefined, { onGone });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(onGone).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    close();
  });

  it('waits longer after each refusal when the server is busy or down', async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false });
    const onGone = vi.fn();
    const close = openMatchStream('ABC234', () => undefined, { onGone });

    await vi.advanceTimersByTimeAsync(1_000); // retry after 1 s
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000); // the next one waits 2 s
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onGone).not.toHaveBeenCalled();
    close();
  });

  it('does not reconnect once closed', async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false });
    const close = openMatchStream('ABC234', () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    close();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
