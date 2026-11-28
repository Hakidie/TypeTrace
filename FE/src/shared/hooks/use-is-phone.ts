import { useMediaQuery } from '@/shared/hooks/use-media-query';

/** A phone-sized screen (below Tailwind's `md`): the header navigation moves to the bottom tab bar. */
export const useIsPhone = () => !useMediaQuery('(min-width: 768px)');
