import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** `'toolbar'` aligns right and looks like the Sort and Filter buttons of `ListToolbar`. */
  variant?: 'default' | 'toolbar';
  /** The theme red instead of the muted grey: red text on buttons without a background (a light red tint only while hovered). */
  accent?: boolean;
  /** No background color, not even while hovered (the buttons fade instead), the page as "1 of 3" without the word Page, and the buttons are only their arrows (still named Previous and Next). */
  plain?: boolean;
  /** No padding on the right of the Next button: its text ends at the right edge (with `ListToolbar`'s `flushRight`). */
  flushRight?: boolean;
}

/** Previous / next controls for list pages. Hidden when everything fits on one page. */
export const Pagination = ({ page, totalPages, onPageChange, variant = 'default', accent = false, plain = false, flushRight = false }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const toolbar = variant === 'toolbar';
  const buttonProps = toolbar
    ? ({ variant: 'ghost', className: cn('border border-transparent', accent ? 'bg-transparent text-primary hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground', plain && 'px-2 hover:bg-transparent hover:opacity-70') } as const)
    : ({ variant: 'outline', size: 'sm' } as const);

  return (
    <nav className={cn('flex items-center gap-3', toolbar ? 'justify-end gap-1' : 'justify-center')} aria-label="Pagination">
      <Button {...buttonProps} aria-label="Previous" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="size-4" />
        {!plain && 'Previous'}
      </Button>
      <span className={cn('text-base', accent ? 'text-primary' : 'text-muted-foreground', toolbar && (plain ? 'px-1' : 'px-4'))}>
        {plain ? '' : 'Page '}
        {page} of {totalPages}
      </span>
      <Button {...buttonProps} aria-label="Next" className={cn(buttonProps.className, flushRight && 'pr-0')} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {!plain && 'Next'}
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
};
