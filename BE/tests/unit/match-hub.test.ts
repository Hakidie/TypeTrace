import { EventEmitter } from 'events';
import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeStreams, isConnected, publish, resetMatchHub, subscribe } from '../../src/services/match-hub';

/** Just enough of an Express response for the hub: an emitter that records writes and ends like a real stream. */
const fakeResponse = (state: { destroyed?: boolean } = {}) => {
  const res = new EventEmitter() as EventEmitter & Record<string, unknown>;
  const writes: string[] = [];
  Object.assign(res, {
    destroyed: state.destroyed ?? false,
    writableEnded: false,
    status: () => res,
    set: () => res,
    flushHeaders: () => undefined,
    write: (chunk: string) => {
      if (res.writableEnded) res.emit('error', new Error('write after end'));
      writes.push(chunk);
      return true;
    },
    end: () => {
      res.writableEnded = true;
    }
  });
  return { res: res as unknown as Response, writes };
};

afterEach(() => resetMatchHub());

describe('match hub streams (review fixes)', () => {
  it('never writes to a stream it already ended, even before the client is gone', () => {
    const { res, writes } = fakeResponse();
    const onError = vi.fn();
    (res as unknown as EventEmitter).on('error', onError);
    subscribe('ROOMAA', 'u1', res, () => undefined);

    closeStreams('ROOMAA');
    publish('ROOMAA', 'state', { a: 1 });

    expect(onError).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
    expect(isConnected('ROOMAA', 'u1')).toBe(false);
  });

  it('does not keep a stream whose client left before it was opened', () => {
    const { res } = fakeResponse({ destroyed: true });
    const onClose = vi.fn();

    subscribe('ROOMBB', 'u1', res, onClose);

    expect(isConnected('ROOMBB', 'u1')).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
