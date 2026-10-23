import { ArrowUpDown, Check, ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { type FilterOption, SearchInput } from '@/shared/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

interface ListToolbarFilter {
  /** Title of the group in the Filter menu. */
  label: string;
  /** `''` means no filter. */
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface ListToolbarProps {
  /** A name for the list in a part of its own before the search box, in the theme red, e.g. `My Passages`. */
  title?: ReactNode;
  search?: {
    /** Starting text, e.g. the `q` value from the URL. */
    defaultValue?: string;
    onSearch: (value: string) => void;
    placeholder?: string;
    label?: string;
  };
  sort?: {
    /** Current sort, e.g. `-createdAt`. */
    value: string;
    /** Each option is one sort the backend allows, e.g. `{ value: 'email', label: 'Email A–Z' }`. */
    options: FilterOption[];
    onChange: (value: string) => void;
  };
  filters?: ListToolbarFilter[];
  /** Short text between the search box and the Sort button, e.g. a total count. */
  summary?: ReactNode;
  /** Buttons on the right, e.g. bulk actions. */
  actions?: ReactNode;
  /**
   * Own parts of the toolbar like Sort and Filter, between the summary and Sort, filled with a color: the decisions on
   * the chosen items (`Approve 2`, `Reject 2`). `destructive` is red, the others the theme red-orange.
   */
  decisions?: { label: string; onClick: () => void; destructive?: boolean }[];
}

// A 2px line in the page background color on the left of each control splits the toolbar into parts. Same look as an outline `Button`; the dropdown trigger is itself a button, so it cannot wrap one.
const controlClass = 'inline-flex h-10 items-center gap-2 whitespace-nowrap border-l-2 border-background bg-transparent px-4 text-base font-medium text-muted-foreground';
const buttonClass = cn(controlClass, 'transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring');
// Like the tag badges: filled with the theme red-orange while the button holds a non-default choice.
const activeClass = 'bg-primary text-primary-foreground hover:bg-primary hover:opacity-90';

const MenuOption = ({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) => (
  <DropdownMenuItem role="menuitemradio" aria-checked={selected} className="gap-2" onClick={onSelect}>
    <Check className={cn('size-4 shrink-0', !selected && 'invisible')} />
    {children}
  </DropdownMenuItem>
);

/**
 * Toolbar above a list, in one row: a search box (searches when the user presses Enter), an optional `summary` text, and Sort and Filter buttons
 * that open a menu of options. The buttons turn red-orange while they hold a non-default choice (the first
 * sort option is the default). All parts are optional. It only shows the controls and reports changes, so it works with
 * `useListParams` (URL state) or any other state. The Filter button shows how many filters are on.
 *
 *   <ListToolbar
 *     search={{ defaultValue: list.q, onSearch: (v) => list.set('q', v) }}
 *     sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (v) => list.set('sort', v) }}
 *     filters={[{ label: 'Role', value: role, options: ROLE_OPTIONS, onChange: (v) => list.set('role', v) }]}
 *   />
 */
export const ListToolbar = ({ title, search, sort, filters = [], summary, actions, decisions = [] }: ListToolbarProps) => {
  const activeFilters = filters.filter((filter) => filter.value !== '').length;
  // The first sort option is the default one.
  const sortChanged = sort !== undefined && sort.value !== sort.options[0]?.value;

  return (
    <div className="flex flex-col bg-primary/15 sm:flex-row sm:items-center">
      {title && <p className={cn(controlClass, 'border-l-0 border-r-2 text-primary')}>{title}</p>}
      {search && <SearchInput {...search} searchOn="enter" className="sm:max-w-none sm:flex-1 [&_input]:border-transparent [&_input]:bg-transparent" />}
      <div className="flex flex-wrap items-center sm:ml-auto sm:justify-end">
        {summary && <p className={controlClass}>{summary}</p>}
        {decisions.map((decision) => (
          <button
            key={decision.label}
            type="button"
            onClick={decision.onClick}
            className={cn(
              buttonClass,
              decision.destructive
                ? 'bg-destructive text-white hover:bg-destructive hover:opacity-90'
                : 'bg-primary text-primary-foreground hover:bg-primary hover:opacity-90',
            )}
          >
            {decision.label}
          </button>
        ))}
        {sort && (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonClass, sortChanged && activeClass)}>
              <ArrowUpDown className="size-4" />
              Sort
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" role="menu" aria-label="Sort options" className="min-w-44">
              {sort.options.map((option) => (
                <MenuOption key={option.value} selected={option.value === sort.value} onSelect={() => sort.onChange(option.value)}>
                  {option.label}
                </MenuOption>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {filters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonClass, activeFilters > 0 && activeClass)}>
              <ListFilter className="size-4" />
              Filter
              {activeFilters > 0 && (
                <span aria-label={`${activeFilters} active`} className="bg-primary-foreground px-1.5 text-sm text-primary">
                  {activeFilters}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" role="menu" aria-label="Filter options" className="min-w-48">
              {filters.map((filter, index) => (
                <div key={filter.label} role="group" aria-label={filter.label} className={cn(index > 0 && 'mt-1')}>
                  <p className="px-2 py-1 text-sm text-primary">{filter.label}</p>
                  <MenuOption selected={filter.value === ''} onSelect={() => filter.onChange('')}>
                    All
                  </MenuOption>
                  {filter.options.map((option) => (
                    <MenuOption key={option.value} selected={option.value === filter.value} onSelect={() => filter.onChange(option.value)}>
                      {option.label}
                    </MenuOption>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 border-l-2 border-background px-3">{actions}</div>}
    </div>
  );
};
