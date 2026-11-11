import { Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { Tip } from './Tip';
import { ThemeCard, type ThemePreview } from './ThemeCard';

export interface ThemeOption extends ThemePreview {
  id: string;
  /** Only the user's own themes can be edited and deleted. */
  own?: boolean;
}

interface ThemeGridProps<T extends ThemeOption> {
  /** Names the list for screen readers, e.g. "Themes". */
  label: string;
  themes: T[];
  /** The chosen theme; a list when more than one is (one per mode). */
  currentId: string | string[];
  onSelect: (theme: T) => void;
  onEdit: (theme: T) => void;
  onDelete: (theme: T) => void;
  /** The theme being edited: its card is replaced by `editor`. */
  editingId?: string | null;
  editor?: ReactNode;
  /** The last cell of the grid: the "add" card or the editor. */
  last?: ReactNode;
  /** The columns of the grid; 2, then 3, then 5 by default. */
  columnsClass?: string;
}

/** Right offsets of the buttons at the top right of a card: the first spot is taken by the check on the chosen card. */
const spots = ['right-2', 'right-9', 'right-16'];

const hoverButton =
  'absolute top-2 flex size-6 items-center justify-center opacity-0 transition-opacity hover:brightness-125 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100';

const isCurrent = (currentId: string | string[], id: string) => (Array.isArray(currentId) ? currentId.includes(id) : currentId === id);

export const ThemeGrid = <T extends ThemeOption>({ label, themes, currentId, onSelect, onEdit, onDelete, editingId, editor, last, columnsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' }: ThemeGridProps<T>) => (
  <ul aria-label={label} className={cn('grid gap-3', columnsClass)}>
    {themes.map((theme) => {
      if (theme.id === editingId) return <li key={theme.id}>{editor}</li>;
      // From the right: the check (chosen card only), then Edit, then Delete.
      const chosen = isCurrent(currentId, theme.id);
      const first = chosen ? 1 : 0;
      const style = { backgroundColor: `color-mix(in srgb, ${theme.colors.text} 15%, transparent)`, color: theme.colors.text };
      return (
        <li key={theme.id} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(theme)}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ThemeCard theme={theme} current={chosen} />
          </button>
          {/* Shown on hover (or keyboard focus). Siblings of the card button, since buttons cannot be nested. */}
          {theme.own && (
            <>
              <Tip label="Edit theme">
                <button type="button" aria-label={`Edit ${theme.name}`} onClick={() => onEdit(theme)} className={cn(hoverButton, spots[first])} style={style}>
                  <Pencil className="size-4" aria-hidden />
                </button>
              </Tip>
              <Tip label="Delete theme">
                <button type="button" aria-label={`Delete ${theme.name}`} onClick={() => onDelete(theme)} className={cn(hoverButton, spots[first + 1])} style={style}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </Tip>
            </>
          )}
        </li>
      );
    })}
    {last && <li>{last}</li>}
  </ul>
);
