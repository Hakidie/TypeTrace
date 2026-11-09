import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { Switch } from '@/shared/components/ui/switch';
import { HelpLabel } from './HelpLabel';
import type { ReactNode } from 'react';
import { PASSAGE_LIMIT_HELP, PERMISSIONS, PLAN_AVATARS } from '../plan.config';
import type { PlanConfig } from '../types/plan.types';

interface PlanOfferCardProps {
  id: string;
  /** `free` or `premium`: picks the avatar that illustrates the plan. */
  planKey: 'free' | 'premium';
  name: string;
  config: PlanConfig;
  /** The plan the learner is on: its card is outlined in the main color. */
  current?: boolean;
  /** How many passages the learner uses: shown with the limit (`8/9`) on the card of their own plan. */
  used?: number;
  /** At the bottom of the card, inside it, as wide as the card: the button to buy the plan, or that it is owned. */
  action?: ReactNode;
}

// The labels of the options are 20px here (24px on the admin cards).
const LABEL_CLASS = 'text-xl font-semibold leading-none tracking-wide text-primary/70';

/**
 * One plan to read, built like the plan cards of the admin Plans page (name at the top left, under it the avatar that illustrates the plan with the price on its row, the passage limit and the two permissions under them,
 * each with a "?" that explains it), without anything to edit: the numbers are text and the switches are shown, not changeable.
 */
export const PlanOfferCard = ({ id, planKey, name, config, current = false, used, action }: PlanOfferCardProps) => (
  <div role="group" aria-label={`${name} plan`} className={`group flex flex-col gap-8 border p-4 transition-colors hover:border-primary ${current ? 'border-primary' : 'border-border'}`}>
    <div className="flex flex-1 flex-col gap-4">
      <span className="block text-[2rem] font-bold leading-none text-primary/70">{name}</span>
      <div className="grid flex-1 grid-cols-[auto_1fr] gap-8">
        {/* Left column: the avatar that illustrates the plan, filling the column. */}
        <div className="flex items-center justify-center">
          <AvatarSprite look={PLAN_AVATARS[planKey]} scale={3} label={`Avatar of the ${name} plan`} />
        </div>
        {/* Right column: the price level with the top of the avatar, then the passage limit and the two permissions. */}
        <div className="flex flex-col justify-between gap-6">
          <div className="flex flex-col items-end text-right">
            <p className="text-[3rem] font-black leading-none text-primary">{config.priceVnd.toLocaleString('en-US')}</p>
            <span className="block text-sm text-muted-foreground">VND/month</span>
          </div>
          <div className="space-y-6">
        <div className="flex min-h-9 items-center justify-between gap-4">
          <HelpLabel htmlFor={`${id}-max`} text="Passage limit" help={PASSAGE_LIMIT_HELP} className={LABEL_CLASS} />
          <p id={`${id}-max`} className="h-9 text-3xl font-black leading-none text-primary">
            {current && used !== undefined ? `${used}/${config.maxPassages}` : config.maxPassages}
          </p>
        </div>
        {PERMISSIONS.map(({ field, label, help }) => (
          <div key={field} className="flex min-h-9 items-center justify-between gap-4">
            <HelpLabel htmlFor={`${id}-${field}`} text={label} help={help} className={LABEL_CLASS} />
            <Switch id={`${id}-${field}`} aria-label={`${label} (${name})`} checked={config[field]} disabled className="disabled:cursor-default disabled:opacity-100" />
          </div>
        ))}
          </div>
        </div>
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);
