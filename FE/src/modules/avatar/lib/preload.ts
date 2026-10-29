import type { AvatarLook, AvatarPose } from '../types/avatar.types';
import { layerFiles } from './layers';

const POSES: AvatarPose[] = ['idle', 'typing', 'win', 'lose'];

/** Fetches every image of an avatar in every pose, so a game that changes the pose does not flash an empty avatar. */
export const preloadAvatar = (look: AvatarLook): void => {
  const files = new Set(POSES.flatMap((pose) => layerFiles(look, pose)));
  files.forEach((file) => {
    new Image().src = `/avatar/${file}`;
  });
};
