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
}

/** Previous / next controls for list pages. Hidden when everything fits on one page. */
export const Pagination = ({ page, totalPages, onPageChange, variant = 'default', accent = false }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const toolbar = variant === 'toolbar';
  const buttonProps = toolbar
    ? ({ variant: 'ghost', className: cn('border border-transparent', accent ? 'bg-transparent text-primary hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground') } as const)
    : ({ variant: 'outline', size: 'sm' } as const);

  return (
    <nav className={cn('flex items-center gap-3', toolbar ? 'justify-end gap-1' : 'justify-center')} aria-label="Pagination">
      <Button {...buttonProps} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <span className={cn('text-base', accent ? 'text-primary' : 'text-muted-foreground', toolbar && 'px-4')}>
        Page {page} of {totalPages}
      </span>
      <Button {...buttonProps} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
};
