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
  /** No lines between the tiers and before `meta`: the tags and the date sit under the top tier without separators. */
  flat?: boolean;
  /** `extra` sits beside the identity from `sm` up (a leaderboard row: the numbers on the line of the name), instead of under it until `xl`. */
  extraBeside?: boolean;
  /** `extra` takes all the room between the identity and the action (from `xl` up), for columns that share the row equally; `center` is not shown. */
  stretch?: boolean;
}

/**
 * A two-tier list item in the red card look of the Passages cards.
 * Top: identity | center | extra | action. Bottom (when given): tags | meta.
 * Below `xl` the top tier stacks (identity and action, then extra) and `center` is hidden.
 */
export const ListRow = ({ identity, center, extra, action, tags, meta, plain, flat, stretch, extraBeside }: ListRowProps) => (
  <article
    className={cn(
      'group border-0 text-primary',
      plain ? 'bg-transparent transition-colors hover:bg-primary/15' : 'bg-primary/15 transition-shadow hover:ring-1 hover:ring-primary/60',
    )}
  >
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 py-3 pr-3 pl-4 xl:gap-x-0',
        extraBeside && 'sm:grid-cols-[minmax(0,1fr)_auto_auto]',
        stretch ? 'xl:grid-cols-[minmax(0,300px)_0_0_0_minmax(0,1fr)_auto]' : 'xl:grid-cols-[minmax(0,300px)_minmax(16px,1fr)_minmax(0,50%)_minmax(16px,1fr)_auto_auto]',
      )}
    >
      {identity}
      <span className="hidden xl:block" aria-hidden />
      <div className="hidden xl:block">{center}</div>
      <span className="hidden xl:block" aria-hidden />
      <div className={cn('col-span-2 xl:col-span-1', extraBeside && 'sm:col-span-1 sm:col-start-2 sm:row-start-1 xl:col-start-auto xl:row-start-auto', stretch && 'xl:pl-8')}>{extra}</div>
      <div className={cn('col-start-2 row-start-1 self-start xl:col-start-auto xl:row-start-auto', extraBeside && 'sm:col-start-3')}>{action}</div>
    </div>

    {(tags || meta) && (
      <div className={cn('flex items-stretch justify-between gap-2', !flat && 'border-t border-background transition-colors group-hover:border-primary/60')}>
        {/* flat: the tags sit right under the top tier and end as far from the bottom as the top tier does from the top (12px) */}
        <div className={cn('flex flex-wrap items-center gap-1.5 px-4', flat ? 'pb-3' : 'py-1.5')}>{tags}</div>
        {meta && (
          <p className={cn('flex items-center px-4 text-sm text-primary/70', flat ? 'pb-3' : 'py-1.5', !flat && 'border-l border-background transition-colors group-hover:border-primary/60')}>
            {meta}
          </p>
        )}
      </div>
    )}
  </article>
);

/**
 * One label/value pair for the `extra` slot of a `ListRow`, e.g. `WPM` over `64`; 61px high, like the heatmap and the avatar. A `className` such as `w-20` gives the columns of a list one width, so they line up from row to row.
 * `compactOnPhones` (the leaderboards) is for the stacked row of a phone held upright (below `sm`, 640px): a size smaller and no fixed height, so the pairs sit in equal columns under the name, still right-aligned unless `startOnPhones` (left-aligned there); from `sm` it is the full-size, right-aligned pair.
 */
export const ListRowStat = ({ label, value, className, compactOnPhones, startOnPhones }: { label: string; value: string; className?: string; compactOnPhones?: boolean; startOnPhones?: boolean }) => (
  <div className={cn('flex h-[61px] flex-col text-right', compactOnPhones && 'max-sm:h-auto max-sm:gap-1', startOnPhones && 'max-sm:text-left', className)}>
    <span className="text-base font-semibold leading-none tracking-widest text-primary/70">{label}</span>
    <span className={cn('flex flex-1 items-end justify-end text-3xl font-black leading-none text-primary', compactOnPhones && 'max-sm:text-2xl', startOnPhones && 'max-sm:justify-start')}>{value}</span>
  </div>
);

// With a mouse the button takes no room until the row is hovered, focused or its menu is open: then it opens (with its 16px gap
// to the columns before it) and they move left; without it they sit at the right edge. Touch screens always show it.
const kebabClass =
  'ml-4 flex size-8 shrink-0 flex-col items-center justify-center gap-[3px] overflow-hidden transition-[background-color,opacity,width,margin] duration-200 hover:bg-primary/30 pointer-fine:ml-0 pointer-fine:w-0 pointer-fine:opacity-0 pointer-fine:group-hover:ml-4 pointer-fine:group-hover:w-8 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:ml-4 pointer-fine:group-focus-within:w-8 pointer-fine:group-focus-within:opacity-100 pointer-fine:aria-expanded:ml-4 pointer-fine:aria-expanded:w-8 pointer-fine:aria-expanded:opacity-100';
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
