import { Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ThemeCard, type ThemePreview } from './ThemeCard';

export interface ThemeOption extends ThemePreview {
  id: string;
  /** Only the user's own themes can be edited and deleted. */
  own?: boolean;
}

interface ThemeGridProps {
  /** Names the list for screen readers, e.g. "Themes". */
  label: string;
  themes: ThemeOption[];
  currentId: string;
  onSelect: (theme: ThemeOption) => void;
  onEdit: (theme: ThemeOption) => void;
  onDelete: (theme: ThemeOption) => void;
  /** The theme being edited: its card is replaced by `editor`. */
  editingId?: string | null;
  editor?: ReactNode;
  /** The last cell of the grid: the "add" card or the editor. */
  last?: ReactNode;
}

/** Right offsets of the buttons at the top right of a card: the first spot is taken by the check on the chosen card. */
const spots = ['right-2', 'right-9', 'right-16'];

const hoverButton =
  'absolute top-2 flex size-6 items-center justify-center opacity-0 transition-opacity hover:brightness-125 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100';

export const ThemeGrid = ({ label, themes, currentId, onSelect, onEdit, onDelete, editingId, editor, last }: ThemeGridProps) => (
  <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {themes.map((theme) => {
      if (theme.id === editingId) return <li key={theme.id}>{editor}</li>;
      // From the right: the check (chosen card only), then Edit, then Delete.
      const first = theme.id === currentId ? 1 : 0;
      const style = { backgroundColor: `color-mix(in srgb, ${theme.colors.text} 15%, transparent)`, color: theme.colors.text };
      return (
        <li key={theme.id} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(theme)}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ThemeCard theme={theme} current={theme.id === currentId} />
          </button>
          {/* Shown on hover (or keyboard focus). Siblings of the card button, since buttons cannot be nested. */}
          {theme.own && (
            <>
              <button type="button" aria-label={`Edit ${theme.name}`} title="Edit theme" onClick={() => onEdit(theme)} className={cn(hoverButton, spots[first])} style={style}>
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label={`Delete ${theme.name}`} title="Delete theme" onClick={() => onDelete(theme)} className={cn(hoverButton, spots[first + 1])} style={style}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </>
          )}
        </li>
      );
    })}
    {last && <li>{last}</li>}
  </ul>
);
