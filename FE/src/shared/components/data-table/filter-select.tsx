export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  /** `''` means no filter. */
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Text of the "no filter" option. */
  allLabel?: string;
}

/** Dropdown filter for list toolbars. The empty value means "all". */
export const FilterSelect = ({ label, value, options, onChange, allLabel = 'All' }: FilterSelectProps) => (
  <label className="flex items-center gap-2 text-base">
    <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    <select
      className="h-10 border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);
