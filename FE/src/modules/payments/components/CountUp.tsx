import { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  /** Turns a number into its text; keep it a stable function (declared outside the component). */
  format: (value: number) => string;
  ms?: number;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A number that counts up from 0 once when it appears (the coins just bought). It writes into the element, not into React
 * state, so the count does not render the tree on every frame; reduced motion and the first paint show the final number.
 */
export const CountUp = ({ to, format, ms = 900 }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion()) return;
    let frame = 0;
    // The first frame's own timestamp is the start: `performance.now()` can be later than it and make the count negative.
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / ms);
      element.textContent = format(Math.round(to * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = format(to);
    };
  }, [to, format, ms]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(to)}
    </span>
  );
};
