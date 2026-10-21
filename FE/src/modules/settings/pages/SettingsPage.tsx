import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { panelTitleClass } from '@/shared/lib/panel-styles';
import { fallbackThemes, paintTheme, readCurrentColors } from '@/shared/lib/theme';
import { AddThemeCard } from '../components/AddThemeCard';
import { ThemeEditor } from '../components/ThemeEditor';
import { ThemeGrid, type ThemeOption } from '../components/ThemeGrid';
import { ThemeTabs } from '../components/ThemeTabs';
import { appliedColors, useThemeMode } from '../hooks/use-theme-mode';
import { useActiveThemes, useChooseTheme, useCreateTheme, useDeleteTheme, useThemes, useUpdateTheme } from '../hooks/use-themes';
import { maxThemes } from '../lib/theme-rules';
import type { Theme } from '../types/theme.types';

/** The id of the card for the built-in palette of the mode (Blood red or Sand): choosing it means "no theme". */
const fallbackId = 'fallback';

const toOption = (theme: Theme): ThemeOption => ({ id: theme._id, name: theme.name, colors: theme.colors, own: !theme.published });

export const SettingsPage = () => {
  const { mode } = useThemeMode();
  const active = useActiveThemes();
  const themes = useThemes(mode === 'dark');
  const choose = useChooseTheme();
  const create = useCreateTheme();
  const update = useUpdateTheme();
  const remove = useDeleteTheme();

  /** The editor in the grid: `'new'` for a new theme, the id of a theme being edited, or nothing. */
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ThemeOption | null>(null);

  // Switching the mode (here or in the header) closes the editor: its colors were made for the other mode.
  const [seenMode, setSeenMode] = useState(mode);
  if (seenMode !== mode) {
    setSeenMode(mode);
    setEditing(null);
  }

  const error = active.error ?? themes.error;
  if (error) return <ErrorState error={error} onRetry={() => { void active.refetch(); void themes.refetch(); }} />;
  if (!active.data || !themes.data) return <LoadingState />;

  const chosen = mode === 'dark' ? active.data.dark : active.data.light;
  const currentId = chosen?._id ?? fallbackId;
  const fallback: ThemeOption = { id: fallbackId, ...fallbackThemes[mode] };
  const mine = themes.data.filter((theme) => !theme.published);
  // One list: the built-in palette, then TypeTrace's themes, then the user's own (the server sends them in that order).
  const options = [fallback, ...themes.data.map(toOption)];

  const selectTheme = (option: ThemeOption) => {
    if (option.id !== currentId) choose.mutate({ mode, theme: themes.data.find((theme) => theme._id === option.id) ?? null });
  };

  const addTheme = (input: Parameters<typeof create.mutate>[0]) =>
    create.mutate(input, {
      onSuccess: (theme) => {
        choose.mutate({ mode, theme });
        setEditing(null);
      },
    });

  const saveTheme = (id: string, input: Parameters<typeof create.mutate>[0]) =>
    update.mutate({ id, input }, { onSuccess: () => setEditing(null) });

  /** Closing without saving puts the theme that was in use back. */
  const cancelEditing = () => {
    paintTheme(mode, appliedColors(active.data));
    setEditing(null);
  };

  const beingEdited = themes.data.find((theme) => theme._id === editing);
  const editor = (
    <ThemeEditor
      key={editing}
      mode={mode}
      label={beingEdited ? 'Edit theme' : 'New theme'}
      initialName={beingEdited?.name}
      initialColors={beingEdited?.colors ?? readCurrentColors(mode)}
      takenNames={mine.filter((theme) => theme._id !== editing).map((theme) => theme.name)}
      onSave={(input) => (beingEdited ? saveTheme(beingEdited._id, input) : addTheme(input))}
      onCancel={cancelEditing}
      onPreview={(colors) => paintTheme(mode, colors)}
    />
  );

  return (
    <div className="space-y-6">
      <Panel title="Appearance" bare titleClassName={panelTitleClass} className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl font-medium">Theme</p>
            <p className="text-lg text-muted-foreground">Switch between light and dark, then pick a theme for each.</p>
          </div>
          <ThemeTabs />
        </div>

        <ThemeGrid
          label="Themes"
          themes={options}
          currentId={currentId}
          onSelect={selectTheme}
          onEdit={(option) => setEditing(option.id)}
          onDelete={setDeleting}
          editingId={editing}
          editor={editor}
          last={editing === 'new' ? editor : <AddThemeCard full={mine.length >= maxThemes} onClick={() => setEditing('new')} />}
        />
      </Panel>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this theme?"
        description={deleting ? `"${deleting.name}" will be removed from your themes.${deleting.id === currentId ? ` You will go back to ${fallback.name}.` : ''}` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
};
