import { ArrowUpDown, ListFilter, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { type FilterOption, SearchInput } from '@/shared/components/data-table';
import { type ListToolbarFilter, MenuOption } from '@/shared/components/list-toolbar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

interface CompactToolbarProps {
  search?: {
    /** Starting text, e.g. the `q` value from the URL. */
    defaultValue?: string;
    /** Called with the trimmed text when the user presses Enter (and at once when the box is cleared). */
    onSearch: (value: string) => void;
    placeholder?: string;
    /** The name of the search button and box for screen readers, e.g. `Search sessions`. */
    label?: string;
  };
  sort?: {
    /** Current sort, e.g. `-createdAt`. */
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  };
  filters?: ListToolbarFilter[];
  /** A total at the end of the toolbar: an icon and a number, and the word (e.g. `Sessions`) next to them while hovered. */
  count?: { icon: LucideIcon; value: ReactNode; label: string };
}

// Every part is an icon in the red of the theme, with no background color (also not while hovered or active).
const partClass = 'group inline-flex h-10 items-center whitespace-nowrap bg-transparent px-4 text-base font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The word of a part: it grows from nothing next to the icon while the part (a `group`) is hovered or focused. */
const Word = ({ children }: { children: ReactNode }) => (
  <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-20 group-focus-visible:opacity-100">
    {children}
  </span>
);

/**
 * A small toolbar for a list under a title (the sessions of the profile), in one row on the right: Search, Sort, Filter and
 * a total, each only its icon; the word of a part grows next to the icon while it is hovered or focused. No background
 * color anywhere, and the last part has no padding on the right, so the row ends at the edge of the page content. Search
 * is a magnifier until it is clicked, then a box (Enter searches). Like `ListToolbar`, it only shows the controls and
 * reports changes, so it works with `useListParams`. A filter that is on shows how many filters are on, next to its icon.
 *
 *   <CompactToolbar
 *     search={{ label: 'Search sessions', defaultValue: list.q, onSearch: (v) => list.set('q', v) }}
 *     sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (v) => list.set('sort', v) }}
 *     filters={[{ label: 'Mode', value: mode, options: MODE_OPTIONS, onChange: (v) => list.set('mode', v) }]}
 *     count={{ icon: History, value: total, label: 'Sessions' }}
 *   />
 */
export const CompactToolbar = ({ search, sort, filters = [], count }: CompactToolbarProps) => {
  const activeFilters = filters.filter((filter) => filter.value !== '').length;
  const CountIcon = count?.icon;

  return (
    <div className="flex flex-wrap items-center sm:justify-end [&>:last-child]:pr-0">
      {search && (
        <SearchInput
          {...search}
          searchOn="enter"
          collapsible
          hoverLabel="Search"
          className="[&_button]:text-primary [&_input]:border-transparent [&_input]:bg-transparent [&_input]:text-primary [&_input]:placeholder:text-primary/70 [&_input]:focus-visible:ring-0 [&_svg]:text-primary [&>button]:hover:text-primary"
        />
      )}
      {sort && (
        <DropdownMenu>
          <DropdownMenuTrigger className={partClass} aria-label="Sort">
            <ArrowUpDown className="size-4" />
            <Word>Sort</Word>
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
          <DropdownMenuTrigger className={partClass} aria-label="Filter">
            <ListFilter className="size-4" />
            <Word>Filter</Word>
            {activeFilters > 0 && (
              <span aria-label={`${activeFilters} active`} className="ml-1.5 text-sm">
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
      {count && CountIcon && (
        <p className={partClass}>
          <CountIcon className="mr-2 size-4" aria-hidden />
          {count.value}
          <Word>{count.label}</Word>
        </p>
      )}
    </div>
  );
};
