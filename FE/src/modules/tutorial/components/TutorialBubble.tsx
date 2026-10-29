import { useEffect, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface TutorialBubbleProps {
  /** Where the guide is (1-based) and how many steps it has. */
  step: number;
  total: number;
  /** What the guide is, for screen readers and the small heading ("Chuyến hướng dẫn"). */
  label: string;
  children: ReactNode;
  /** Without it Ping waits for the learner to act (no next button). */
  onNext?: () => void;
  onSkip: () => void;
  nextLabel?: string;
  skipLabel?: string;
  className?: string;
}

/** Enter in a text box belongs to the box (it sends a word in word rain), not to the guide. */
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

/**
 * What Ping says: a speech bubble in the Panel look (see-through, blurred, panel border), a progress bar, and the
 * buttons. Enter goes on; skipping is a button, never Escape (Escape pauses word rain).
 */
export const TutorialBubble = ({ step, total, label, children, onNext, onSkip, nextLabel = 'Tiếp', skipLabel = 'Bỏ qua', className }: TutorialBubbleProps) => {
  useEffect(() => {
    if (!onNext) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !typingIn(event.target)) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onNext]);

  return (
    <div role="dialog" aria-label={label} className={cn('border bg-background/85 p-4 text-sm leading-relaxed backdrop-blur-sm', className)}>
      <div aria-hidden="true" className="mb-2 flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn('h-1 flex-1', index < step ? 'bg-primary' : 'bg-foreground/15')} />
        ))}
      </div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label} · {step}/{total}
      </p>
      <div className="mt-1">
        <span className="font-semibold text-primary">Ping: </span>
        {children}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {skipLabel}
        </Button>
        {onNext && (
          <Button size="sm" onClick={onNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
