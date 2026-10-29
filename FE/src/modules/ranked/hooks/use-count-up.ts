import { useEffect, useState } from 'react';

const canAnimate = () =>
  typeof requestAnimationFrame === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that runs from `from` to `to` (ease-out, after `delay` ms), for the rewards of the result screen. Without
 * animation frames, or for people who ask for less motion, it is `to` at once.
 */
export const useCountUp = (to: number, from = 0, { duration = 900, delay = 0 } = {}) => {
  const [value, setValue] = useState(() => (canAnimate() ? from : to));

  useEffect(() => {
    if (!canAnimate()) return;
    let frame = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, from, duration, delay]);

  return value;
};
