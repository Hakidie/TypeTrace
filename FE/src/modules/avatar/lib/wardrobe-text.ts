import { i18n } from '@/shared/i18n/i18n';
import type { AvatarPose, AvatarSlot, AvatarUnlock } from '../types/avatar.types';

/** The wardrobe's words that live outside components (the slot, the pose and why an item is locked), in the interface language. */
export const slotName = (slot: AvatarSlot) => i18n.t(`wardrobe:slots.${slot}`);

export const poseName = (pose: AvatarPose) => i18n.t(`wardrobe:poses.${pose}`);

export const lockText = (unlock: AvatarUnlock) => {
  if (unlock.kind === 'shop') return i18n.t('wardrobe:lock.coins', { price: unlock.price });
  if (unlock.kind === 'tier') return i18n.t('wardrobe:lock.tier', { tier: `${unlock.tier[0].toUpperCase()}${unlock.tier.slice(1)}` });
  if (unlock.kind === 'season') return i18n.t('wardrobe:lock.season');
  if (unlock.kind === 'premium') return i18n.t('wardrobe:lock.premium');
  return '';
};
