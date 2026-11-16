import { ArrowUpDown, Library, ListFilter, type LucideIcon, Lock, Search, User } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { cn } from '@/shared/lib/utils';
import { usePassageOptions } from '../hooks/use-typing';
import type { PassageMenuQuery, PassageMenuSort, PassageOption, PassageOrigin, SessionMode } from '../types/typing.types';

const SORT_OPTIONS: { value: PassageMenuSort; key: string }[] = [
  { value: '-createdAt', key: 'newest' },
  { value: 'title', key: 'nameAsc' },
  { value: 'wordCount', key: 'words' },
];

const ORIGIN_OPTIONS: { value: PassageOrigin; key: string }[] = [
  { value: 'system', key: 'system' },
  { value: 'mine', key: 'mine' },
  { value: 'others', key: 'others' },
];

/** The option after `value`, going back to the first one after the last. */
const nextOption = <T extends { value: string }>(options: T[], value: string) => options[(options.findIndex((option) => option.value === value) + 1) % options.length];

// A button of the row: its icon, and its word and choice only while it is hovered or focused. No border and no focus ring, like the box.
// The box beside it takes the room (`w-0 flex-1`: it adds nothing to the width of the menu), so the word that shows
// makes the box shorter and never the menu wider.
const cycleClass = 'group inline-flex h-10 shrink-0 items-center justify-center gap-2 px-3 text-primary transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

/** A button that goes round `options` when pressed. */
const CycleButton = ({ name, label, icon: Icon, onPress }: { name: string; label: string; icon: LucideIcon; onPress: () => void }) => (
  <button
    type="button"
    aria-label={`${name}: ${label}`}
    onClick={(event) => {
      event.preventDefault();
      onPress();
    }}
    className={cycleClass}
  >
    <Icon className="size-4" aria-hidden />
    <span className="hidden whitespace-nowrap text-base group-hover:inline group-focus-visible:inline" aria-hidden>{`${name}: ${label}`}</span>
  </button>
);

/** Letters without marks and case, so a search for "nang" finds "Nắng". */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

/** A fixed list, searched and sorted here the way the server does for the real one (`passages` of the panel). */
const searchAndSort = (passages: PassageOption[], q: string, sort: PassageMenuSort) => {
  const found = q ? passages.filter((passage) => plain(passage.title).includes(plain(q))) : [...passages];
  if (sort === 'title') return found.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  if (sort === 'wordCount') return found.sort((a, b) => a.wordCount - b.wordCount);
  return found;
};

interface PassageMenuPanelProps {
  mode: SessionMode;
  /** A fixed list of passages instead of the server's (a guest's, SCRUM-251): searched and sorted in the browser, nothing is asked of the API. */
  passages?: PassageOption[];
  language?: TypingLanguage;
  /** Practice only: a button to go round System, Mine and Others (System at first). The placement test has only system passages. */
  showOriginFilter?: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Called for a passage the plan does not allow (US11.1): the page opens the plan instead of starting it. */
  onNeedPremium?: () => void;
}

/**
 * The inside of a passage menu (SCRUM-304), for the Typing page and the placement leaderboard: one row with a search box (a
 * magnifier and the word Search as its placeholder), a Sort button and, in Practice, a Filter button (who made the passage); they show only
 * their icon (the word is in a tooltip) and go round their options when pressed, and the list is asked again at once. The search is sent when the learner
 * presses Enter. Under the row, the passages that match, the picked one in red. It is only mounted while the menu is open, so the
 * list is fetched then.
 */
