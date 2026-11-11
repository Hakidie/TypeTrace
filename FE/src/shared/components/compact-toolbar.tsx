import { ArrowUpDown, ChevronLeft, ListFilter, type LucideIcon, Plus, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { type FilterOption, SearchInput } from '@/shared/components/data-table';
import { type ListToolbarFilter, MenuOption } from '@/shared/components/list-toolbar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

/** A menu of its own in the look of Sort: its icon and the choice it holds, in words, always (a picker, so the choice must show). */
export interface CompactToolbarMenu {
  /** The name of the menu for screen readers, e.g. `Chart range`. */
  label: string;
  icon: LucideIcon;
  /** The choice that is on, in words, next to the icon. */
  valueLabel: string;
  /** False dims the menu: it is one of several that stand for one choice, and another one is on. Default true. */
  active?: boolean;
  options: FilterOption[];
  /** The `value` of the option that is on. */
  value: string;
  onChange: (value: string) => void;
  /** The items of the menu when it is not a plain list of options (a hint, a setting saved as it is picked); they replace `options`. */
  children?: ReactNode;
}

/** A "+" button that opens a menu of groups (Year, Month, Week); a group opens a second menu beside it with its options to add, e.g. the years to put on a chart. The ones added show as `tags`. */
export interface CompactToolbarAdder {
  /** The name of the button, shown next to its +, and of its menu for screen readers, e.g. `Add comparison`. */
  label: string;
  /** No more can be added: the button is off. */
  disabled?: boolean;
  groups: {
    label: string;
    /** What the group is set to right now, on its row (e.g. the year whose months the Month group lists). */
    valueLabel?: string;
    options: FilterOption[];
    /** The `value`s already added (checked: picking one again takes it away). */
    selected: string[];
    onPick: (value: string) => void;
  }[];
}

/** What was added, as a tag on the left of the "+" with its own x to take it away (the x shows while the tag is hovered or focused). */
export interface CompactToolbarTag {
  id: string;
  label: string;
  /** A sample of how it shows (e.g. a line of the chart), before the words. */
  sample?: ReactNode;
  onRemove: () => void;
}

interface CompactToolbarProps {
  /** Menus of their own, before Search: a range, a period. After the tags and the "+" when there are any. */
  menus?: CompactToolbarMenu[];
  /** A "+" before `menus` (add a time range to the chart), and the tags of what was added on its left. */
  adder?: CompactToolbarAdder;
  tags?: CompactToolbarTag[];
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
  /** Extra classes for the row, e.g. `sm:justify-start [&>:first-child]:pl-0` to put the parts at the left edge instead of the right one. */
  className?: string;
  /** Buttons filled with a color before the other parts: the decisions on the chosen items (`Approve 2`, `Reject 2`). `destructive` is red, the others the theme red-orange. */
  decisions?: { label: string; onClick: () => void; destructive?: boolean }[];
  /** Every part shows its word next to its icon all the time (Search, Sort, Filter, the count), as on the admin pages, not only while hovered. */
  showWords?: boolean;
  /** Buttons that do something when pressed (not a menu), in the look of the other parts: an icon and what they show now, which grows next to it while hovered or focused (always with `showWords`; `label` names the button for screen readers). */
  buttons?: { label: string; icon: LucideIcon; valueLabel: ReactNode; onClick: () => void; disabled?: boolean }[];
  /** A total at the end of the toolbar: an icon and a number, and the word (e.g. `Sessions`) next to them while hovered. */
  count?: { icon: LucideIcon; value: ReactNode; label: string };
}

// Every part is an icon in the red of the theme, with no background color (also not while hovered or active).
const partClass = 'group inline-flex h-10 items-center whitespace-nowrap bg-transparent px-4 text-base font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The word of a part: it grows from nothing next to the icon while the part (a `group`) is hovered or focused, or is always there (`always`). */
const Word = ({ children, always, className }: { children: ReactNode; always?: boolean; className?: string }) => (
  <span
    className={cn(
      'whitespace-nowrap',
      always
        ? 'ml-2'
        : 'max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-20 group-focus-visible:opacity-100',
      className,
    )}
  >
    {children}
  </span>
);

const MenuPart = ({ menu }: { menu: CompactToolbarMenu }) => (
  <DropdownMenu>
    <DropdownMenuTrigger className={cn(partClass, menu.active === false && 'opacity-60')} aria-label={menu.label}>
      <menu.icon className="size-4" />
      <span className="ml-2">{menu.valueLabel}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" role="menu" aria-label={`${menu.label} options`} className="min-w-44">
      {menu.children ??
        menu.options.map((option) => (
          <MenuOption key={option.value} selected={option.value === menu.value} onSelect={() => menu.onChange(option.value)}>
            {option.label}
          </MenuOption>
        ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const AdderPart = ({ adder }: { adder: CompactToolbarAdder }) => {
  // The group whose options show in the second menu beside the first.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const group = adder.groups.find((item) => item.label === openGroup);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(partClass, 'disabled:opacity-40')} aria-label={adder.label} disabled={adder.disabled}>
        <Plus className="size-4" />
        <span className="ml-2">{adder.label}</span>
      </DropdownMenuTrigger>
      {/* `overflow-visible`: the second menu opens outside the first, on its left (the toolbar ends at the right edge). */}
      <DropdownMenuContent align="end" role="menu" aria-label={`${adder.label} options`} className="min-w-32 overflow-visible">
        {adder.groups.map((item) => (
          <div
            key={item.label}
            role="menuitem"
            tabIndex={0}
            aria-label={item.label}
            aria-haspopup="menu"
            aria-expanded={item.label === openGroup}
            onClick={() => setOpenGroup(item.label)}
            onMouseEnter={() => setOpenGroup(item.label)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowLeft') setOpenGroup(item.label);
            }}
            className={cn(
              'flex cursor-pointer select-none items-center justify-between gap-4 px-2 py-1.5 text-base text-muted-foreground outline-none transition-colors hover:bg-primary/15 hover:text-primary focus-visible:bg-primary/15 focus-visible:text-primary',
              item.label === openGroup && 'bg-primary/15 text-primary',
            )}
          >
            {item.label}
            <span className="flex items-center gap-2">
              {item.valueLabel && <span className="text-sm text-primary">{item.valueLabel}</span>}
              <ChevronLeft className="size-4" aria-hidden />
            </span>
          </div>
        ))}
        {group && (
          <div
            role="menu"
            aria-label={`${group.label} periods`}
            className="absolute right-full top-0 mr-1 max-h-72 min-w-48 overflow-y-auto border border-border bg-background/75 p-1 shadow-md backdrop-blur-xs transition-colors hover:border-destructive/40"
          >
            {group.options.map((option) => (
              <MenuOption key={option.value} selected={group.selected.includes(option.value)} onSelect={() => group.onPick(option.value)}>
                {option.label}
              </MenuOption>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
export const CompactToolbar = ({ menus = [], adder, tags = [], buttons = [], search, sort, filters = [], count, decisions = [], showWords, className }: CompactToolbarProps) => {
  const activeFilters = filters.filter((filter) => filter.value !== '').length;
  const CountIcon = count?.icon;

  return (
    <div className={cn('flex flex-wrap items-center sm:justify-end [&>:last-child]:pr-0', className)}>
      {tags.map((tag) => (
        <span key={tag.id} className="group inline-flex h-10 items-center gap-2 whitespace-nowrap px-2 text-base text-primary">
          {tag.sample}
          {tag.label}
          <button
            type="button"
            aria-label={`Remove ${tag.label}`}
            onClick={tag.onRemove}
            className="inline-flex size-5 items-center justify-center bg-transparent text-primary opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {decisions.map((decision) => (
        <button
          key={decision.label}
          type="button"
          onClick={decision.onClick}
          className={cn(
            'mr-2 inline-flex h-8 items-center whitespace-nowrap px-3 text-base font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            decision.destructive ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
          )}
        >
          {decision.label}
        </button>
      ))}
      {adder && <AdderPart adder={adder} />}
      {menus.map((menu) => (
        <MenuPart key={menu.label} menu={menu} />
      ))}
      {buttons.map((button) => (
        <button key={button.label} type="button" className={cn(partClass, 'disabled:opacity-40')} aria-label={button.label} onClick={button.onClick} disabled={button.disabled}>
          <button.icon className="size-4" />
          <Word always={showWords} className="group-hover:max-w-40 group-focus-visible:max-w-40">
            {button.valueLabel}
          </Word>
        </button>
      ))}
      {search && (
        <SearchInput
          {...search}
          searchOn="enter"
          collapsible
          hoverLabel="Search"
          alwaysShowLabel={showWords}
          className="[&_button]:text-primary [&_input]:border-transparent [&_input]:bg-transparent [&_input]:text-primary [&_input]:placeholder:text-primary/70 [&_input]:focus-visible:ring-0 [&_svg]:text-primary [&>button]:hover:text-primary"
        />
      )}
      {sort && (
        <DropdownMenu>
          <DropdownMenuTrigger className={partClass} aria-label="Sort">
            <ArrowUpDown className="size-4" />
            <Word always={showWords}>Sort</Word>
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
            <Word always={showWords}>Filter</Word>
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
          <Word always={showWords}>{count.label}</Word>
        </p>
      )}
    </div>
  );
};
