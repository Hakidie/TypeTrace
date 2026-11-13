import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface PlanOptionProps {
  /** The radio group it belongs to. */
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  /** Under the title, e.g. "41.500 ₫ a month". */
  detail?: string;
  price: string;
  /** A short tag beside the title, e.g. "Save 15%". */
  badge?: string;
  /** Drawn before the text (row) or above it (tile). */
  icon?: ReactNode;
  /** `row`: one line, the price on the right. `tile`: a column for a grid of plans, the price at the bottom. */
  layout?: 'row' | 'tile';
}

/**
 * A choice in the Store: a real radio input (the keyboard, the arrow keys and the screen reader come with it), drawn as a
 * row or a tile. The selected one gets the primary outline (a row also fills in its square, a tile has none); the press moves it 1%, both skipped for reduced motion.
 */
export const PlanOption = ({ name, value, checked, onSelect, title, detail, price, badge, icon, layout = 'row' }: PlanOptionProps) => {
  const tile = layout === 'tile';
  const square = (
    <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center border border-muted-foreground group-has-[:checked]/option:border-primary">
      <span className="size-2 scale-0 bg-primary transition-transform duration-150 group-has-[:checked]/option:scale-100 motion-reduce:transition-none" />
    </span>
  );
  const tag = badge && <span className="bg-primary px-1.5 py-0.5 text-xs font-semibold leading-none text-primary-foreground">{badge}</span>;

  return (
    <label className="group/option block h-full cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <div
        className={cn(
          'border bg-card/60 outline-2 -outline-offset-2 outline-transparent backdrop-blur-sm',
          'transition-[background-color,outline-color,transform] duration-150 hover:bg-primary/10 active:scale-[0.99]',
          'group-has-[:checked]/option:bg-primary/5 group-has-[:checked]/option:outline-primary',
          'group-has-[:focus-visible]/option:outline-ring motion-reduce:transition-none motion-reduce:active:scale-100',
          tile ? 'relative flex h-full flex-col gap-3 p-4' : 'flex items-center gap-4 p-4',
        )}
      >
        {tile ? (
          <>
            {tag && <span className="absolute right-3 top-3">{tag}</span>}
            {icon}
            <span className="block text-xl font-semibold text-foreground">{title}</span>
            {detail && <span className="-mt-2 block text-sm text-muted-foreground">{detail}</span>}
            <span className="mt-auto border-t pt-3 text-lg font-semibold tabular-nums text-foreground">{price}</span>
          </>
        ) : (
          <>
            {square}
            {icon}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                {title}
                {tag}
              </span>
              {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
            </span>
            <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground">{price}</span>
          </>
        )}
      </div>
    </label>
  );
};
