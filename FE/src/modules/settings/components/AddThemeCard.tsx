import { Plus } from 'lucide-react';
import { maxThemes } from '../lib/theme-rules';

interface AddThemeCardProps {
  onClick: () => void;
  /** The user already has the maximum number of themes. */
  full: boolean;
}

/** The last card of the list: a click turns it into the editor. */
export const AddThemeCard = ({ onClick, full }: AddThemeCardProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={full}
    title={full ? `You can have at most ${maxThemes} themes` : undefined}
    className="flex h-36 w-full items-center justify-center gap-1.5 border border-dashed border-border text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
  >
    <Plus className="size-5" />
    Custom theme
  </button>
);
