import { Check, CircleHelp, Minus } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import type { AvatarPose } from '@/modules/avatar/types/avatar.types';
import { formatVnd } from '@/modules/payments/lib/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { PASSAGE_LIMIT_HELP, PERMISSIONS, PLAN_AVATARS } from '../plan.config';
import type { PlanConfig } from '../types/plan.types';

interface PlanOfferCardProps {
  /** `free` or `premium`: picks the avatar; Premium is the featured offer (bigger stage and price, its avatar celebrates). */
  planKey: 'free' | 'premium';
  name: string;
  config: PlanConfig;
  /** The plan the learner is on: outlined, with a "Your plan" tag. */
  current?: boolean;
  /** How many passages the learner uses: shown with the limit (`8/9 used`) on the card of their own plan. */
  used?: number;
  /** Under the price: the cheapest month on a longer term, e.g. "or 75.250 ₫ a month with 12 months". */
  priceNote?: string;
  /** At the bottom of the card, as wide as the card: the button that leads to the Store. */
  action?: ReactNode;
  /** Its place in the entrance (0, 1...): the cards rise in one after the other. */
  order?: number;
}

/** The words of each perk for a learner (the admin page keeps its own labels in `PERMISSIONS`). */
const PERK_TEXT: Record<(typeof PERMISSIONS)[number]['field'], string> = {
  canCreateErrorPractice: 'Train on your weak spots',
  canUsePublicPassages: "Practice other learners' public passages",
};

/** How long the Premium avatar holds its arms up when the dialog opens, before it stands at rest. */
const CELEBRATE_MS = 1600;

/** A pixel floor fading upward under the avatar (as on the Store), drawn from the theme accent. */
const PIXEL_FLOOR =
  'pointer-events-none absolute inset-x-0 bottom-0 h-2/3 [background-size:12px_12px] ' +
  '[background-image:linear-gradient(to_right,color-mix(in_oklab,var(--color-primary)_16%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-primary)_16%,transparent)_1px,transparent_1px)] ' +
  '[mask-image:linear-gradient(to_top,black,transparent)]';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const Perk = ({ on, children, help }: { on: boolean; children: ReactNode; help?: string }) => (
  <li className={cn('flex items-start gap-3', on ? 'text-foreground' : 'text-muted-foreground')}>
    {on ? <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" /> : <Minus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
    <span className="min-w-0 flex-1">
      {children}
      <span className="sr-only">{on ? ' (included)' : ' (not included)'}</span>
    </span>
    {help && (
      <Tooltip>
        <TooltipTrigger type="button" aria-label="About this" className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary">
          <CircleHelp className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent className="max-w-64 whitespace-normal">{help}</TooltipContent>
      </Tooltip>
    )}
  </li>
);

/**
 * One plan in the plan dialog, to read and choose. Free is the quiet reference: small stage, plain price. Premium is the
 * offer: a taller stage where the avatar wearing the Dragon set raises its arms once when the dialog opens, the price large
 * in the accent with the cheapest month under it, a thick accent border. Both list what they give as included / not included.
 */
export const PlanOfferCard = ({ planKey, name, config, current = false, used, priceNote, action, order = 0 }: PlanOfferCardProps) => {
  const premium = planKey === 'premium';
  const [pose, setPose] = useState<AvatarPose>(() => (premium && !reducedMotion() ? 'win' : 'idle'));

  // The focal moment: Premium celebrates as it comes in, then rests (its baby dragon keeps flapping).
  useEffect(() => {
    if (pose !== 'win') return;
    const timer = setTimeout(() => setPose('idle'), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [pose]);

  return (
    <div
      role="group"
      aria-label={`${name} plan`}
      style={{ animationDelay: `${order * 90}ms` } as CSSProperties}
      className={cn(
        'plan-enter relative flex flex-col gap-5 p-6',
        premium ? 'bg-primary/5 outline-2 -outline-offset-2 outline-primary' : current && 'outline-2 -outline-offset-2 outline-primary',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className={cn('font-bold tracking-tight', premium ? 'text-3xl text-primary' : 'text-2xl text-muted-foreground')}>{name}</h3>
        {current && <span className="bg-primary px-2 py-1 text-xs font-semibold leading-none text-primary-foreground">Your plan</span>}
      </div>

      <div className={cn('relative flex items-end justify-center overflow-hidden border', premium ? 'h-60 border-primary/50 bg-background/60' : 'h-40 border-border')}>
        <div aria-hidden="true" className={PIXEL_FLOOR} />
        <AvatarSprite look={PLAN_AVATARS[planKey]} pose={pose} scale={premium ? 3 : 2} eager label={`Avatar of the ${name} plan`} className="relative" />
      </div>

      <div className="space-y-1">
        <p className="flex items-baseline gap-2">
          <span className={cn('font-black tracking-tight tabular-nums', premium ? 'text-5xl text-primary' : 'text-3xl text-foreground')}>{formatVnd(config.priceVnd)}</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </p>
        {priceNote && <p className="text-sm text-muted-foreground">{priceNote}</p>}
      </div>

      <TooltipProvider delayDuration={200}>
        <ul className={cn('space-y-3', premium ? 'text-base' : 'text-sm')}>
          <Perk on help={PASSAGE_LIMIT_HELP}>
            Up to <span className="font-semibold tabular-nums">{config.maxPassages}</span> passages of your own
            {current && used !== undefined && <span className="ml-2 text-muted-foreground tabular-nums">{`${used}/${config.maxPassages} used`}</span>}
          </Perk>
          {PERMISSIONS.map(({ field, help }) => (
            <Perk key={field} on={config[field]} help={help}>
              {PERK_TEXT[field]}
            </Perk>
          ))}
          <Perk on={premium}>The Dragon set for your avatar</Perk>
        </ul>
      </TooltipProvider>

      {action && <div className="mt-auto pt-2">{action}</div>}
    </div>
  );
};
