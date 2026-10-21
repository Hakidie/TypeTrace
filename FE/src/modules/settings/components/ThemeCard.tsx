import { Check, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ThemeColorField, ThemeColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { themeColorFields } from '../lib/theme-rules';

export interface ThemePreview {
  name: string;
  /** Chosen by the user, so they are data, not theme tokens. */
  colors: ThemeColors;
}

interface ThemeCardProps {
  theme: ThemePreview;
  current?: boolean;
  /** Extra classes, e.g. `h-full` to fill a taller container (the default height is `h-36`). */
  className?: string;
  /** Replaces the name text, e.g. with an input to type the name on the card. */
  nameSlot?: ReactNode;
  /** Accessible name for a button at the top right that submits the surrounding form (e.g. "Save theme"); the card gets the chosen border. */
  submitLabel?: string;
  /** With `submitLabel`: a cancel button next to the save button. */
  onCancel?: () => void;
  /** With `submitLabel`: no chosen border on the card. */
  plain?: boolean;
  /** With `submitLabel`: more buttons at the top right, before the cancel button (e.g. a mode switch). */
  actions?: ReactNode;
  /** Makes the four color columns at the bottom clickable color pickers. */
  onColorPick?: (field: ThemeColorField, color: string) => void;
}

/** One theme previewed in its own colors: a title in the muted color with a plain text line, a button on its background, a strip of the four colors, the name at the bottom right (or `nameSlot`), a check at the top right when it is the chosen one. */
export const ThemeCard = ({ theme, current = false, className, nameSlot, onColorPick, submitLabel, onCancel, actions, plain }: ThemeCardProps) => {
  const { background, text, muted, accent } = theme.colors;

  return (
    <div
      className={cn('relative flex h-36 flex-col overflow-hidden border', current || (submitLabel && !plain) ? 'border-primary' : 'border-transparent', className)}
      aria-current={current || undefined}
    >
      {current && (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center" style={{ backgroundColor: accent, color: background }}>
          <Check className="size-4" aria-hidden />
        </span>
      )}
      {submitLabel && (
        <div className="absolute right-2 top-2 flex gap-1">
          {actions}
          {onCancel && (
            <button
              type="button"
              aria-label="Cancel"
              title="Cancel"
              onClick={onCancel}
              className="flex size-6 items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: `color-mix(in srgb, ${text} 15%, transparent)`, color: text }}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            aria-label={submitLabel}
            title={submitLabel}
            className="flex size-6 items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: accent, color: background }}
          >
            <Save className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="flex flex-1 flex-col items-start gap-2 p-3" style={{ backgroundColor: background, color: text }}>
        <div>
          <p className="text-xl font-medium" style={{ color: muted }}>
            Passage
          </p>
          <p className="text-lg">Sample text</p>
        </div>
        {/* Same look as the selected ThemeTabs option: accent text on a 15% accent fill. */}
        <span
          className="px-3 py-1 text-base"
          style={{
            color: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
          }}
        >
          Button
        </span>
      </div>
      <div className={cn('flex shrink-0', onColorPick ? 'h-5' : 'h-3')}>
        {themeColorFields.map(({ name, label }) =>
          onColorPick ? (
            <label key={name} className="relative flex-1 cursor-pointer hover:brightness-125" style={{ backgroundColor: theme.colors[name] }} title={`${label} color`}>
              <input
                type="color"
                aria-label={`${label} picker`}
                value={theme.colors[name]}
                onChange={(event) => onColorPick(name, event.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          ) : (
            <div key={name} className="flex-1" style={{ backgroundColor: theme.colors[name] }} />
          ),
        )}
      </div>
      {nameSlot ?? (
        <span className="absolute bottom-5 right-2 max-w-[calc(100%-1rem)] truncate text-lg font-medium" style={{ color: text }}>
          {theme.name}
        </span>
      )}
    </div>
  );
};
