// The font of the whole interface and the size of the typing passage a learner can choose in Settings (SCRUM-158).
// Pure file: the frontend has an identical copy in `FE/src/shared/lib/app-font.ts` (keep the pair identical).

export const appFonts = ['inter', 'be-vietnam-pro', 'lexend', 'noto-serif', 'jetbrains-mono'] as const;
export type AppFont = (typeof appFonts)[number];

/** The font a learner has until they choose another. */
export const DEFAULT_APP_FONT: AppFont = 'jetbrains-mono';

/** The size of the passage text on the typing page, in rem: 2 rem is the size it had before it could be chosen. */
export const TYPING_FONT_SIZE = { min: 1, max: 2.5, step: 0.125, default: 2 } as const;
