import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import type { ThemeColors, ThemeMode } from '@/shared/lib/theme';
import { themeProblems } from '../lib/theme-rules';
import type { ThemeInput } from '../types/theme.types';
import { ThemeCard } from './ThemeCard';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a color like #1a2b3c');

type ThemeFormValues = { name: string } & ThemeColors;

interface ThemeEditorProps {
  /** The mode in use: the colors must suit it. */
  mode: ThemeMode;
  /** The name the form starts with (empty for a new theme). */
  initialName?: string;
  /** Colors the form starts with. */
  initialColors: ThemeColors;
  /** Accessible name of the form: "New theme" or "Edit theme". */
  label?: string;
  /** Names already taken by the user's other themes (a name must be unique). */
  takenNames: string[];
  onSave: (theme: ThemeInput) => void;
  /** Called with the new colors each time one is picked, so the app can show them live. */
  onPreview: (colors: ThemeColors) => void;
  onCancel: () => void;
}

/** Create or edit a theme right in the grid: a live card to type the name on and to pick the four colors on, with a save and a cancel icon. */
export const ThemeEditor = ({ mode, initialName = '', initialColors, label = 'New theme', takenNames, onSave, onPreview, onCancel }: ThemeEditorProps) => {
  const schema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1, 'Theme name is required')
            .max(30, 'At most 30 characters')
            .refine((name) => !takenNames.some((taken) => taken.toLowerCase() === name.toLowerCase()), 'You already have a theme with this name'),
          background: hexColor,
          text: hexColor,
          muted: hexColor,
          accent: hexColor,
        })
        // The same rules as the backend: the background fits the mode and every color can be read on it.
        .superRefine((values, ctx) => {
          const colors = { background: values.background, text: values.text, muted: values.muted, accent: values.accent };
          for (const { field, message } of themeProblems(mode, colors)) ctx.addIssue({ code: 'custom', message, path: [field] });
        }),
    [takenNames, mode],
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ThemeFormValues>({ resolver: zodResolver(schema), defaultValues: { name: initialName, ...initialColors } });

  const values = useWatch({ control }) as ThemeFormValues;
  const colors: ThemeColors = { background: values.background, text: values.text, muted: values.muted, accent: values.accent };
  const problems = themeProblems(mode, colors);

  const submit = handleSubmit((data) =>
    onSave({ name: data.name.trim(), colors: { background: data.background, text: data.text, muted: data.muted, accent: data.accent } }),
  );

  return (
    <form onSubmit={submit} noValidate aria-label={label} className="space-y-2">
      <ThemeCard
        theme={{ name: values.name.trim() || 'Theme name', colors }}
        submitLabel="Save theme"
        onCancel={onCancel}
        onColorPick={(field, color) => {
          setValue(field, color, { shouldValidate: true });
          onPreview({ ...colors, [field]: color });
        }}
        nameSlot={
          // Type the name right on the card: same spot, size and color as the saved name.
          <input
            id="theme-name"
            aria-label="Name"
            placeholder="Theme name"
            autoComplete="off"
            aria-invalid={!!errors.name}
            className="absolute bottom-6 right-2 w-[55%] bg-transparent text-right text-lg font-medium placeholder:text-current focus-visible:outline-none"
            style={{ color: colors.text }}
            {...register('name')}
          />
        }
      />

      {(errors.name || problems.length > 0) && (
        <div className="space-y-1 text-sm">
          {errors.name?.message && (
            <p role="alert" className="text-destructive">
              {errors.name.message}
            </p>
          )}
          {problems.map(({ field, message }) => (
            <p key={field} role="status" className="flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              {message}
            </p>
          ))}
        </div>
      )}
    </form>
  );
};
