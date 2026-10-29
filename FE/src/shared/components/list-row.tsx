import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

interface ListRowProps {
  /** Left: avatar, name, email. Give it `min-w-0` and `truncate` text so long values do not push the row wider. */
  identity: ReactNode;
  /** Wide column in the middle, e.g. an `ActivityHeatmap`. Shown from `xl` up only. */
  center?: ReactNode;
  /** Right, as wide as its content: a few label/value pairs. */
  extra?: ReactNode;
  /** Far right, as wide as its content: a `ListRowMenu` (see `UserRow`), or a few icon buttons. */
  action?: ReactNode;
  /** Bottom left: badges. Without `tags` and `meta` the row has no bottom tier. */
  tags?: ReactNode;
  /** Bottom right: a short text such as a date. */
  meta?: ReactNode;
  /** No background and no frame until the row is hovered, when the red tint shows (a list on a page, like the sessions of the profile). */
  plain?: boolean;
}

/**
 * A two-tier list item in the red card look of the Passages cards.
 * Top: identity | center | extra | action. Bottom (when given): tags | meta.
 * Below `xl` the top tier stacks (identity and action, then extra) and `center` is hidden.
 */
export const ListRow = ({ identity, center, extra, action, tags, meta, plain }: ListRowProps) => (
  <article
    className={cn(
      'group border-0 text-primary',
      plain ? 'bg-transparent transition-colors hover:bg-primary/15' : 'bg-primary/15 transition-shadow hover:ring-1 hover:ring-primary/60',
    )}
  >
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 py-3 pr-3 pl-4 xl:grid-cols-[minmax(0,300px)_minmax(16px,1fr)_minmax(0,50%)_minmax(16px,1fr)_auto_auto] xl:gap-x-0">
      {identity}
      <span className="hidden xl:block" aria-hidden />
      <div className="hidden xl:block">{center}</div>
      <span className="hidden xl:block" aria-hidden />
      {/* The gap to the action column only when there is an action: without one, `extra` ends at the right padding. */}
      <div className={cn('col-span-2 xl:col-span-1', action && 'xl:mr-4')}>{extra}</div>
      <div className="col-start-2 row-start-1 self-start xl:col-start-auto xl:row-start-auto">{action}</div>
    </div>

    {(tags || meta) && (
      <div className="flex items-stretch justify-between gap-2 border-t border-background transition-colors group-hover:border-primary/60">
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">{tags}</div>
        {meta && (
          <p className="flex items-center border-l border-background px-4 py-1.5 text-sm text-primary/70 transition-colors group-hover:border-primary/60">
            {meta}
          </p>
        )}
      </div>
    )}
  </article>
);

/** One label/value pair for the `extra` slot of a `ListRow`, e.g. `WPM` over `64`; 61px high, like the heatmap and the avatar. A `className` such as `w-20` gives the columns of a list one width, so they line up from row to row. */
export const ListRowStat = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={cn('flex h-[61px] flex-col text-right', className)}>
    <span className="text-base font-semibold leading-none tracking-widest text-primary/70">{label}</span>
    <span className="flex flex-1 items-end justify-end text-3xl font-black leading-none text-primary">{value}</span>
  </div>
);

// With a mouse the button shows only while the row is hovered, focused or its menu is open; touch screens always show it.
const kebabClass =
  'flex size-8 shrink-0 flex-col items-center justify-center gap-[3px] transition-[background-color,opacity] hover:bg-primary/30 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:data-[state=open]:opacity-100';
const kebabDots = [0, 1, 2].map((dot) => <span key={dot} className="size-1 bg-primary" />);

/** The three-square kebab button of a `ListRow`. With `children` (`DropdownMenuItem`s) it opens a menu; without, it is only decoration. */
export const ListRowMenu = ({ label, children }: { label: string; children?: ReactNode }) =>
  children ? (
    <DropdownMenu>
      <DropdownMenuTrigger className={kebabClass} aria-label={label}>
        {kebabDots}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <span className={kebabClass} aria-hidden>
      {kebabDots}
    </span>
  );
