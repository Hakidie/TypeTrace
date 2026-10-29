import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

interface SearchInputProps {
  /** Starting text, e.g. the `q` value from the URL. */
  defaultValue?: string;
  /** Called with the trimmed text once the user stops typing (and at once when cleared). */
  onSearch: (value: string) => void;
  /** `'type'` (default) searches once the user stops typing; `'enter'` only when they press Enter (and on clear). */
  searchOn?: 'type' | 'enter';
  placeholder?: string;
  label?: string;
  delay?: number;
  /** The magnifier at the left of the box; `false` leaves it out (and its room). Default `true`. */
  icon?: boolean;
  /** Shows only the magnifier button until it is clicked; the box then extends and takes the focus, and shrinks back when it loses the focus empty. */
  collapsible?: boolean;
  /** A collapsible box only: a word (e.g. `Search`) shown next to the magnifier while the button is hovered or focused. */
  hoverLabel?: string;
  /** Extra classes for the wrapper, e.g. `sm:max-w-none` to let it fill its row. */
  className?: string;
}

/** Search box with a clear button; it searches after a debounce, or only on Enter with `searchOn="enter"`. */
export const SearchInput = ({
  defaultValue = '',
  onSearch,
  placeholder = 'Search…',
  label = 'Search',
  delay = 300,
  searchOn = 'type',
  icon = true,
  collapsible = false,
  hoverLabel,
  className,
}: SearchInputProps) => {
  const [text, setText] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A collapsible box starts open only when it already holds a search (e.g. from the URL).
  const [open, setOpen] = useState(!collapsible || defaultValue !== '');
  const focusOnMount = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    if (searchOn === 'enter') return;
    timer.current = setTimeout(() => onSearch(value.trim()), delay);
  };

  const clear = () => {
    setText('');
    clearTimeout(timer.current);
    onSearch('');
  };

  if (collapsible && !open) {
    return (
      <div className={cn('relative h-10 shrink-0', className)}>
        <button
          type="button"
          aria-label={label}
          className="group flex h-full items-center px-4 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            focusOnMount.current = true;
            setOpen(true);
          }}
        >
          <Search className="size-4 shrink-0" />
          {hoverLabel && (
            <span className="max-w-0 overflow-hidden text-base font-medium whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-20 group-focus-visible:opacity-100">
              {hoverLabel}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={cn('relative w-full sm:max-w-xs', collapsible && 'search-extend sm:w-56', className)}>
      {icon && <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input
        aria-label={label}
        className={cn('pr-9', icon ? 'pl-9' : 'pl-3')}
        placeholder={placeholder}
        value={text}
        ref={(input) => {
          if (input && focusOnMount.current) {
            focusOnMount.current = false;
            input.focus();
          }
        }}
        onBlur={() => {
          if (collapsible && !text) setOpen(false);
        }}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (searchOn === 'enter' && event.key === 'Enter') onSearch(text.trim());
        }}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={clear}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};
