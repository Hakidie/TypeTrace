import { Coins } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

interface CoinPackCardProps {
  /** The radio group it belongs to. */
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  /** The size of the pack, e.g. "1.400 coins". */
  title: string;
  price: string;
  /** A short tag, e.g. "+12% coins". */
  badge?: string;
  /** How many coins are drawn before the size: the bigger the pack, the more of them. */
  stack: number;
  /** How many coins fall around the picture (at most 20), so a bigger pack looks richer at a glance. */
  pile: number;
  /** The picture on the stage, standing on the pixel floor (the learner's avatar). */
  illustration: ReactNode;
}

/** The floor of square pixels the coins sit on, drawn from the theme accent (same idea as the Premium stage). */
const FLOOR =
  'pointer-events-none absolute inset-x-0 bottom-0 h-2/3 [background-size:12px_12px] ' +
  '[background-image:linear-gradient(to_right,color-mix(in_oklab,var(--color-primary)_16%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-primary)_16%,transparent)_1px,transparent_1px)] ' +
  '[mask-image:linear-gradient(to_top,black,transparent)]';

const CELL_COLS = 5;
const CELL_ROWS = 4;
const CELL_COUNT = CELL_COLS * CELL_ROWS;

/**
 * Where coin number `index` hangs in the air of the stage, as if it were falling. The stage is cut into a 5 x 4 grid and
 * every coin keeps to its own cell (at most 20 coins), a little off its middle and tilted, so two coins can never touch
 * while the card still looks scattered. The cells are taken in a fixed jumbled order (7 and 20 share no factor, so none
 * repeats), which spreads a small pack over the whole stage. Fixed numbers, no randomness: every render looks the same.
 */
const coinSpot = (index: number) => {
  const cell = (index * 7) % CELL_COUNT;
  const col = cell % CELL_COLS;
  const row = Math.floor(cell / CELL_COLS);
  // The coin (at most 20px) is a third of a cell wide, so a start between 5 % and 45 % of the cell keeps all of it inside.
  const nudgeX = ((index + 1) * 0.7548776662) % 1;
  const nudgeY = ((index + 1) * 0.569840291) % 1;
  return {
    left: `${(col + 0.05 + 0.4 * nudgeX) * (100 / CELL_COLS)}%`,
    top: `${4 + (row + 0.05 + 0.4 * nudgeY) * (88 / CELL_ROWS)}%`,
    size: 14 + ((index * 7) % 3) * 3,
    tilt: ((index * 53) % 80) - 40,
    delay: ((index * 0.37) % 1.6).toFixed(2),
  };
};

/**
 * A coin pack of the Store: a stage with an illustration (the learner's avatar) on a pixel floor with coins falling around it, the size of the pack under it with its coins before it, and the price as
 * a band at the bottom that fills with the accent when the pack is chosen. A real radio input (keyboard and screen reader
 * come with it), the whole card is its label. Motion (the pile lifting, the band filling) is skipped for reduced motion.
 */
export const CoinPackCard = ({ name, value, checked, onSelect, title, price, badge, stack, pile, illustration }: CoinPackCardProps) => (
  <label className="group/pack block h-full cursor-pointer">
    <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
    <div
      className={cn(
        'flex h-full flex-col border bg-card/60 backdrop-blur-sm',
        'outline-2 -outline-offset-2 outline-transparent transition-[outline-color,transform] duration-150',
        'group-has-[:checked]/pack:outline-primary group-has-[:focus-visible]/pack:outline-ring',
        'active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100',
      )}
    >
      <div className="relative flex flex-1 items-end justify-center overflow-hidden bg-primary/5 px-4 pt-8">
        <span aria-hidden="true" className={FLOOR} />
        {badge && <span className="absolute left-0 top-3 bg-primary px-2 py-1 text-xs font-semibold leading-none text-primary-foreground">{badge}</span>}
        {Array.from({ length: pile }, (_, coin) => {
          const { left, top, size, tilt, delay } = coinSpot(coin);
          return (
            <span
              key={coin}
              aria-hidden="true"
              className="absolute group-hover/pack:coin-fall group-has-[:checked]/pack:coin-fall"
              style={{ left, top, transform: `rotate(${tilt}deg)`, '--coin-tilt': `${tilt}deg`, '--coin-delay': `${delay}s` } as CSSProperties}
            >
              <Coins className="fill-primary/25 stroke-[1.5] text-primary" style={{ width: size, height: size }} />
            </span>
          );
        })}
        <span className="relative transition-transform duration-200 group-hover/pack:-translate-y-1 group-has-[:checked]/pack:-translate-y-1 motion-reduce:transition-none">
          {illustration}
        </span>
      </div>
      <span className="flex items-center justify-center gap-3 px-4 py-3 text-2xl font-semibold tabular-nums text-foreground">
        <span aria-hidden="true" className="flex items-center text-primary">
          {Array.from({ length: stack }, (_, coin) => (
            <Coins key={coin} className={cn('size-8', coin > 0 && '-ml-4')} />
          ))}
        </span>
        {title}
      </span>
      <span
        className={cn(
          'border-t px-4 py-2.5 text-center text-lg font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none',
          'text-foreground group-hover/pack:bg-primary/10',
          'group-has-[:checked]/pack:bg-primary group-has-[:checked]/pack:text-primary-foreground',
        )}
      >
        {price}
      </span>
    </div>
  </label>
);
