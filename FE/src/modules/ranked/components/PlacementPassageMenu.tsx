import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import type { PassageOption } from '@/modules/typing/types/typing.types';

interface PlacementPassageMenuProps {
  /** `undefined` while the list loads. */
  passages?: PassageOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

/** The placement passage whose leaderboard shows: same frame as the passage menu of the Typing page, the picked one in red. */
export const PlacementPassageMenu = ({ passages, selectedId, onSelect }: PlacementPassageMenuProps) => {
  const selected = passages?.find((passage) => passage._id === selectedId);
  return (
    <DropdownMenu>
      <div className="flex min-w-0 max-w-full outline outline-1 -outline-offset-1 outline-border">
        <DropdownMenuTrigger
          disabled={!passages?.length}
          title={selected?.title}
          aria-label="Choose passage"
          className="max-w-64 min-w-0 px-3 py-1.5 text-[1.125rem] text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="block truncate">{selected?.title ?? '—'}</span>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent role="menu" aria-label="Placement passages" className="max-h-72 w-full min-w-0 overflow-y-auto">
        {passages?.map((passage) => (
          <DropdownMenuItem
            key={passage._id}
            role="menuitemradio"
            aria-checked={passage._id === selectedId}
            className={cn('gap-2', passage._id === selectedId && 'text-primary')}
            onClick={() => onSelect(passage._id)}
          >
            <span className="truncate">{passage.title}</span>
            <span className="ml-auto shrink-0 pl-4 text-sm text-muted-foreground">{passage.wordCount} words</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
