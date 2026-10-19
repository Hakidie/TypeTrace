// Panel titles look like the Source field: red tint, red text, 1.5rem.
// The content of a panel sits in a frame: the normal border color, the thin red of the empty and error states (`destructive/40`) while hovered.
// Use them with `<Panel bare titleClassName={panelTitleClass} className={panelBodyClass}>`.
export const panelBodyClass = 'border border-border p-3 transition-colors hover:border-destructive/40';
export const panelTitleClass = 'w-fit bg-primary/15 px-3 py-1.5 text-[1.5rem] text-primary';
