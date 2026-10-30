/** Ticks along the time axis, from 0 to `max`: a round step (1, 2, 3, 5, 6, ...) that gives at most 10 gaps, so a minute has one every 6 seconds. */
export const timeTicks = (max: number) => {
  const step = [1, 2, 3, 5, 6, 10, 15, 20, 30, 60].find((candidate) => max / candidate <= 10) ?? 60;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step);
  return ticks[ticks.length - 1] === max ? ticks : [...ticks, max];
};
