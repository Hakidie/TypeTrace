// The look of the login/register pages: white (or near-black red in dark mode) page, blurred red glass card,
// maroon fields, red accents. Tailwind reads the `--color-*` variables, so those are the ones overridden here.
// Put it on a wrapper; give the wrapper's direct child `redGlassCard` to get the glass card.
export const redGlassTheme =
  'bg-white text-foreground [--color-ring:var(--color-destructive)] [--color-background:rgb(255_255_255/0.6)] [--color-input:rgb(176_30_30/0.3)] dark:bg-[#140606] dark:[--color-background:#341414] dark:[--color-input:#341414] dark:[--color-border:#3a1616] dark:[--color-foreground:#e6d2d2] dark:[--color-muted-foreground:#a87878] dark:[--color-destructive:#b01e1e] dark:[--color-destructive-foreground:#f3dcdc]';

export const redGlassCard = '[&>*]:border-transparent [&>*]:bg-destructive/10 [&>*]:backdrop-blur-md';
