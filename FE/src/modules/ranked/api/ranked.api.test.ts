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

  // SCRUM-154: a player away for 15 s forfeits, so the waits between tries stay short enough to be back in time.
  it('never waits more than 3 s between tries, so a short cut is back within the 15 s grace', async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false });
    const close = openMatchStream('ABC234', () => undefined);

    await vi.advanceTimersByTimeAsync(15_000); // tries at 0, 1, 3, 6, 9, 12, 15 s
    expect(fetchMock).toHaveBeenCalledTimes(7);
    close();
  });

  it('tells when the stream is open and when it dropped', async () => {
    let finish: () => void = () => undefined;
    const body = new ReadableStream<Uint8Array>({ start: (controller) => void (finish = () => controller.close()) });
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, body }).mockResolvedValue({ status: 503, ok: false });
    const onStatus = vi.fn();
    const close = openMatchStream('ABC234', () => undefined, { onStatus });

    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenLastCalledWith(true);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenLastCalledWith(false);
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