export const PassageMenuPanel = ({ mode, passages, language = 'vi', showOriginFilter = false, selectedId, onSelect, onNeedPremium }: PassageMenuPanelProps) => {
  const { t } = useTranslation('typing');
  // `text` is what is in the box; `q` is the search that was sent (Enter). Sort and filter are asked for as soon as they change.
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<PassageMenuSort>('-createdAt');
  const [origin, setOrigin] = useState<PassageOrigin>('system');
  const panel = useRef<HTMLDivElement>(null);

  // The menu opens to search: the cursor goes to the box, so the keys do not reach the passage being typed behind it. Not on a
  // touch screen, where it would pop the keyboard up over the list.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    panel.current?.querySelector('input')?.focus();
  }, []);

  const query = useMemo<PassageMenuQuery>(
    () => ({ sort, ...(q ? { q } : {}), ...(showOriginFilter ? { origin } : {}) }),
    [q, sort, origin, showOriginFilter],
  );
  const remote = usePassageOptions(mode, { language, query, enabled: passages === undefined });
  const data = passages ? searchAndSort(passages, q, sort) : remote.data;
  const isLoading = passages ? false : remote.isLoading;
  const isError = passages ? false : remote.isError;
  // The empty bank and a search or filter without a match are not the same thing.
  const narrowed = q !== '' || (showOriginFilter && origin !== 'system');
  const sortLabel = t(`menu.${SORT_OPTIONS.find((option) => option.value === sort)!.key}`);
  const originLabel = t(`menu.${ORIGIN_OPTIONS.find((option) => option.value === origin)!.key}`);

  // Enter in the box.
  const search = (event: FormEvent) => {
    event.preventDefault();
    setQ(text.trim());
  };

  return (
    <div ref={panel} className="flex min-w-0 flex-col gap-2">
      <form role="search" onSubmit={search} className="flex items-center gap-1 px-1 pt-1">
        <div className="relative w-0 min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label={t('menu.searchLabel')} placeholder={t('menu.searchPlaceholder')} value={text} onChange={(event) => setText(event.target.value)} className="border-0 bg-transparent pl-9 focus-visible:ring-0" />
        </div>
          <CycleButton name={t('menu.sort')} label={sortLabel} icon={ArrowUpDown} onPress={() => setSort(nextOption(SORT_OPTIONS, sort).value)} />
          {showOriginFilter && <CycleButton name={t('menu.filter')} label={originLabel} icon={ListFilter} onPress={() => setOrigin(nextOption(ORIGIN_OPTIONS, origin).value)} />}
      </form>
      <div role="presentation" className="max-h-72 overflow-y-auto">
        {isLoading && <p className="px-2 py-1.5 text-base text-muted-foreground">{t('menu.loading')}</p>}
        {isError && <p className="px-2 py-1.5 text-base text-destructive">{t('menu.loadFailed')}</p>}
        {!isLoading && !isError && !data?.length && (
          <p className="px-2 py-1.5 text-base text-muted-foreground">{narrowed ? t('menu.noMatch') : t('menu.none')}</p>
        )}
        {data?.map((passage) => {
          const unavailable = passage.locked || passage.lockedByPlan;
          return (
            <DropdownMenuItem
              key={passage._id}
              role="menuitemradio"
              aria-checked={passage._id === selectedId}
              // A passage past the owner's limit cannot be picked; one locked by the plan opens the plan (US11.1).
              aria-disabled={passage.locked ? true : undefined}
              className={cn('flex-wrap gap-x-2 gap-y-1', passage._id === selectedId && 'text-primary', unavailable && 'opacity-60')}
              onClick={(event) => {
                if (passage.locked) return event.preventDefault();
                if (passage.lockedByPlan) return onNeedPremium?.();
                onSelect(passage._id);
              }}
            >
              <span className="min-w-0 break-words">{passage.title}</span>
              {unavailable && (
                <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  {passage.locked ? t('menu.locked') : t('menu.premium')}
                </span>
              )}
              {passage.isSystem ? (
                <LabeledTag icon={Library} text={t('menu.system')} />
              ) : (
                !passage.isOwn && <LabeledTag icon={User} text={passage.ownerName} />
              )}
              <span className="ml-auto shrink-0 pl-4 text-sm text-muted-foreground">{t('menu.wordCount', { count: passage.wordCount })}</span>
            </DropdownMenuItem>
          );
        })}
      </div>
    </div>
  );
};
