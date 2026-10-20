import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

interface ListRowProps {
  /** Left: avatar, name, email. Give it `min-w-0` and `truncate` text so long values do not push the row wider. */
  identity: ReactNode;
  /** Wide column in the middle, e.g. an `ActivityHeatmap`. Shown from `xl` up only. */
  center?: ReactNode;
  /** Right, as wide as its content: a few label/value pairs. */
  extra?: ReactNode;
  /** Far right, 32px: a `ListRowMenu`. */
  action?: ReactNode;
  /** Bottom left: badges. */
  tags?: ReactNode;
  /** Bottom right: a short text such as a date. */
  meta?: ReactNode;
}

/**
 * A two-tier list item in the red card look of the Passages cards.
 * Top: identity | center | extra | action. Bottom: tags | meta.
 * Below `xl` the top tier stacks (identity and action, then extra) and `center` is hidden.
 */
export const ListRow = ({ identity, center, extra, action, tags, meta }: ListRowProps) => (
  <article className="group border-0 bg-primary/15 text-primary transition-shadow hover:ring-1 hover:ring-primary/60">
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 py-3 pr-3 pl-4 xl:grid-cols-[minmax(0,300px)_minmax(16px,1fr)_minmax(0,50%)_minmax(16px,1fr)_auto_32px] xl:gap-x-0">
      {identity}
      <span className="hidden xl:block" aria-hidden />
      <div className="hidden xl:block">{center}</div>
      <span className="hidden xl:block" aria-hidden />
      <div className="col-span-2 xl:col-span-1 xl:mr-4">{extra}</div>
      <div className="col-start-2 row-start-1 self-start xl:col-start-auto xl:row-start-auto">{action}</div>
    </div>

    <div className="flex items-stretch justify-between gap-2 border-t border-background transition-colors group-hover:border-primary/60">
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">{tags}</div>
      {meta && (
        <p className="flex items-center border-l border-background px-4 py-1.5 text-sm text-primary/70 transition-colors group-hover:border-primary/60">
          {meta}
        </p>
      )}
    </div>
  </article>
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
