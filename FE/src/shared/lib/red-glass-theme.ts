// The look of the login/register pages: page in the theme background, blurred glass card, tinted fields, accent color.
// Only theme variables are used (see `index.css`), so a custom theme restyles these pages too. Tailwind reads the `--color-*` variables, so those are the ones overridden here.
// Put it on a wrapper; give the wrapper's direct child `redGlassCard` to get the glass card.
export const redGlassTheme =
  'bg-[var(--theme-background)] text-foreground [--color-ring:var(--theme-accent)] [--color-background:color-mix(in_srgb,var(--theme-background)_60%,transparent)] [--color-input:color-mix(in_srgb,var(--theme-accent)_30%,transparent)] [--color-destructive:var(--theme-accent)] dark:[--color-background:var(--card)] dark:[--color-input:var(--card)]';

export const redGlassCard = '[&>*]:border-transparent [&>*]:bg-destructive/10 [&>*]:backdrop-blur-md';
