import { useEffect, useMemo, useState } from 'react';

const TYPE_MS = 28;
const HOLD_MS = 1600;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface TypingPreviewProps {
  /** The sentence: the words between asterisks are shown in bold. */
  text: string;
}

/**
 * A sentence that types itself, rests, and starts again: a picture of what a lesson looks like, with the words that train
 * an error type in bold. It is for the eye only (`aria-hidden`). The whole sentence is always laid out (the letters not
 * typed yet are invisible), so the page does not move; for reduced motion it shows the sentence at once.
 */
export const TypingPreview = ({ text }: TypingPreviewProps) => {
  const pieces = useMemo(() => text.split('*'), [text]);
  const parts = pieces.map((part, index) => ({ part, bold: index % 2 === 1, start: pieces.slice(0, index).join('').length }));
  const total = pieces.join('').length;
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? total : 0));

  useEffect(() => {
    // Reduced motion starts with the whole sentence and never ticks.
    if (prefersReducedMotion()) return;
    const timer = setTimeout(() => setTyped((count) => (count >= total ? 0 : count + 1)), typed >= total ? HOLD_MS : TYPE_MS);
    return () => clearTimeout(timer);
  }, [typed, total]);

  return (
    <span aria-hidden className="block flex-1 text-center text-3xl leading-relaxed text-muted-foreground">
      {parts.map(({ part, bold, start }, index) => {
        const shown = Math.max(0, Math.min(part.length, typed - start));
        return (
          <span key={index} className={bold ? 'font-bold text-primary' : undefined}>
            {part.slice(0, shown)}
            <span className="invisible">{part.slice(shown)}</span>
          </span>
        );
      })}
    </span>
  );
};
