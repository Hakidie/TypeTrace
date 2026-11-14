import { useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, Keyboard, Moon, Palette, ShieldCheck, Shirt, Sun } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { WardrobeVersionSetting } from '@/modules/avatar/components/WardrobeVersionSetting';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { TutorialReplay } from '@/modules/tutorial/components/TutorialReplay';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { fallbackThemes, readCurrentColors } from '@/shared/lib/theme';
import { SecuritySettings } from '../components/SecuritySettings';
import { ThemeEditor } from '../components/ThemeEditor';
import { ThemeGrid, type ThemeOption } from '../components/ThemeGrid';
import { ThemeTabs } from '../components/ThemeTabs';
import { Tip } from '../components/Tip';
import { TypingSettings } from '../components/TypingSettings';
import { useThemeMode } from '../hooks/use-theme-mode';
import { useActiveThemes, useChooseTheme, useCreateTheme, useDeleteTheme, useThemes, useUpdateTheme } from '../hooks/use-themes';
import { maxThemes } from '../lib/theme-rules';
import { themeDraftStore, useThemeDraft } from '../store/theme-draft.store';
import type { ThemeMode } from '@/shared/lib/theme';
import type { Theme } from '../types/theme.types';

/** The id of the card for the built-in palette of a mode (Blood red or Sand): choosing it means "no theme". */
const fallbackIds: Record<ThemeMode, string> = { dark: 'fallback-dark', light: 'fallback-light' };

/** A card of the list with the mode it belongs to. */
type ModeOption = ThemeOption & { mode: ThemeMode };

// The grid of themes: 3 columns and 2 rows.
const PAGE_SIZE = 6;

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
];

const SOURCE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'mine', label: 'Mine' },
];

const MODE_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const tabs = [
  { value: 'typing', label: 'Typing', icon: Keyboard },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'tutorial', label: 'Tutorial', icon: GraduationCap },
];

const toOption = (theme: Theme): ModeOption => ({ id: theme._id, name: theme.name, colors: theme.colors, own: !theme.published, mode: theme.isDark ? 'dark' : 'light' });

