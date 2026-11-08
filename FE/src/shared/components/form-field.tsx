import type { ReactNode } from 'react';
import { Label } from '@/shared/components/ui/label';

interface FormFieldProps {
  /** Must match the `id` of the input inside, so the label is clickable. */
  id: string;
  label: string;
  /** Usually `errors.<field>?.message` from react-hook-form. */
  error?: string;
  hint?: ReactNode;
  /** Keep the label for screen readers and the click target, but do not show it (the placeholder names the field). */
  hideLabel?: boolean;
  children: ReactNode;
}

/**
 * Label + input + error message, laid out the same everywhere.
 *
 *   <FormField id="title" label="Title" error={errors.title?.message}>
 *     <Input id="title" {...register('title')} />
 *   </FormField>
 */
export const FormField = ({ id, label, error, hint, hideLabel, children }: FormFieldProps) => (
  <div className="space-y-2">
    {hideLabel && (
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
    )}
    {(!hideLabel || hint) && (
      <div className="flex items-center justify-between">
        {!hideLabel && <Label htmlFor={id}>{label}</Label>}
        {hint && <span className="ml-auto text-sm text-muted-foreground">{hint}</span>}
      </div>
    )}
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
        {error}
      </p>
    )}
  </div>
);
