// Rules for the four colors of a theme (SCRUM-163). The frontend has the same functions in
// `FE/src/modules/settings/lib/contrast.ts`; keep the two in sync (both are tested with the same sample colors).

export const THEME_COLOR_FIELDS = ['background', 'text', 'muted', 'accent'] as const;
export type ThemeColorField = (typeof THEME_COLOR_FIELDS)[number];
export type ThemeColors = Record<ThemeColorField, string>;

/** Lowest WCAG contrast ratio of each color on the background: body text, then secondary text and the accent. */
export const MIN_CONTRAST: Record<Exclude<ThemeColorField, 'background'>, number> = {
  text: 4.5,
  muted: 3,
  accent: 3
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two `#rrggbb` colors, from 1 (same) to 21 (black on white). */
export const contrastRatio = (first: string, second: string) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

/** A background that white text reads better on than black text belongs to a dark theme. */
export const isDarkBackground = (hex: string) => contrastRatio(hex, '#ffffff') > contrastRatio(hex, '#000000');

const labels: Record<ThemeColorField, string> = { background: 'Background', text: 'Text', muted: 'Muted text', accent: 'Accent' };

/** One message per color that is hard to read on the background. Empty when the theme is fine. */
export const contrastProblems = (colors: ThemeColors) =>
  (Object.keys(MIN_CONTRAST) as Array<keyof typeof MIN_CONTRAST>).flatMap((field) => {
    const ratio = contrastRatio(colors[field], colors.background);
    if (ratio >= MIN_CONTRAST[field]) return [];
    const message = `${labels[field]} is hard to read on this background (${ratio.toFixed(1)}:1, needs ${MIN_CONTRAST[field]}:1)`;
    return [{ field, message }];
  });
