import { useLayoutEffect, useRef, useState } from 'react';

/**
 * How many whole lines of text fit in the element `ref` is put on, at least `min`: for a `line-clamp` that shows more or
 * fewer lines as the box grows or shrinks. The box must get its height from the layout (a flex or grid cell), not from its
 * text, and have a `line-height`. `undefined` until measured, or where the browser cannot measure.
 */
export const useFitLines = <T extends HTMLElement>(min = 1) => {
  const ref = useRef<T>(null);
  const [lines, setLines] = useState<number>();

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(box).lineHeight);
      if (lineHeight > 0) setLines(Math.max(min, Math.floor(box.clientHeight / lineHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [min]);

  return { ref, lines };
};
