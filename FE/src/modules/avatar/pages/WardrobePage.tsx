import { Coins, Lock } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { PageHeader } from '@/shared/components/page-header';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { AvatarSprite } from '../components/AvatarSprite';
import { useAvatarCatalog, useBuyItem, useUpdateAvatar } from '../hooks/use-avatar';
import type { AvatarItem, AvatarLook, AvatarPose, AvatarSlot, AvatarUnlock } from '../types/avatar.types';

/** `head`: the slot changes the head, so its cards show the head bigger; `full`: the whole avatar. */
const SLOTS: { slot: AvatarSlot; label: string; optional?: boolean; focus: 'head' | 'full' }[] = [
  { slot: 'skin', label: 'Skin', focus: 'head' },
  { slot: 'face', label: 'Face', focus: 'head' },
  { slot: 'hair', label: 'Hair', focus: 'head' },
  { slot: 'top', label: 'Top', focus: 'full' },
  { slot: 'bottom', label: 'Bottom', focus: 'full' },
  { slot: 'shoes', label: 'Shoes', focus: 'full' },
  { slot: 'headwear', label: 'Headwear', optional: true, focus: 'head' },
  { slot: 'accessory', label: 'Accessory', optional: true, focus: 'full' },
  { slot: 'back', label: 'Back', optional: true, focus: 'full' },
  { slot: 'effect', label: 'Effect', optional: true, focus: 'full' },
];

const POSES: { pose: AvatarPose; label: string }[] = [
  { pose: 'idle', label: 'Idle' },
  { pose: 'typing', label: 'Typing' },
  { pose: 'win', label: 'Win' },
  { pose: 'lose', label: 'Lose' },
];

const SLOT_NAMES = SLOTS.map(({ slot }) => slot);

/** `long-pink` → `Long pink`. */
const words = (id: string) => id.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase());

/** What a locked item costs: its price in coins, or the season tier that gives it. */
const lockText = (unlock: AvatarUnlock) => {
  if (unlock.kind === 'shop') return `${unlock.price} coins`;
  if (unlock.kind === 'tier') return `${unlock.tier[0].toUpperCase()}${unlock.tier.slice(1)} reward`;
  if (unlock.kind === 'season') return 'Season reward';
  return '';
};
const pickable = (item: AvatarItem) => item.owned || item.unlock.kind === 'shop';

const sameLook = (a: AvatarLook, b: AvatarLook) => SLOT_NAMES.every((slot) => (a[slot] ?? null) === (b[slot] ?? null));

interface Group {
  key: string;
  label: string;
  items: AvatarItem[];
}

/**
 * The items of a slot as styles: items named `{style}-{color}` with two or more colors make one style, the plain colors
 * (no dash: skins, faces, hoodies) make one "Basic" style, any other item is a style of its own.
 */
const groupItems = (items: AvatarItem[]): Group[] => {
  const byStyle = new Map<string, AvatarItem[]>();
  for (const item of items) {
    const cut = item.id.lastIndexOf('-');
    const style = cut < 0 ? '' : item.id.slice(0, cut);
    byStyle.set(style, [...(byStyle.get(style) ?? []), item]);
  }
  return [...byStyle].flatMap(([style, list]) =>
    list.length > 1 || style === ''
      ? [{ key: style, label: style ? words(style) : 'Basic', items: list }]
      : list.map((item) => ({ key: item.id, label: words(item.id), items: [item] })),
  );
};

interface PickCardProps {
  label: string;
  /** Shown when the item is not owned yet. */
  item?: AvatarItem;
  preview: AvatarLook;
  focus: 'head' | 'full';
  selected: boolean;
  onPick: () => void;
  /** The visible name when shorter than the label (a color under its style). */
  caption?: string;
  /** Under the name, e.g. "6 colors". */
  note?: string;
  small?: boolean;
}

