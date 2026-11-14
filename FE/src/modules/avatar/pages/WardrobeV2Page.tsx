import { Backpack, Coins, Columns2, Footprints, Glasses, GraduationCap, Hand, Lock, Plus, Scissors, Shirt, Smile, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCoins } from '@/modules/payments/lib/store';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/lib/utils';
import { AvatarSprite } from '../components/AvatarSprite';
import { WardrobeSwitch } from '../components/WardrobeSwitch';
import { WardrobePage } from './WardrobePage';
import { useAvatarCatalog, useBuyItem, useUpdateAvatar } from '../hooks/use-avatar';
import type { AvatarItem, AvatarLook, AvatarPose, AvatarSlot, AvatarUnlock } from '../types/avatar.types';

interface SlotEntry {
  slot: AvatarSlot;
  icon: LucideIcon;
  label: string;
  optional?: boolean;
  /** `head`: the cards show the head bigger; `full`: the whole avatar. */
  focus: 'head' | 'full';
}

/** The slots in three groups around the avatar: clothes on its left, the face, hair and effect under it, the extras on its right. */
const CLOTHES: SlotEntry[] = [
  { slot: 'top', icon: Shirt, label: 'Top', focus: 'full' },
  { slot: 'bottom', icon: Columns2, label: 'Bottom', focus: 'full' },
  { slot: 'shoes', icon: Footprints, label: 'Shoes', focus: 'full' },
];
const LOOKS: SlotEntry[] = [
  { slot: 'skin', icon: Hand, label: 'Skin', focus: 'head' },
  { slot: 'face', icon: Smile, label: 'Face', focus: 'head' },
  { slot: 'hair', icon: Scissors, label: 'Hair', focus: 'head' },
  { slot: 'effect', icon: Sparkles, label: 'Effect', optional: true, focus: 'full' },
];
const EXTRAS: SlotEntry[] = [
  { slot: 'headwear', icon: GraduationCap, label: 'Headwear', optional: true, focus: 'head' },
  { slot: 'accessory', icon: Glasses, label: 'Accessory', optional: true, focus: 'full' },
  { slot: 'back', icon: Backpack, label: 'Back', optional: true, focus: 'full' },
];
const SLOTS = [...CLOTHES, ...LOOKS, ...EXTRAS];
const SLOT_NAMES = SLOTS.map(({ slot }) => slot);

const POSES: { pose: AvatarPose; label: string }[] = [
  { pose: 'idle', label: 'Idle' },
  { pose: 'typing', label: 'Typing' },
  { pose: 'win', label: 'Win' },
  { pose: 'lose', label: 'Lose' },
];

/** `long-pink` → `Long pink`. */
const words = (id: string) => id.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase());

/** What a locked item costs: its price in coins, or the season tier that gives it. */
const lockText = (unlock: AvatarUnlock) => {
  if (unlock.kind === 'shop') return `${unlock.price} coins`;
  if (unlock.kind === 'tier') return `${unlock.tier[0].toUpperCase()}${unlock.tier.slice(1)} reward`;
  if (unlock.kind === 'season') return 'Season reward';
  if (unlock.kind === 'premium') return 'Premium';
  return '';
};
// A Premium item can be previewed without Premium, like an item for sale; the left panel then leads to the Store.
const pickable = (item: AvatarItem) => item.owned || item.unlock.kind === 'shop' || item.unlock.kind === 'premium';

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

/** A phone has no room for a drawer beside the avatar: there v2 is the first wardrobe. */
export const WardrobeV2Page = () => (useMediaQuery('(max-width: 767px)') ? <WardrobePage /> : <WardrobeDesktop />);

/**
 * The modern wardrobe (`WardrobeV2Page`, from `md` up): the avatar in the middle of the page with the slots in three groups (clothes on
 * the left, skin, face, hair and effect under it, headwear and the extras on the right). A slot opens a drawer with its
 * items (styles and their colors, as in the first wardrobe) on the right; the page moves over so the avatar stays in view and shows each
 * pick at once. Picking only changes the preview; Save puts the look on (`PUT /api/avatar`).
 */
