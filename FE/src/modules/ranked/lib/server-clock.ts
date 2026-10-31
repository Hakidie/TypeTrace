/**
 * The server's time as seen from the browser, for drawing a rain duel where the server says words are. Every event
 * carries `serverNow`; an event that took longer to arrive shows a smaller offset, so the largest offset seen is the
 * closest to the real one (one-way, so it can only be late by the fastest event's travel time).
 */
export const createServerClock = () => {
  let offset: number | undefined;
  return {
    /** An event stamped `serverNow` by the server arrived at `receivedAt` (local `Date.now()`). */
    observe: (serverNow: number, receivedAt: number) => {
      const sample = serverNow - receivedAt;
      if (offset === undefined || sample > offset) offset = sample;
    },
    now: () => Date.now() + (offset ?? 0),
  };
};

export type ServerClock = ReturnType<typeof createServerClock>;
