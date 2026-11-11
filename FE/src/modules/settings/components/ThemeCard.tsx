import { Check, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ThemeColorField, ThemeColors } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { Tip } from './Tip';
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
  /** A taller card with bigger text (the admin form, `h-64`) instead of the one of a grid (`h-36`). */
  large?: boolean;
  /** Makes the four color columns at the bottom clickable color pickers. */
  onColorPick?: (field: ThemeColorField, color: string) => void;
}

/** One theme previewed in its own colors: a title in the muted color with a plain text line, a button on its background, a strip of the four colors, the name at the bottom right (or `nameSlot`), a check at the top right when it is the chosen one. */
export const ThemeCard = ({ theme, current = false, className, nameSlot, onColorPick, submitLabel, onCancel, actions, plain, large }: ThemeCardProps) => {
  const { background, text, muted, accent } = theme.colors;
  // The buttons at the top right: bigger on a large card.
  const buttonSize = large ? 'size-9' : 'size-6';
  const iconSize = large ? 'size-5' : 'size-4';

  return (
    <div
      className={cn('relative flex flex-col overflow-hidden border', large ? 'h-64' : 'h-36', current || (submitLabel && !plain) ? 'border-primary' : 'border-transparent', className)}
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
            <Tip label="Cancel">
              <button
                type="button"
                aria-label="Cancel"
                onClick={onCancel}
                className={cn('flex items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', buttonSize)}
                style={{ backgroundColor: `color-mix(in srgb, ${text} 15%, transparent)`, color: text }}
              >
                <X className={iconSize} aria-hidden />
              </button>
            </Tip>
          )}
          <Tip label={submitLabel}>
            <button
              type="submit"
              aria-label={submitLabel}
              className={cn('flex items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', buttonSize)}
              style={{ backgroundColor: accent, color: background }}
            >
              <Save className={iconSize} aria-hidden />
            </button>
          </Tip>
        </div>
      )}
      <div className="flex flex-1 flex-col items-start gap-2 p-3" style={{ backgroundColor: background, color: text }}>
        <div>
          <p className={cn('font-medium', large ? 'text-3xl' : 'text-xl')} style={{ color: muted }}>
            Passage
          </p>
          <p className={large ? 'text-2xl' : 'text-lg'}>Sample text</p>
        </div>
        {/* Same look as the selected ThemeTabs option: accent text on a 15% accent fill. */}
        <span
          className={cn('px-3 py-1', large ? 'px-4 py-1.5 text-xl' : 'text-base')}
          style={{
            color: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
          }}
        >
          Button
        </span>
      </div>
      <div className={cn('flex shrink-0', onColorPick ? (large ? 'h-8' : 'h-5') : 'h-3')}>
        {themeColorFields.map(({ name, label }) =>
          onColorPick ? (
            <Tip key={name} label={`${label} color`}>
              <label className="relative flex-1 cursor-pointer hover:brightness-125" style={{ backgroundColor: theme.colors[name] }}>
                <input
                  type="color"
                  aria-label={`${label} picker`}
                  value={theme.colors[name]}
                  onChange={(event) => onColorPick(name, event.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </label>
            </Tip>
          ) : (
            <div key={name} className="flex-1" style={{ backgroundColor: theme.colors[name] }} />
          ),
        )}
      </div>
      {nameSlot ?? (
        <span className={cn('absolute right-2 max-w-[calc(100%-1rem)] truncate font-medium', large ? 'bottom-10 text-2xl' : 'bottom-5 text-lg')} style={{ color: text }}>
          {theme.name}
        </span>
      )}
    </div>
  );
};
