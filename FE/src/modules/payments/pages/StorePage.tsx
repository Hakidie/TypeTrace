import { BookOpen, CalendarCheck, Coins, Crown, Shirt } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { useAvatarCatalog } from '@/modules/avatar/hooks/use-avatar';
import type { AvatarLook, AvatarPose, AvatarSlot } from '@/modules/avatar/types/avatar.types';
import { Ping } from '@/modules/tutorial/components/Ping';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { PageHeader } from '@/shared/components/page-header';
import { PremiumBadge } from '@/shared/components/premium-badge';
import { usePlan } from '@/modules/plan/hooks/use-plan';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { PlanOption } from '../components/PlanOption';
import { usePaymentProducts, useStartPayment } from '../hooks/use-payments';
import type { PaymentProvider } from '../types/payments.types';
import { bonusPercent, coinPacks, formatCoins, formatVnd, itemLabel, planTitle, pricePerMonth, proPlans, savingPercent } from '../lib/store';

/** The poses the preview walks through, so each Premium item is seen on the avatar in motion. */
const POSES: AvatarPose[] = ['idle', 'typing', 'win'];
const POSE_MS = 3500;
const SLOT_ORDER: AvatarSlot[] = ['headwear', 'accessory', 'back', 'effect'];

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const GATEWAYS: { provider: PaymentProvider; name: string }[] = [
  { provider: 'vnpay', name: 'VNPay' },
  { provider: 'momo', name: 'MoMo' },
];

/** One pay button per gateway, side by side from `sm` up. While one is opening, both wait. */
const PayButtons = ({ icon, what, disabled, opening, onPay }: { icon: ReactNode; what: string; disabled: boolean; opening?: PaymentProvider; onPay: (provider: PaymentProvider) => void }) => (
  <div className="flex flex-col gap-2 sm:flex-row">
    {GATEWAYS.map(({ provider, name }) => (
      <Button
        key={provider}
        type="button"
        variant={provider === 'vnpay' ? 'default' : 'outline'}
        className="h-12 flex-1 active:scale-[0.98]"
        disabled={disabled || opening !== undefined}
        onClick={() => onPay(provider)}
      >
        {icon}
        {opening === provider ? `Opening ${name}...` : `${what} with ${name}`}
      </Button>
    ))}
  </div>
);

/**
 * An item tile shows its layer (a whole 76px avatar frame with only the item drawn) zoomed on where that slot sits on the
 * body, so a small pendant is as readable as a headset. `zoom` and the centre are in sprite pixels; the tile is 56px.
 */
const THUMB_FOCUS: Partial<Record<AvatarSlot, { x: number; y: number; zoom: number }>> = {
  headwear: { x: 37, y: 12, zoom: 1.3 },
  accessory: { x: 38, y: 51, zoom: 1.8 },
  back: { x: 38, y: 36, zoom: 0.75 },
  effect: { x: 62, y: 8, zoom: 2.6 },
};
const thumbStyle = (slot: AvatarSlot) => {
  const { x, y, zoom } = THUMB_FOCUS[slot] ?? { x: 38, y: 38, zoom: 0.75 };
  return { width: 76 * zoom, height: 76 * zoom, left: 28 - x * zoom, top: 28 - y * zoom };
};

/** A floor of square pixels under the avatar, fading upward: the stage the Dragon set is shown on. Drawn from the theme accent. */
const PIXEL_FLOOR =
  'pointer-events-none absolute inset-x-0 bottom-0 h-3/5 [background-size:16px_16px] ' +
  '[background-image:linear-gradient(to_right,color-mix(in_oklab,var(--color-primary)_14%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-primary)_14%,transparent)_1px,transparent_1px)] ' +
  '[mask-image:linear-gradient(to_top,black,transparent)]';

/**
 * The Store (`/store`, from the account menu). Premium (US11.1) is a stage: the learner's own avatar wearing the Dragon set
 * (each item is a tile that switches it off to see it alone) beside what Premium gives and the plans. Coins follow, with Ping pointing at what
 * they buy. The prices come from the server. A pay button (VNPay or MoMo) saves a pending payment and sends the browser to
 * that gateway; `/payments/<gateway>/return` brings it back.
 */
