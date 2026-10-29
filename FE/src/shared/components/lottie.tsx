import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from '@/shared/lib/utils';

/** The animations in FE/public/lottie (sources and authors in its CREDITS.md). */
export type LottieName = 'fire-streak' | 'confetti' | 'trophy';

interface LottieProps {
  name: LottieName;
  loop?: boolean;
  /** Starts the animation; turning it on again plays it again from the start. */
  play?: boolean;
  /** The size of the frame (the player fills it), e.g. `size-10`. */
  className?: string;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Decorative motion that CSS cannot draw (a flame, confetti, a trophy). It keeps the colors of its file, an exception to the
 * theme tokens like the avatar sprites, is hidden from screen readers, and shows its first frame still for reduced motion.
 */
export const Lottie = ({ name, loop = false, play = true, className }: LottieProps) => {
  const still = reducedMotion();
  return (
    <div aria-hidden="true" className={cn('pointer-events-none shrink-0', className)}>
      <DotLottieReact
        key={play ? 'playing' : 'waiting'}
        src={`/lottie/${name}.lottie`}
        loop={loop && !still}
        autoplay={play && !still}
        className="size-full"
      />
    </div>
  );
};
