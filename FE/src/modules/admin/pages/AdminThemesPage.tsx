import { Moon, Palette, Sun } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { fallbackThemes, type ThemeMode } from '@/shared/lib/theme';
import { ThemeEditor } from '@/modules/settings/components/ThemeEditor';
import { ThemeGrid, type ThemeOption } from '@/modules/settings/components/ThemeGrid';
import type { Theme } from '@/modules/settings/types/theme.types';
import { useAdminThemes, useCreateAdminTheme, useDeleteAdminTheme, useUpdateAdminTheme } from '../hooks/use-admin';
import type { AdminThemeListParams } from '../types/admin.types';

const PAGE_SIZE = 15;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
];

const MODE_OPTIONS = [
  { value: 'true', label: 'Dark' },
  { value: 'false', label: 'Light' },
];

const toOption = (theme: Theme): ThemeOption => ({ id: theme._id, name: theme.name, colors: theme.colors, own: true });

/**
 * Manage TypeTrace's themes, the ones every learner can pick: a Create / Edit panel (the theme card of the
 * Settings page plus a Mode button) and a list of the themes with search, sort, a mode filter and pagination.
 */
export const AdminThemesPage = () => {
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
          title={isFiltered ? 'No matching themes' : 'No themes yet'}
          description={isFiltered ? 'Try another search or filter.' : 'Create the first TypeTrace theme above.'}
        />
      );
    }
    return (
      <>
        <ThemeGrid
          label="Themes"
          themes={items.map(toOption)}
          currentId={editing?._id ?? ''}
          onSelect={startEditing}
          onEdit={startEditing}
          onDelete={setDeleting}
        />
        <Pagination page={themes.data.page} totalPages={themes.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div ref={panelRef} className="scroll-mt-4">
        <Panel title={editing ? 'Edit theme' : 'New theme'} bare titleClassName={panelTitleClass} className={panelBodyClass}>
              <ThemeEditor
                key={`${editing?._id ?? mode}-${round}`}
                mode={mode}
                plain
                label={editing ? 'Edit theme' : 'New theme'}
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
                  <button
                    type="button"
                    aria-label={`Mode: ${mode === 'dark' ? 'Dark' : 'Light'}`}
                    title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'}`}
                    onClick={() => setNewMode(mode === 'dark' ? 'light' : 'dark')}
                    className="flex size-6 items-center justify-center hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ backgroundColor: `color-mix(in srgb, ${colors.text} 15%, transparent)`, color: colors.text }}
                  >
                    {mode === 'dark' ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
                  </button>
                  )
                }
              />
        </Panel>
      </div>

      <Panel title="Themes" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <div className="space-y-3">
          <ListToolbar
            search={{
              label: 'Search themes',
              placeholder: 'Search name…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            summary={themes.data ? `${themes.data.total} themes in total` : 'Loading themes…'}
            filters={[{ label: 'Mode', value: isDark ?? '', options: MODE_OPTIONS, onChange: (value) => list.set('isDark', value) }]}
          />
          {renderList()}
        </div>
      </Panel>

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this theme?"
        description={deleting ? `"${deleting.name}" is removed for every learner. Those who use it go back to the built-in theme.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