const WardrobeDesktop = () => {
  const catalog = useAvatarCatalog();
  const updateAvatar = useUpdateAvatar();
  const buyItem = useBuyItem();
  const [draft, setDraft] = useState<AvatarLook | null>(null);
  const [slot, setSlot] = useState<AvatarSlot | null>(null);
  const [pose, setPose] = useState<AvatarPose>('idle');
  const [browsing, setBrowsing] = useState<string | null>(null);

  if (catalog.isLoading) return <LoadingState rows={4} />;
  if (catalog.isError || !catalog.data) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const saved = catalog.data.avatar;
  const look = draft ?? saved;
  const dirty = !sameLook(look, saved);
  const coins = catalog.data.coins;
  const current = SLOTS.find((entry) => entry.slot === slot);
  const pick = (item: string | null) => {
    if (!slot) return;
    setBrowsing(null);
    setDraft({ ...look, [slot]: item });
  };
  const save = () => updateAvatar.mutate(look, { onSuccess: () => setDraft(null) });
  const unowned = SLOT_NAMES.flatMap((name) => {
    const item = catalog.data.slots[name].find((entry) => entry.id === look[name]);
    if (!item || item.owned) return [];
    if (item.unlock.kind === 'shop') return [{ slot: name, item, price: item.unlock.price }];
    return item.unlock.kind === 'premium' ? [{ slot: name, item, price: 0 }] : [];
  });
  const forSale = unowned.find((entry) => entry.item.unlock.kind === 'shop');
  const proLocked = unowned.find((entry) => entry.item.unlock.kind === 'premium');

  const groups = slot ? groupItems(catalog.data.slots[slot]) : [];
  const worn = slot ? groups.find((group) => group.items.some((item) => item.id === look[slot])) : undefined;
  const open = groups.find((group) => group.key === browsing) ?? worn;
  const color = (id: string) => id.slice(id.lastIndexOf('-') + 1);
  const openStyle = (group: Group) => {
    if (!slot) return;
    const wornColor = look[slot] ? color(look[slot]!) : undefined;
    const next = group.items.find((item) => color(item.id) === wornColor && pickable(item)) ?? group.items.find(pickable);
    if (next) pick(next.id);
    else setBrowsing(group.key);
  };
  const oneStyle = groups.length === 1;
  const base = slot === 'hair' ? { ...look, headwear: null } : look;

  // The tab of the first wardrobe: icon and name, a line under it, red when it is the one open.
  const tab = ({ slot: name, icon: Icon, label }: SlotEntry) => {
    // What the preview wears in this slot, so the groups say the whole look without opening them.
    const wornItem = catalog.data.slots[name].find((entry) => entry.id === look[name]);
    return (
      <button
        key={name}
        type="button"
        aria-expanded={slot === name}
        onClick={() => {
          setBrowsing(null);
          setSlot(slot === name ? null : name);
        }}
        className={cn(
          'inline-flex items-center gap-3 border-b-2 px-4 py-2 text-left text-xl transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          slot === name ? 'border-primary font-semibold text-primary' : 'border-transparent text-foreground hover:text-primary',
        )}
      >
        <Icon className="size-7 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          {label}
          <span className="max-w-40 truncate text-sm font-normal text-muted-foreground">{wornItem ? words(wornItem.id) : 'None'}</span>
        </span>
      </button>
    );
  };

  const drawer =
    current && slot ? (
      <aside
        aria-label={current.label}
        className={cn(
          'flex flex-col bg-background p-4 duration-300 animate-in motion-reduce:animate-none',
          'fixed z-40 gap-4 overflow-y-auto',
          'bottom-0 right-0 top-[61px] w-[25rem] border-l slide-in-from-right',
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="shrink-0 text-[1.5rem] font-semibold text-primary/70">{current.label}</h2>
          <button type="button" aria-label="Close" onClick={() => setSlot(null)} className="shrink-0 p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
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
          {current.optional && <PickCard label="None" preview={{ ...base, [slot]: null }} focus={current.focus} selected={!look[slot]} onPick={() => pick(null)} />}
          {oneStyle
            ? groups[0].items.map((item) => (
                <PickCard key={item.id} label={words(item.id)} item={item} preview={{ ...base, [slot]: item.id }} focus={current.focus} selected={look[slot] === item.id} onPick={() => pick(item.id)} />
              ))
            : groups.map((group) => {
                const single = group.items.length === 1 ? group.items[0] : undefined;
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
      </aside>
    ) : null;

  return (
    <div className={cn('flex flex-1 flex-col gap-6 transition-[padding] duration-300 ease-out motion-reduce:transition-none', current && 'pr-[26rem]')}>
      {/* From `lg` up the three columns make the middle one (Reset, Pose, Save) the center of the screen, whatever the width of the title and the coins. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-[1.5rem] font-semibold lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-4">
          <h1 className="text-primary/70">Wardrobe</h1>
          <WardrobeSwitch to="classic" other="Classic wardrobe" />
        </div>
        <div className="flex items-stretch gap-3 text-base font-normal">
          <Button type="button" variant="outline" className="h-auto px-3 py-1.5 text-[1.125rem] leading-normal" disabled={!dirty} onClick={() => setDraft(null)}>
            Reset
          </Button>
          {/* A flex wrapper, so the tabs stretch to the height of the row like the two buttons. */}
          <div className="flex">
            <TabGroup label="Pose" tabs={POSES.map(({ pose: value, label }) => ({ value, label }))} value={pose} onChange={(value) => setPose(value as AvatarPose)} />
          </div>
          <Button type="button" className="h-auto px-3 py-1.5 text-[1.125rem] leading-normal" disabled={!dirty || unowned.length > 0 || updateAvatar.isPending} onClick={save}>
            Save
          </Button>
        </div>
        {/* The coins sit at the right edge, so "Get coins" opens to their left while they are hovered or focused (grid 0fr -> 1fr animates the width). */}
        <div className="group flex items-center lg:justify-self-end">
          <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-300 ease-out focus-within:grid-cols-[1fr] focus-within:opacity-100 group-hover:grid-cols-[1fr] group-hover:opacity-100 motion-reduce:transition-none">
            <span className="overflow-hidden whitespace-nowrap pr-4">
              <Link
                to="/store?section=coins"
                className="inline-flex items-center gap-1.5 border border-primary/60 px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <Plus className="size-4" aria-hidden="true" />
                Get coins
              </Link>
            </span>
          </span>
          <span className="flex items-center gap-2 tabular-nums text-primary">
            <Coins className="size-6" aria-hidden="true" />
            {formatCoins(coins)}
          </span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl items-center gap-x-6 gap-y-4 md:grid-cols-[1fr_auto_1fr]">
        <div role="group" aria-label="Clothes" className="flex flex-wrap justify-center gap-1 md:order-1 md:flex-col md:items-start md:justify-self-start">
          {CLOTHES.map(tab)}
        </div>
        <div className="flex flex-col items-center gap-4 max-md:order-first md:order-2">
          <AvatarSprite look={look} pose={pose} scale={6} label="Your avatar" />
        </div>
        <div role="group" aria-label="Extras" className="flex flex-wrap justify-center gap-1 md:order-3 md:flex-col md:items-start md:justify-self-end">
          {EXTRAS.map(tab)}
        </div>
      </div>
      {/* A fixed 72px under the avatar (24px of the page's gap + 48px here), whatever the screen's height. */}
      <div className="flex justify-center pt-12">
        <div role="group" aria-label="Looks" className="flex flex-wrap justify-center gap-1">
          {LOOKS.map(tab)}
        </div>
      </div>

      {/* Only when the preview wears something to buy: at the bottom of the page, in view while it scrolls. */}
      {(forSale || proLocked) && (
        <div className="sticky bottom-0 z-30 mx-auto -mb-8 mt-auto flex w-full max-w-sm flex-col gap-3 bg-background/80 pb-12 pt-3 backdrop-blur-sm">
        {forSale && (
          <Button type="button" className="w-full" disabled={coins < forSale.price || buyItem.isPending} onClick={() => buyItem.mutate(`${forSale.slot}:${forSale.item.id}`)}>
            <span>Buy {words(forSale.item.id)} for {forSale.price} coins</span>
          </Button>
        )}
        {proLocked && (
          <Button asChild className="w-full">
            <Link to="/store"><span>Get Premium to wear {words(proLocked.item.id)}</span></Link>
          </Button>
        )}
        </div>
      )}

      {drawer}
    </div>
  );
};
