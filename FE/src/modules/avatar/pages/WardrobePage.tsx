import { Lock } from 'lucide-react';
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

const SLOTS: { slot: AvatarSlot; label: string; optional?: boolean }[] = [
  { slot: 'skin', label: 'Skin' },
  { slot: 'face', label: 'Face' },
  { slot: 'hair', label: 'Hair' },
  { slot: 'top', label: 'Top' },
  { slot: 'bottom', label: 'Bottom' },
  { slot: 'shoes', label: 'Shoes' },
  { slot: 'headwear', label: 'Headwear', optional: true },
  { slot: 'accessory', label: 'Accessory', optional: true },
  { slot: 'back', label: 'Back', optional: true },
  { slot: 'effect', label: 'Effect', optional: true },
];

const POSES: { pose: AvatarPose; label: string }[] = [
  { pose: 'idle', label: 'Idle' },
  { pose: 'typing', label: 'Typing' },
  { pose: 'win', label: 'Win' },
  { pose: 'lose', label: 'Lose' },
];

const SLOT_NAMES = SLOTS.map(({ slot }) => slot);

/** What a locked item costs: its price in coins, or the season tier that gives it. */
const lockText = (unlock: AvatarUnlock) => {
  if (unlock.kind === 'shop') return `${unlock.price} coins`;
  if (unlock.kind === 'tier') return `${unlock.tier[0].toUpperCase()}${unlock.tier.slice(1)} reward`;
  if (unlock.kind === 'season') return 'Season reward';
  return '';
};

const sameLook = (a: AvatarLook, b: AvatarLook) => SLOT_NAMES.every((slot) => (a[slot] ?? null) === (b[slot] ?? null));

interface ItemCardProps {
  item?: AvatarItem;
  preview: AvatarLook;
  selected: boolean;
  onPick: () => void;
}

/**
 * One item: the avatar wearing it, the lock (price or reward) when it is not owned. An item for sale can be picked to
 * preview it before buying; a reward cannot.
 */
const ItemCard = ({ item, preview, selected, onPick }: ItemCardProps) => {
  const locked = item !== undefined && !item.owned;
  const blocked = locked && item.unlock.kind !== 'shop';
  const name = item?.id ?? 'None';
  return (
    <button
      type="button"
      aria-label={locked ? `${name} (${lockText(item.unlock)})` : name}
      aria-pressed={selected}
      aria-disabled={blocked}
      title={name}
      onClick={() => !blocked && onPick()}
      className={cn(
        'flex flex-col items-center gap-1 bg-primary/10 p-2 text-sm text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'outline outline-2 -outline-offset-2 outline-primary' : 'hover:bg-primary/20',
        locked && 'opacity-60',
        blocked && 'cursor-not-allowed hover:bg-primary/10',
      )}
    >
      <AvatarSprite look={preview} scale={1} label={name} />
      <span className="w-full truncate">{name}</span>
      {locked && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          {lockText(item.unlock)}
        </span>
      )}
    </button>
  );
};

/**
 * The wardrobe (`/wardrobe`, from the account menu): a big preview of the avatar in each pose, the coins, and one tab
 * per slot with a card per item. Picking an item only changes the preview; Save puts the look on (`PUT /api/avatar`),
 * Reset goes back to the look worn. Items not owned show their price or the tier reward and cannot be picked.
 */
export const WardrobePage = () => {
  const catalog = useAvatarCatalog();
  const updateAvatar = useUpdateAvatar();
  const buyItem = useBuyItem();
  const [draft, setDraft] = useState<AvatarLook | null>(null);
  const [slot, setSlot] = useState<AvatarSlot>('hair');
  const [pose, setPose] = useState<AvatarPose>('idle');

  if (catalog.isLoading) return <LoadingState rows={4} />;
  if (catalog.isError || !catalog.data) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const saved = catalog.data.avatar;
  const look = draft ?? saved;
  const dirty = !sameLook(look, saved);
  const current = SLOTS.find((entry) => entry.slot === slot)!;
  const pick = (item: string | null) => setDraft({ ...look, [slot]: item });
  const save = () => updateAvatar.mutate(look, { onSuccess: () => setDraft(null) });
  // An item for sale being previewed: it must be bought before the look can be saved.
  const unowned = SLOT_NAMES.flatMap((name) => {
    const item = catalog.data.slots[name].find((entry) => entry.id === look[name]);
    return item && !item.owned && item.unlock.kind === 'shop' ? [{ slot: name, item, price: item.unlock.price }] : [];
  });
  const forSale = unowned[0];
  const coins = catalog.data.coins;

  return (
    <div className="space-y-6">
      <PageHeader title="Wardrobe" description="Dress up the avatar you race with." />
      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Panel className="flex flex-col items-center gap-4">
          <AvatarSprite look={look} pose={pose} scale={4} label="Your avatar" />
          <div role="group" aria-label="Pose" className="flex flex-wrap justify-center gap-1">
            {POSES.map((entry) => (
              <Button key={entry.pose} type="button" size="sm" variant={pose === entry.pose ? 'default' : 'outline'} aria-pressed={pose === entry.pose} onClick={() => setPose(entry.pose)}>
                {entry.label}
              </Button>
            ))}
          </div>
          <p className="text-lg text-primary">{coins} coins</p>
          {forSale && (
            <div className="flex flex-col items-center gap-1">
              <Button
                type="button"
                disabled={coins < forSale.price || buyItem.isPending}
                onClick={() => buyItem.mutate(`${forSale.slot}:${forSale.item.id}`)}
              >
                Buy {forSale.item.id} for {forSale.price} coins
              </Button>
              {coins < forSale.price && <p className="text-sm text-muted-foreground">Not enough coins</p>}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(null)}>
              Reset
            </Button>
            <Button type="button" disabled={!dirty || unowned.length > 0 || updateAvatar.isPending} onClick={save}>
              Save
            </Button>
          </div>
        </Panel>
        <Panel>
          <div role="tablist" aria-label="Slots" className="mb-4 flex flex-wrap gap-1">
            {SLOTS.map((entry) => (
              <button
                key={entry.slot}
                type="button"
                role="tab"
                aria-selected={slot === entry.slot}
                onClick={() => setSlot(entry.slot)}
                className={cn(
                  'px-3 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  slot === entry.slot ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={current.label} className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
            {current.optional && <ItemCard preview={{ ...look, [slot]: null }} selected={!look[slot]} onPick={() => pick(null)} />}
            {catalog.data.slots[slot].map((item) => (
              <ItemCard key={item.id} item={item} preview={{ ...look, [slot]: item.id }} selected={look[slot] === item.id} onPick={() => pick(item.id)} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
