import type { ReactNode } from 'react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

interface PanelProps {
  /** Heading of the panel. Without a title (and actions) there is no header row. */
  title?: string;
  description?: string;
  /** Buttons shown on the right of the header, e.g. a "New" button. */
  actions?: ReactNode;
  /** No background and no shadow: only the border, so the page shows through. */
  transparent?: boolean;
  /** No border, background, shadow or padding: the title and content sit directly on the page. */
  bare?: boolean;
  /** Grows to the height the layout gives it (in a flex column) and passes it on to the content, which can then fill it. */
  fill?: boolean;
  /** Extra classes for the title (e.g. `text-2xl` for a bigger one). */
  titleClassName?: string;
  /** Extra classes for the body (e.g. `p-0` for a table that touches the edges). */
  className?: string;
  children: ReactNode;
}

/** A block of content in a page: a bordered card with an optional header (title, description, actions) and the content below. */
export const Panel = ({ title, description, actions, transparent, bare, fill, titleClassName, className, children }: PanelProps) => (
  <Card className={cn((transparent || bare) && 'bg-transparent shadow-none', bare && 'border-0', fill && 'flex min-h-0 flex-1 flex-col')}>
    {(title || actions) && (
      <div
        className={cn(
          'flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
          bare && 'border-b-0 px-0 pt-0',
        )}
      >
        <div className="min-w-0">
          {title && <h2 className={cn('text-lg font-semibold', titleClassName)}>{title}</h2>}
          {description && <p className="text-base text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn('p-5', bare && 'p-0', fill && 'flex min-h-0 flex-1 flex-col', className)}>{children}</div>
  </Card>
);