/** A card that puts something on the preview: the avatar wearing it, its name and the lock (price or reward) when not owned. */
const PickCard = ({ label, caption, item, preview, focus, selected, onPick, note, small = false }: PickCardProps) => {
  const locked = item !== undefined && !item.owned;
  const blocked = item !== undefined && !pickable(item);
  return (
    <button
      type="button"
      aria-label={locked ? `${label} (${lockText(item.unlock)})` : label}
      aria-pressed={selected}
      aria-disabled={blocked}
      title={label}
      onClick={() => !blocked && onPick()}
      className={cn(
        'group flex flex-col items-center gap-1 border bg-card/60 p-2 text-sm backdrop-blur-sm transition-[background-color,outline-color,transform] duration-150',
        'outline-2 -outline-offset-2 focus-visible:outline-ring active:scale-[0.98]',
        selected ? 'outline outline-primary' : 'outline-transparent hover:bg-primary/10',
        blocked && 'cursor-not-allowed active:scale-100 hover:bg-card/60',
      )}
    >
      <span className={cn('transition-opacity', locked && 'opacity-55')}>
        <AvatarSprite look={preview} crop={focus} scale={focus === 'head' ? (small ? 1.5 : 2) : 1} label={label} />
      </span>
      <span className={cn('w-full truncate', selected ? 'font-semibold text-primary' : 'text-foreground')}>{caption ?? label}</span>
      {locked ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          {lockText(item.unlock)}
        </span>
      ) : (
        note && <span className="text-xs text-muted-foreground">{note}</span>
      )}
    </button>
  );
};

/**
 * The wardrobe (`/wardrobe`, from the account menu): the avatar on a stage in each pose with the coins, Buy, Reset and
 * Save; beside it one tab per slot. A slot shows its styles (short, long, bob...) and, for the style worn, its colors.
 * Picking only changes the preview; Save puts the look on (`PUT /api/avatar`). An item for sale can be previewed and
 * bought; a reward cannot be picked.
 */