export const StorePage = () => {
  const products = usePaymentProducts();
  const catalog = useAvatarCatalog();
  const startPayment = useStartPayment();
  // What Premium gives (the passage limit, Train), as an admin set it in the Plans page; the perks wait for it.
  const premiumPlan = usePlan().data?.plans.premium;
  const [params] = useSearchParams();
  const [planId, setPlanId] = useState<string>();
  const [packId, setPackId] = useState<string>();
  const [hidden, setHidden] = useState<string[]>([]);
  const [pose, setPose] = useState<AvatarPose>('idle');
  const coinsSection = useRef<HTMLElement>(null);

  // Motion with a reason: the preview shows the set in every pose. Reduced motion keeps it still.
  useEffect(() => {
    if (reducedMotion()) return;
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % POSES.length;
      setPose(POSES[index]);
    }, POSE_MS);
    return () => clearInterval(timer);
  }, []);

  // `/store?section=coins` (from the wardrobe) opens on the coin packs.
  useEffect(() => {
    if (params.get('section') === 'coins' && products.isSuccess) {
      coinsSection.current?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, [params, products.isSuccess]);

  if (products.isLoading || catalog.isLoading) return <LoadingState rows={4} />;
  if (products.isError || !products.data) return <ErrorState error={products.error} onRetry={() => void products.refetch()} />;
  if (catalog.isError || !catalog.data) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const plans = proPlans(products.data);
  const packs = coinPacks(products.data);
  const plan = plans.find((entry) => entry.id === planId) ?? plans[Math.min(1, plans.length - 1)];
  const pack = packs.find((entry) => entry.id === packId) ?? packs[Math.min(1, packs.length - 1)];
  const { premium, coins } = catalog.data;
  // The gateway the browser is being sent to, while the payment is being saved.
  const opening = startPayment.isPending ? startPayment.variables.provider : undefined;

  // The Premium items the catalog has, in slot order. None (the sprites are not drawn): the panel sells the plan and the badge.
  const proItems = SLOT_ORDER.flatMap((slot) =>
    catalog.data.slots[slot].filter((item) => item.unlock.kind === 'premium').map((item) => ({ slot, id: item.id })),
  );
  const look: AvatarLook = {
    ...catalog.data.avatar,
    ...Object.fromEntries(proItems.filter(({ id }) => !hidden.includes(id)).map(({ slot, id }) => [slot, id])),
  };
  const toggle = (id: string) => setHidden((now) => (now.includes(id) ? now.filter((entry) => entry !== id) : [...now, id]));

  const perks = [
    ...(proItems.length > 0 ? [{ icon: Shirt, text: `The Dragon set: ${proItems.length} items to wear while your plan lasts` }] : []),
    ...(premiumPlan
      ? [{ icon: BookOpen, text: `Up to ${premiumPlan.maxPassages} passages of your own${premiumPlan.canCreateErrorPractice ? ', and Train on your weak spots' : ''}` }]
      : []),
    { icon: Crown, text: 'A Premium badge beside your name' },
    { icon: CalendarCheck, text: 'One payment. Nothing renews, and nothing is taken away when it ends.' },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Store"
        description="Get Premium or top up coins. You pay once through VNPay or MoMo, nothing renews by itself."
        actions={
          <div className="flex items-center gap-4 border bg-card/60 px-4 py-2 backdrop-blur-sm">
            <span className="flex items-center gap-2 text-lg font-semibold tabular-nums text-primary">
              <Coins className="size-5" aria-hidden="true" />
              {formatCoins(coins)}
            </span>
            <span className="h-6 w-px bg-border" aria-hidden="true" />
            {premium.active && premium.until ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <PremiumBadge /> until {dateText(premium.until)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">You are on Free.</span>
            )}
          </div>
        }
      />

      <section aria-labelledby="store-premium" className="grid border bg-card/60 backdrop-blur-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="relative flex flex-col items-center justify-end gap-6 overflow-hidden border-b bg-primary/5 px-5 pt-8 pb-6 lg:border-r lg:border-b-0">
          <div aria-hidden="true" className={PIXEL_FLOOR} />
          <AvatarSprite look={look} pose={pose} scale={4} label="Your avatar with the Dragon set" className="relative" />
          <span aria-hidden="true" className="relative -mt-6 h-px w-2/3 bg-primary/40" />
          {proItems.length > 0 && (
            <div role="group" aria-label="Preview items" className="relative grid w-full max-w-sm grid-cols-4 gap-2">
              {proItems.map(({ slot, id }) => {
                const shown = !hidden.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={shown}
                    onClick={() => toggle(id)}
                    className={cn(
                      'flex flex-col items-center gap-1 border bg-foreground/15 p-1.5 transition-[background-color,border-color,opacity] duration-150',
                      'focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
                      shown ? 'border-primary text-primary' : 'text-muted-foreground opacity-60 hover:bg-primary/10 hover:opacity-100',
                    )}
                  >
                    <span className="relative size-14 overflow-hidden">
                      <img
                        src={`/avatar/${slot}/${id}.png`}
                        alt=""
                        draggable={false}
                        className="absolute max-w-none select-none"
                        style={{ imageRendering: 'pixelated', ...thumbStyle(slot) }}
                      />
                    </span>
                    <span className="line-clamp-2 w-full text-center text-xs leading-tight">{itemLabel(id)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <div className="space-y-3">
            <h2 id="store-premium" className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              Premium <Crown className="size-7 text-primary" aria-hidden="true" />
            </h2>
            <ul className="space-y-2">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-muted-foreground">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div role="radiogroup" aria-label="Premium plan" className="grid gap-2 sm:grid-cols-3">
            {plans.map((entry) => {
              const saving = savingPercent(entry, plans[0]);
              return (
                <PlanOption
                  key={entry.id}
                  layout="tile"
                  name="premium-plan"
                  value={entry.id}
                  checked={entry.id === plan?.id}
                  onSelect={() => setPlanId(entry.id)}
                  title={planTitle(entry)}
                  detail={`${formatVnd(pricePerMonth(entry))} a month`}
                  price={formatVnd(entry.amount)}
                  badge={saving > 0 ? `Save ${saving}%` : undefined}
                />
              );
            })}
          </div>

          <div className="space-y-2">
            <PayButtons
              icon={<Crown className="size-4" aria-hidden="true" />}
              what={`${premium.active ? 'Extend' : 'Get'} Premium`}
              disabled={!plan}
              opening={opening}
              onPay={(provider) => plan && startPayment.mutate({ product: plan.id, provider })}
            />
            {premium.active && <p className="text-sm text-muted-foreground">The time is added after your current end date.</p>}
          </div>
        </div>
      </section>

      <section ref={coinsSection} id="coins" aria-labelledby="store-coins" className="grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <h2 id="store-coins" className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              Coins <Coins className="size-7 text-primary" aria-hidden="true" />
            </h2>
            <p className="max-w-[60ch] text-muted-foreground">Bigger packs give more coins for the same money.</p>
          </div>
          <div role="radiogroup" aria-label="Coin pack" className="grid gap-2 sm:grid-cols-3">
            {packs.map((entry, index) => {
              const bonus = bonusPercent(entry, packs[0]);
              return (
                <PlanOption
                  key={entry.id}
                  layout="tile"
                  name="coin-pack"
                  value={entry.id}
                  checked={entry.id === pack?.id}
                  onSelect={() => setPackId(entry.id)}
                  title={formatCoins(entry.grant.coins)}
                  price={formatVnd(entry.amount)}
                  badge={bonus > 0 ? `+${bonus}% coins` : undefined}
                  // One, two, three coins: the bigger the pack, the more of them.
                  icon={
                    <span aria-hidden="true" className="flex h-8 items-center text-primary">
                      {Array.from({ length: index + 1 }, (_, coin) => (
                        <Coins key={coin} className={cn('size-8', coin > 0 && '-ml-4')} />
                      ))}
                    </span>
                  }
                />
              );
            })}
          </div>
          <PayButtons
            icon={<Coins className="size-4" aria-hidden="true" />}
            what="Get coins"
            disabled={!pack}
            opening={opening}
            onPay={(provider) => pack && startPayment.mutate({ product: pack.id, provider })}
          />
        </div>

        <aside className="flex items-center gap-4 border bg-primary/5 p-5 lg:flex-col lg:items-start lg:justify-end">
          <Ping move="point" size={2} className="shrink-0 lg:self-center" />
          <div className="space-y-3">
            <p className="text-muted-foreground">Coins buy avatar items in the wardrobe. They never change a rating or a duel.</p>
            <Button asChild variant="outline">
              <Link to="/wardrobe">
                <Shirt className="size-4" aria-hidden="true" />
                Open wardrobe
              </Link>
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
};
