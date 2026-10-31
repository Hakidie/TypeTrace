import { useLayoutEffect, useState } from 'react';

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;

/** Where the element with `data-tutorial="<target>"` is on the screen, followed while the page scrolls or resizes. */
const useTargetBox = (target: string) => {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = document.querySelector(`[data-tutorial="${target}"]`);
      if (!element) return setBox(null);
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 });
    };
    measure();
    // The framed element can appear later (a falling word) or move; a light poll keeps the frame on it.
    const timer = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);
  return box;
};

/**
 * Frames what Ping talks about: a red border around the element, the rest of the page dimmed (a wide shadow spread, no
 * glow). It never takes clicks, so the framed element stays usable. Nothing is drawn while the element is missing.
 */
export const Spotlight = ({ target }: { target: string }) => {
  const box = useTargetBox(target);
  if (!box) return null;
  return (
    <div
      data-testid="tutorial-spotlight"
      aria-hidden="true"
      className="pointer-events-none fixed z-40 border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] transition-all duration-200 motion-reduce:transition-none"
      style={box}
    />
  );
};
