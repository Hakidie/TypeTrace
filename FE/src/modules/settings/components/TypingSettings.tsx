import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { TYPING_FONT_SIZE } from '@/shared/lib/app-font';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useSaveTypingFontSize, useSettings } from '../hooks/use-settings';
import { FontSettings } from './FontSettings';
import { TypingPreview } from './TypingPreview';

const description = 'Choose how big the passage is on the typing page. The height of its 3 lines follows the size.';
/** The px of 1 rem in this browser (16 unless the learner changed their browser's font size). */
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/**
 * In Settings, the Typing tab (SCRUM-158): the Font panel (the font of the whole interface), the Font size panel (the size of the passage
 * text on the typing page, 1 to 2.5 rem) and, above them, a sample passage drawn like the typing page's at the size being chosen.
 */
export const TypingSettings = () => {
  const { isLoading, error, refetch } = useCurrentUser();
  const { typingFontSizeRem } = useSettings();
  const save = useSaveTypingFontSize();
  // The value while the slider is dragged; the saved one when it is not.
  const [dragged, setDragged] = useState<number | null>(null);
  const size = dragged ?? typingFontSizeRem;
  // How much of the bar is filled: the size between the smallest and the biggest.
  const filled = ((size - TYPING_FONT_SIZE.min) / (TYPING_FONT_SIZE.max - TYPING_FONT_SIZE.min)) * 100;

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading) return <LoadingState rows={2} />;

  // The size is saved when the slider is let go (pointer or key), not on every step of the drag.
  // The new size stays on the slider while it is saved (and goes back to the saved one if that fails).
  const commit = () => {
    if (dragged === null || save.isPending) return;
    if (dragged === typingFontSizeRem) setDragged(null);
    else save.mutate(dragged, { onSettled: () => setDragged(null) });
  };

  // Back to the size the passage had before it could be chosen; off while the bar already shows it.
  const reset = () => {
    setDragged(TYPING_FONT_SIZE.default);
    save.mutate(TYPING_FONT_SIZE.default, { onSettled: () => setDragged(null) });
  };

  return (
    <div className="flex flex-col gap-8">
      <TypingPreview fontSizeRem={size} />
      <FontSettings />
      <Panel title="Font size" titleTip={description} bare titleClassName={sectionTitleClass} className="flex flex-col gap-4 pt-3">
        {/* The reset button is at the right end of the description line. */}
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 text-lg text-muted-foreground">{description}</p>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A span, so the tooltip also shows while the button is off. */}
                <span className="shrink-0">
                  <Button variant="ghost" size="sm" aria-label="Reset font size" disabled={size === TYPING_FONT_SIZE.default || save.isPending} onClick={reset}>
                    <RotateCcw className="size-4" aria-hidden />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Reset to {TYPING_FONT_SIZE.default} rem</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          {/* A bar like the daily tasks' progress bar (track, red fill, square, 1rem high). The range input lies invisible over it, so dragging, keys and screen readers work as for a slider. */}
          <div className="relative h-4 min-w-0 flex-1">
            <input
              type="range"
              aria-label="Font size"
              min={TYPING_FONT_SIZE.min}
              max={TYPING_FONT_SIZE.max}
              step={TYPING_FONT_SIZE.step}
              value={size}
              disabled={save.isPending}
              onChange={(event) => setDragged(Number(event.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <div className="pointer-events-none absolute inset-0 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <div data-testid="font-size-fill" className="h-full bg-primary" style={{ width: `${filled}%` }} />
            </div>
          </div>
          <output className="w-40 shrink-0 text-right text-lg leading-7 text-primary">
            {size} rem · {Math.round(size * rootPx())} px
          </output>
        </div>
      </Panel>
    </div>
  );
};
