// What makes a theme acceptable. The backend has the same rules in `BE/src/utils/theme-colors.ts` and rejects what breaks
// them; keep the two in sync (the tests use the same sample colors). Colors are `#rrggbb`.
import type { ThemeColorField, ThemeColors, ThemeMode } from '@/shared/lib/theme';

/** How many themes of their own a user may have. The built-in palette of each mode is not counted. */
export const maxThemes = 9;

export const themeColorFields: { name: ThemeColorField; label: string }[] = [
  { name: 'background', label: 'Background' },
  { name: 'text', label: 'Text' },
  { name: 'muted', label: 'Muted text' },
  { name: 'accent', label: 'Accent' },
];

/** Lowest WCAG contrast ratio of each color on the background: body text, then secondary text and the accent. */
export const minContrast: Record<Exclude<ThemeColorField, 'background'>, number> = { text: 4.5, muted: 3, accent: 3 };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colors, from 1 (same) to 21 (black on white). */
export const contrastRatio = (first: string, second: string) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

/** A background that white text reads better on than black text belongs to a dark theme. */
export const isDarkBackground = (hex: string) => contrastRatio(hex, '#ffffff') > contrastRatio(hex, '#000000');

/** Why these colors cannot be saved as a theme of `mode`: a background of the wrong mode, or colors hard to read on it. */
export const themeProblems = (mode: ThemeMode, colors: ThemeColors) => {
  const problems: { field: ThemeColorField; message: string }[] = [];

  if (isDarkBackground(colors.background) !== (mode === 'dark')) {
    problems.push({
      field: 'background',
      message: mode === 'dark' ? 'The background is too light for Dark mode.' : 'The background is too dark for Light mode.',
    });
  }
  for (const { name, label } of themeColorFields) {
    if (name === 'background') continue;
    const ratio = contrastRatio(colors[name], colors.background);
    if (ratio < minContrast[name]) {
      problems.push({ field: name, message: `${label} is hard to read on this background (${ratio.toFixed(1)}:1, needs ${minContrast[name]}:1).` });
    }
  }
  return problems;
};
