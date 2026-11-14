import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

/** The "Expand" / "Collapse" button at the bottom left of a list panel (with `Pagination` on the right): the list shows more rows a page while it is expanded. */
export const ExpandButton = ({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) => (
  <Button
    type="button"
    variant="ghost"
    aria-pressed={expanded}
    className="gap-2 bg-transparent px-2 text-primary hover:bg-transparent hover:text-primary hover:opacity-70"
    onClick={onToggle}
  >
    {expanded ? <ChevronsUp className="size-4" aria-hidden="true" /> : <ChevronsDown className="size-4" aria-hidden="true" />}
    {expanded ? 'Collapse' : 'Expand'}
  </Button>
);
