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
  className,
}: SearchInputProps) => {
  const [text, setText] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={label}
        className="pl-9 pr-9"
        placeholder={placeholder}
        value={text}
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
