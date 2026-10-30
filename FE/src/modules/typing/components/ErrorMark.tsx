/** The mark of a wrong word on the speed lines: a plus turned 45 degrees (a cross), in the foreground color. Drawn inside an `<svg>` around (`cx`, `cy`). */
export const ErrorMark = ({ cx = 0, cy = 0, size = 5 }: { cx?: number; cy?: number; size?: number }) => (
  <path
    d={`M${-size} 0H${size}M0 ${-size}V${size}`}
    transform={`translate(${cx} ${cy}) rotate(45)`}
    stroke="var(--foreground)"
    strokeWidth={2.5}
    strokeLinecap="round"
    fill="none"
  />
);
