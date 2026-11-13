import { PassageMenuPanel } from '@/modules/typing/components/PassageMenuPanel';
import type { PassageOption } from '@/modules/typing/types/typing.types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

interface PlacementPassageMenuProps {
  /** `undefined` while the list loads. Only names the selected passage on the button: the menu fetches its own list (search, sort). */
  passages?: PassageOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

/**
 * The placement passage whose leaderboard shows: same frame as the passage menu of the Typing page, the picked one in red
 * (SCRUM-304: opens centered under the tabs of the page, as wide as its names, with a search box and a sort inside and no filter by
 * origin: they are all TypeTrace's). The row of the page must be `relative`: the wrapper of the menu is `static`.
 */
export const PlacementPassageMenu = ({ passages, selectedId, onSelect }: PlacementPassageMenuProps) => {
  const selected = passages?.find((passage) => passage._id === selectedId);
  return (
    <DropdownMenu className="static">
      <div className="flex min-w-0 max-w-full outline outline-1 -outline-offset-1 outline-border">
        <DropdownMenuTrigger
          disabled={!passages?.length}
          title={selected?.title}
          aria-label="Choose passage"
          className="min-w-0 px-3 py-1.5 text-left text-[1.125rem] text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="block break-words">{selected?.title ?? '—'}</span>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent role="menu" aria-label="Placement passages" className="left-1/2 w-full -translate-x-1/2 sm:w-max sm:min-w-[24rem] sm:max-w-[min(32rem,calc(100vw-2rem))]">
        <PassageMenuPanel mode="placement" selectedId={selectedId} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
