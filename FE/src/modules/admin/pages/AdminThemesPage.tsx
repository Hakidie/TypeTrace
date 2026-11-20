import { Moon, Palette, Sun } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { fallbackThemes, type ThemeMode } from '@/shared/lib/theme';
import { ThemeEditor } from '@/modules/settings/components/ThemeEditor';
import { ThemeGrid, type ThemeOption } from '@/modules/settings/components/ThemeGrid';
import type { Theme } from '@/modules/settings/types/theme.types';
import { useAdminThemes, useCreateAdminTheme, useDeleteAdminTheme, useUpdateAdminTheme } from '../hooks/use-admin';
import type { AdminThemeListParams } from '../types/admin.types';

const PAGE_SIZE = 15;

// The values of the sort; the words are the `themes.sort.*` keys.
const SORTS = [
  ['-createdAt', 'newest'],
  ['createdAt', 'oldest'],
  ['name', 'nameAsc'],
  ['-name', 'nameDesc'],
] as const;

const toOption = (theme: Theme): ThemeOption => ({ id: theme._id, name: theme.name, colors: theme.colors, own: true });

/**
 * Manage TypeTrace's themes, the ones every learner can pick: a Create / Edit panel (the theme card of the
 * Settings page plus a Mode button) and a list of the themes with search, sort, a mode filter and pagination.
 */
export const AdminThemesPage = () => {
  const { t } = useTranslation('admin');
  const SORT_OPTIONS = SORTS.map(([value, key]) => ({ value, label: t(`themes.sort.${key}`) }));
  // Dark and Light are the words of the mode switch of the header (`common`).
  const modeName = (dark: boolean) => (dark ? t('common:menu.dark') : t('common:menu.light'));
  const MODE_OPTIONS = [
    { value: 'true', label: modeName(true) },
    { value: 'false', label: modeName(false) },
  ];
  const list = useListParams({ sort: '-createdAt' });
  const isDark = list.get('isDark') as AdminThemeListParams['isDark'];

  const themes = useAdminThemes({ page: list.page, limit: PAGE_SIZE, q: list.q, isDark, sort: list.sort });
  const create = useCreateAdminTheme();
  const update = useUpdateAdminTheme();
  const remove = useDeleteAdminTheme();

  const panelRef = useRef<HTMLDivElement>(null);
  /** The theme being edited, or nothing while a new theme is made. */
  const [editing, setEditing] = useState<Theme>();
  const [newMode, setNewMode] = useState<ThemeMode>('dark');
  /** Changes after a save or a cancel so the editor starts again with empty fields. */
  const [round, setRound] = useState(0);
  const [deleting, setDeleting] = useState<ThemeOption>();

  const mode: ThemeMode = editing ? (editing.isDark ? 'dark' : 'light') : newMode;
  const items = themes.data?.items ?? [];

  const finish = () => {
    setEditing(undefined);
    setRound((value) => value + 1);
  };

  const startEditing = (option: ThemeOption) => {
    setEditing(items.find((theme) => theme._id === option.id));
    // The panel is above the list: bring it into view.
    panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const confirmDelete = () =>
    remove.mutate(deleting!.id, {
      onSuccess: () => {
        if (editing?._id === deleting!.id) finish();
        setDeleting(undefined);
      },
    });

  const isFiltered = Boolean(list.q || isDark);

  const renderList = () => {
    if (themes.isPending) return <LoadingState rows={3} />;
    if (themes.isError) return <ErrorState error={themes.error} onRetry={() => void themes.refetch()} />;
    if (items.length === 0) {
      return (
        <EmptyState
          icon={Palette}
          title={isFiltered ? t('themes.noMatch') : t('themes.none')}
          description={isFiltered ? t('themes.tryAnother') : t('themes.createFirst')}
        />
      );
    }
    return (
      <>
        <ThemeGrid
          label={t('themes.title')}
          themes={items.map(toOption)}
          currentId={editing?._id ?? ''}
          onSelect={startEditing}
          onEdit={startEditing}
          onDelete={setDeleting}
        />
        <Pagination page={themes.data.page} totalPages={themes.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div ref={panelRef} className="scroll-mt-4">
        {/* PANEL Theme form: no visible title (the editor says what it is); screen readers still get one. */}
        <Panel bare>
          <h2 className="sr-only">{editing ? t('themes.editTheme') : t('themes.newTheme')}</h2>
              <ThemeEditor
                key={`${editing?._id ?? mode}-${round}`}
                mode={mode}
                plain
                large
                label={editing ? t('themes.editTheme') : t('themes.newTheme')}
                initialName={editing?.name}
                initialColors={editing?.colors ?? fallbackThemes[mode].colors}
                takenNames={items.filter((theme) => theme._id !== editing?._id).map((theme) => theme.name)}
                onSave={(input) =>
                  editing
                    ? update.mutate({ id: editing._id, input }, { onSuccess: finish })
                    : create.mutate({ ...input, mode }, { onSuccess: finish })
                }
                onPreview={() => undefined}
                // Only an edit can be cancelled; a new theme just stays empty.
                onCancel={editing ? finish : undefined}
                // One button for the mode, like Cancel and Save: it shows the mode now and switches to the other. Only for a new theme: the mode of an existing one cannot change.
                actions={(colors) =>
                  !editing && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={t('themes.mode', { mode: modeName(mode === 'dark') })}
                          onClick={() => setNewMode(mode === 'dark' ? 'light' : 'dark')}
                          className="flex size-9 items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: `color-mix(in srgb, ${colors.text} 15%, transparent)`, color: colors.text }}
                        >
                          {mode === 'dark' ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('themes.switchTo', { mode: modeName(mode !== 'dark') })}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  )
                }
              />
        </Panel>
      </div>

      {/* PANEL Themes */}
      <Panel
        title={t('themes.title')}
        bare
        titleClassName={sectionTitleClass}
        className="flex flex-col gap-3"
        actions={
          <CompactToolbar
            showWords
            search={{
              label: t('themes.searchLabel'),
              placeholder: t('themes.searchPlaceholder'),
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            filters={[{ label: t('themes.filterMode'), value: isDark ?? '', options: MODE_OPTIONS, onChange: (value) => list.set('isDark', value) }]}
            count={{ icon: Palette, value: themes.data?.total ?? '…', label: t('themes.title') }}
          />
        }
      >
        {renderList()}
      </Panel>

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t('themes.deleteTitle')}
        description={deleting ? t('themes.deleteDescription', { name: deleting.name }) : undefined}
        confirmLabel={t('common:actions.delete')}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