export const SettingsPage = () => {
  const { data: user } = useCurrentUser();
  // The tab shown is kept in the URL (`?tab=security`), so a reload or a link opens the same setting.
  const [params, setParams] = useSearchParams();
  // Appearance is the tab shown when none is chosen, though Typing comes first in the row.
  const tab = tabs.find((item) => item.value === params.get('tab'))?.value ?? 'appearance';
  const { mode } = useThemeMode();
  const active = useActiveThemes();
  // Both modes are loaded: the Mode filter picks which ones the list shows (the page's mode at first).
  const darkThemes = useThemes(true);
  const lightThemes = useThemes(false);
  const choose = useChooseTheme();
  const create = useCreateTheme();
  const update = useUpdateTheme();
  const remove = useDeleteTheme();

  // The editor in the grid is the unsaved draft (kept while moving between pages): `'new'` for a new theme, the id of a theme being edited, or nothing.
  const draft = useThemeDraft();
  const editing = draft ? draft.editingId : null;
  const [deleting, setDeleting] = useState<ModeOption | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('default');
  const [source, setSource] = useState('');
  // `null` follows the page's mode; '' shows both.
  const [modeFilter, setModeFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<ThemeMode | null>(null);
  // Changes after a save or a cancel so the editor starts again with fresh fields.
  const [round, setRound] = useState(0);

  // The editor starts again, empty, when its draft is dropped (a save, a cancel, a logout or a change of mode).
  const [hadDraft, setHadDraft] = useState(draft !== null);
  if (hadDraft !== (draft !== null)) {
    setHadDraft(draft !== null);
    if (hadDraft) setRound((value) => value + 1);
  }

  const allThemes = useMemo(
    () => (darkThemes.data && lightThemes.data ? [...darkThemes.data, ...lightThemes.data] : undefined),
    [darkThemes.data, lightThemes.data],
  );

  // A draft is dropped when the theme it edits is gone.
  useEffect(() => {
    if (!draft || !allThemes) return;
    if (draft.editingId !== 'new' && !allThemes.some((theme) => theme._id === draft.editingId)) themeDraftStore.clear();
  }, [draft, allThemes]);

  const error = active.error ?? darkThemes.error ?? lightThemes.error;
  if (error) return <ErrorState error={error} onRetry={() => { void active.refetch(); void darkThemes.refetch(); void lightThemes.refetch(); }} />;
  if (!active.data || !allThemes) return <LoadingState />;
  const themes = { data: allThemes };

  // The id of the card chosen for a mode.
  const chosenIdOf = (of: ThemeMode) => (of === 'dark' ? active.data.dark : active.data.light)?._id ?? fallbackIds[of];
  const currentIds = [chosenIdOf('dark'), chosenIdOf('light')];
  const mine = themes.data.filter((theme) => !theme.published);
  // One list per mode: the built-in palette, then TypeTrace's themes, then the user's own (the server sends them in that order); dark first.
  const optionsOf = (of: ThemeMode): ModeOption[] => {
    const group = of === 'dark' ? darkThemes.data! : lightThemes.data!;
    return [{ id: fallbackIds[of], ...fallbackThemes[of], mode: of }, ...group.map(toOption)];
  };
  const options = [...optionsOf('dark'), ...optionsOf('light')];

  const selectTheme = (option: ModeOption) => {
    // Choosing a card also puts the page in the card's mode, so what was picked is what shows.
    if (currentIds.includes(option.id) && option.mode === mode) return;
    choose.mutate({ mode: option.mode, theme: themes.data.find((theme) => theme._id === option.id) ?? null, useMode: true });
  };

  const beingEdited = themes.data.find((theme) => theme._id === editing);
  // The mode the form makes a theme for: the one being edited, or the draft's, or the one picked with the form's button, else the opposite of the page's. It never changes the page's mode.
  const formMode: ThemeMode = beingEdited ? (beingEdited.isDark ? 'dark' : 'light') : draft?.mode ?? picked ?? (mode === 'dark' ? 'light' : 'dark');
  const full = mine.length >= maxThemes;
  const sorted = sort === 'default' ? options : [...options].sort((a, b) => a.name.localeCompare(b.name) * (sort === 'name' ? 1 : -1));
  // The built-in palettes and TypeTrace's themes are the system's, not the user's own.
  const shownMode = modeFilter ?? mode;
  const shown = sorted.filter(
    (option) =>
      option.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (source === '' || (source === 'mine') === Boolean(option.own)) &&
      (shownMode === '' || option.mode === shownMode),
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageThemes = shown.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE);

  const startEditing = (option: ThemeOption) => {
    const theme = themes.data.find((item) => item._id === option.id);
    if (!theme) return;
    themeDraftStore.set({ mode: theme.isDark ? 'dark' : 'light', editingId: theme._id, name: theme.name, colors: theme.colors });
    // The editor is above the list: bring it into view.
    editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const finish = () => {
    themeDraftStore.clear();
    setPicked(null);
  };

  const editor = (
    <ThemeEditor
      key={`${beingEdited?._id ?? 'new'}-${formMode}-${round}`}
      mode={formMode}
      large
      label={beingEdited ? 'Edit theme' : 'New theme'}
      initialName={draft?.name}
      initialColors={draft?.colors ?? (formMode === mode ? readCurrentColors(mode) : fallbackThemes[formMode].colors)}
      takenNames={mine.filter((theme) => theme._id !== editing).map((theme) => theme.name)}
      onSave={(input) =>
        beingEdited
          ? update.mutate({ id: beingEdited._id, input }, { onSuccess: finish })
          : create.mutate({ ...input, mode: formMode }, { onSuccess: (theme) => { choose.mutate({ mode: formMode, theme }); finish(); } })
      }
      // Only an edit can be cancelled; a new theme just stays as it is.
      onCancel={beingEdited ? finish : undefined}
      onPreview={() => undefined}
      // One button for the mode, like the admin Themes page: it shows the mode of the form and switches the form to the other. It does not change the page's mode. Only for a new theme: the mode of an existing one cannot change.
      actions={(colors) =>
        !beingEdited && (
          <Tip label={`Switch to ${formMode === 'dark' ? 'Light' : 'Dark'}`}>
            <button
              type="button"
              aria-label={`Mode: ${formMode === 'dark' ? 'Dark' : 'Light'}`}
              onClick={() => {
                setPicked(formMode === 'dark' ? 'light' : 'dark');
                // The colors made for one mode do not fit the other.
                themeDraftStore.clear();
              }}
              className="flex size-9 items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: `color-mix(in srgb, ${colors.text} 15%, transparent)`, color: colors.text }}
            >
              {formMode === 'dark' ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
            </button>
          </Tip>
        )
      }
      onChange={({ name, colors }) => themeDraftStore.set({ mode: formMode, editingId: editing ?? 'new', name, colors })}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <TabGroup label="Settings" tabs={tabs} value={tab} onChange={(value) => setParams({ tab: value }, { replace: true })} iconsOnPhones />
      </div>

      {tab === 'appearance' && (
        <div className="flex flex-col gap-8">
          {/* PANEL Theme form: no visible title (the editor says what it is); screen readers still get one. */}
          <div ref={editorRef} className="scroll-mt-4">
            <Panel title={beingEdited ? 'Edit theme' : 'Theme'} bare titleClassName={sectionTitleClass} className="flex flex-col gap-3" actions={<ThemeTabs />}>
              {full && !beingEdited ? (
                <p className="text-lg text-muted-foreground">You can have at most {maxThemes} themes. Delete one to make another.</p>
              ) : (
                editor
              )}
            </Panel>
          </div>

          {/* PANEL Themes */}
          <Panel
            title="Themes"
            bare
            titleClassName={sectionTitleClass}
            className="flex flex-col gap-3"
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <CompactToolbar
                  search={{ label: 'Search themes', placeholder: 'Search name…', defaultValue: search, onSearch: (value) => { setSearch(value); setPage(1); } }}
                  sort={{ value: sort, options: SORT_OPTIONS, onChange: (value) => { setSort(value); setPage(1); } }}
                  filters={[
                    { label: 'Mode', value: shownMode, options: MODE_OPTIONS, onChange: (value) => { setModeFilter(value); setPage(1); } },
                    { label: 'Source', value: source, options: SOURCE_OPTIONS, onChange: (value) => { setSource(value); setPage(1); } },
                  ]}
                  count={{ icon: Palette, value: shown.length, label: 'Themes' }}
                />
              </div>
            }
          >
            {shown.length === 0 ? (
              <EmptyState icon={Palette} title="No matching themes" description="Try another search." />
            ) : (
              <>
                <ThemeGrid
                  label="Themes"
                  themes={pageThemes}
                  columnsClass="grid-cols-3"
                  currentId={currentIds}
                  onSelect={selectTheme}
                  onEdit={startEditing}
                  onDelete={setDeleting}
                />
                <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onPageChange={setPage} variant="toolbar" accent plain flushRight />
              </>
            )}
          </Panel>
        </div>
      )}

      {/* PANELS Font and Font size, with a sample passage under them (SCRUM-158). */}
      {tab === 'typing' && <TypingSettings />}

      {/* PANEL Wardrobe: which version of the wardrobe opens. */}
      {tab === 'wardrobe' && <WardrobeVersionSetting />}

      {/* PANEL Email code at login: a title with its tip, the switch on the right. */}
      {tab === 'security' && (user ? <SecuritySettings user={user} /> : <LoadingState rows={1} />)}

      {/* PANEL Ping's tutorial: a title with its tip, the button on the right. */}
      {tab === 'tutorial' && <TutorialReplay />}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this theme?"
        description={deleting ? `"${deleting.name}" will be removed from your themes.${currentIds.includes(deleting.id) ? ` You will go back to ${fallbackThemes[deleting.mode].name}.` : ''}` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
};