export const WardrobePage = () => {
  const catalog = useAvatarCatalog();
  const updateAvatar = useUpdateAvatar();
  const buyItem = useBuyItem();
  const [draft, setDraft] = useState<AvatarLook | null>(null);
  const [slot, setSlot] = useState<AvatarSlot>('hair');
  const [pose, setPose] = useState<AvatarPose>('idle');
  // A style opened to look at its colors when none of them can be put on (rewards not owned).
  const [browsing, setBrowsing] = useState<string | null>(null);

  if (catalog.isLoading) return <LoadingState rows={4} />;
  if (catalog.isError || !catalog.data) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const saved = catalog.data.avatar;
  const look = draft ?? saved;
  const dirty = !sameLook(look, saved);
  const current = SLOTS.find((entry) => entry.slot === slot)!;
  const pick = (item: string | null) => {
    setBrowsing(null);
    setDraft({ ...look, [slot]: item });
  };
  const save = () => updateAvatar.mutate(look, { onSuccess: () => setDraft(null) });
  // An item for sale being previewed: it must be bought before the look can be saved.
  const unowned = SLOT_NAMES.flatMap((name) => {
    const item = catalog.data.slots[name].find((entry) => entry.id === look[name]);
    return item && !item.owned && item.unlock.kind === 'shop' ? [{ slot: name, item, price: item.unlock.price }] : [];
  });
  const forSale = unowned[0];
  const coins = catalog.data.coins;

  const groups = groupItems(catalog.data.slots[slot]);
  const worn = groups.find((group) => group.items.some((item) => item.id === look[slot]));
  const open = groups.find((group) => group.key === browsing) ?? worn;
  const color = (id: string) => id.slice(id.lastIndexOf('-') + 1);
  /** A style card: keep the color worn when the style has it, else the first one that can be put on. */
  const openStyle = (group: Group) => {
    const wornColor = look[slot] ? color(look[slot]!) : undefined;
    const next = group.items.find((item) => color(item.id) === wornColor && pickable(item)) ?? group.items.find(pickable);
    if (next) pick(next.id);
    else setBrowsing(group.key);
  };
  const oneStyle = groups.length === 1;
  // The hair cards leave the hat off, or a beret or cap would hide the hair they show.
  const base = slot === 'hair' ? { ...look, headwear: null } : look;

  return (
    <div className="space-y-6">
      <PageHeader title="Wardrobe" description="Dress up the avatar you race with." />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <Panel className="flex flex-col items-center gap-4">
            <div className="flex w-full justify-center border-b border-primary/30 bg-primary/5 pt-2">
              <AvatarSprite look={look} pose={pose} scale={4} label="Your avatar" />
            </div>
            <div role="group" aria-label="Pose" className="grid w-full grid-cols-4 border">
              {POSES.map((entry) => (
                <button
                  key={entry.pose}
                  type="button"
                  aria-pressed={pose === entry.pose}
                  onClick={() => setPose(entry.pose)}
                  className={cn(
                    'py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    pose === entry.pose ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-2 text-lg font-semibold text-primary tabular-nums">
              <Coins className="size-5" aria-hidden="true" />
              <span>{coins} coins</span>
            </p>
            {forSale && (
              <div className="flex w-full flex-col items-center gap-1">
                <Button
                  type="button"
                  className="w-full"
                  disabled={coins < forSale.price || buyItem.isPending}
                  onClick={() => buyItem.mutate(`${forSale.slot}:${forSale.item.id}`)}
                >
                  Buy {words(forSale.item.id)} for {forSale.price} coins
                </Button>
                {coins < forSale.price && <p className="text-sm text-muted-foreground">Not enough coins</p>}
              </div>
            )}
            <div className="grid w-full grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(null)}>
                Reset
              </Button>
              <Button type="button" disabled={!dirty || unowned.length > 0 || updateAvatar.isPending} onClick={save}>
                Save
              </Button>
            </div>
            {dirty && <p className="text-sm text-muted-foreground">Not saved yet</p>}
          </Panel>
        </div>
        <Panel>
          <div role="tablist" aria-label="Slots" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
            {SLOTS.map((entry) => (
              <button
                key={entry.slot}
                type="button"
                role="tab"
                aria-selected={slot === entry.slot}
                onClick={() => {
                  setSlot(entry.slot);
                  setBrowsing(null);
                }}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-1.5 text-base transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  slot === entry.slot ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={current.label} className="flex flex-col gap-4">
            {!oneStyle && open && open.items.length > 1 && (
              <section aria-label={`${open.label} colors`} className="flex flex-col gap-2 border bg-primary/5 p-3">
                <h3 className="text-sm font-semibold text-foreground">{open.label}: colors</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
                  {open.items.map((item) => (
                    <PickCard
                      key={item.id}
                      small
                      label={words(item.id)}
                      caption={words(color(item.id))}
                      item={item}
                      preview={{ ...base, [slot]: item.id }}
                      focus={current.focus}
                      selected={look[slot] === item.id}
                      onPick={() => pick(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {current.optional && (
                <PickCard label="None" preview={{ ...base, [slot]: null }} focus={current.focus} selected={!look[slot]} onPick={() => pick(null)} />
              )}
              {oneStyle
                ? groups[0].items.map((item) => (
                    <PickCard
                      key={item.id}
                      label={words(item.id)}
                      item={item}
                      preview={{ ...base, [slot]: item.id }}
                      focus={current.focus}
                      selected={look[slot] === item.id}
                      onPick={() => pick(item.id)}
                    />
                  ))
                : groups.map((group) => {
                    const single = group.items.length === 1 ? group.items[0] : undefined;
                    // A style shows the color worn when it has it, else its first color.
                    const shown = group.items.find((item) => look[slot] && color(item.id) === color(look[slot]!)) ?? group.items[0];
                    return (
                      <PickCard
                        key={group.key}
                        label={group.label}
                        item={single}
                        preview={{ ...base, [slot]: shown.id }}
                        focus={current.focus}
                        selected={single ? look[slot] === single.id : group === worn}
                        onPick={() => (single ? pick(single.id) : openStyle(group))}
                        note={single ? undefined : `${group.items.length} colors`}
                      />
                    );
                  })}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
