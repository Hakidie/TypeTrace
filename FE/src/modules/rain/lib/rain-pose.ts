import type { AvatarPose } from '@/modules/avatar/types/avatar.types';
import type { RainPhase, RainReaction } from '../types/rain.types';

/** The avatar pose of the moment: the end of the game decides, then a word that just landed, otherwise typing. */
export const rainPose = (phase: RainPhase, reaction: RainReaction | null): AvatarPose => {
  if (phase === 'won') return 'win';
  if (phase === 'lost') return 'lose';
  if (phase === 'ready') return 'idle';
  return reaction?.kind === 'shake' ? 'lose' : 'typing';
};
