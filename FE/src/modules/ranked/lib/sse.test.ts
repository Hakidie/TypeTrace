import { describe, expect, it } from 'vitest';
import { parseEvents } from './sse';

describe('parseEvents', () => {
  it('splits complete events, skips pings and keeps the unfinished rest', () => {
    const { events, rest } = parseEvents('event: state\ndata: {"code":"ABC234"}\n\n: ping\n\nevent: progress\ndata: {"typedCount":3}\n\nevent: res');

    expect(events).toEqual([
      { event: 'state', data: { code: 'ABC234' } },
      { event: 'progress', data: { typedCount: 3 } },
    ]);
    expect(rest).toBe('event: res');
  });
});
