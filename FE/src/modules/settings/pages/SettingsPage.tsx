import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { fallbackThemes, readCurrentColors } from '@/shared/lib/theme';
import { AddThemeCard } from '../components/AddThemeCard';
import { SecuritySettings } from '../components/SecuritySettings';
import { ThemeEditor } from '../components/ThemeEditor';
import { ThemeGrid, type ThemeOption } from '../components/ThemeGrid';
import { ThemeTabs } from '../components/ThemeTabs';
import { useThemeMode } from '../hooks/use-theme-mode';
import { useActiveThemes, useChooseTheme, useCreateTheme, useDeleteTheme, useThemes, useUpdateTheme } from '../hooks/use-themes';
import { maxThemes } from '../lib/theme-rules';
import { themeDraftStore, useThemeDraft } from '../store/theme-draft.store';
import type { ThemeColors } from '@/shared/lib/theme';
import type { Theme } from '../types/theme.types';

/** The id of the card for the built-in palette of the mode (Blood red or Sand): choosing it means "no theme". */
const fallbackId = 'fallback';

const toOption = (theme: Theme): ThemeOption => ({ id: theme._id, name: theme.name, colors: theme.colors, own: !theme.published });

export const SettingsPage = () => {
  const { data: user } = useCurrentUser();
  const { mode } = useThemeMode();
  const active = useActiveThemes();
  const themes = useThemes(mode === 'dark');
  const choose = useChooseTheme();
  const create = useCreateTheme();
  const update = useUpdateTheme();
  const remove = useDeleteTheme();

  // The editor in the grid is the unsaved draft (kept while moving between pages): `'new'` for a new theme, the id of a theme being edited, or nothing.
  const draft = useThemeDraft();
  const editing = draft && draft.mode === mode ? draft.editingId : null;
  const [deleting, setDeleting] = useState<ThemeOption | null>(null);

  // A draft is dropped when its theme is gone, or when it was made for the other mode.
  useEffect(() => {
    if (!draft) return;
    const gone = draft.editingId !== 'new' && themes.data && !themes.data.some((theme) => theme._id === draft.editingId);
    if (draft.mode !== mode || gone) themeDraftStore.clear();
  }, [draft, mode, themes.data]);

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
        themeDraftStore.clear();
      },
    });

  const saveTheme = (id: string, input: Parameters<typeof create.mutate>[0]) =>
    update.mutate({ id, input }, { onSuccess: themeDraftStore.clear });

  const startEditing = (id: string, name: string, colors: ThemeColors) => themeDraftStore.set({ mode, editingId: id, name, colors });

  const beingEdited = themes.data.find((theme) => theme._id === editing);
  const editor = (
    <ThemeEditor
      key={editing}
      mode={mode}
      label={beingEdited ? 'Edit theme' : 'New theme'}
      initialName={draft?.name}
      initialColors={draft?.colors ?? readCurrentColors(mode)}
      takenNames={mine.filter((theme) => theme._id !== editing).map((theme) => theme.name)}
      onSave={(input) => (beingEdited ? saveTheme(beingEdited._id, input) : addTheme(input))}
      onCancel={themeDraftStore.clear}
      onPreview={() => undefined}
      onChange={({ name, colors }) => themeDraftStore.set({ mode, editingId: editing!, name, colors })}
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
          onEdit={(option) => startEditing(option.id, option.name, option.colors)}
          onDelete={setDeleting}
          editingId={editing}
          editor={editor}
          last={editing === 'new' ? editor : <AddThemeCard full={mine.length >= maxThemes} onClick={() => startEditing('new', '', readCurrentColors(mode))} />}
        />
      </Panel>

      <Panel title="Security" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        {user ? <SecuritySettings user={user} /> : <LoadingState rows={1} />}
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
