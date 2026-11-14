// The size of the typing passage follows the font size the learner chose (SCRUM-158). Pure sums, in rem.

/** `leading-snug` of the passage: the line is 1.375 times the font size (2.75rem at the default 2rem). */
const LINE_HEIGHT = 1.375;

/** The space between two lines of the passage (`gap-y-2`). */
export const GAP_REM = 0.5;

/** The height of one line of text. */
export const lineRem = (fontSizeRem: number) => fontSizeRem * LINE_HEIGHT;

/** The height of a box that shows `rows` lines. */
export const passageHeightRem = (fontSizeRem: number, rows: number) => rows * lineRem(fontSizeRem) + (rows - 1) * GAP_REM;

/** How far the passage scrolls to move the line being typed to the second row: one line and its gap. */
export const scrollStepRem = (fontSizeRem: number) => lineRem(fontSizeRem) + GAP_REM;
