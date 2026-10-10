import type { ReactNode } from 'react';
import { Label } from '@/shared/components/ui/label';

interface FormFieldProps {
  /** Must match the `id` of the input inside, so the label is clickable. */
  id: string;
  label: string;
  /** Usually `errors.<field>?.message` from react-hook-form. */
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * Label + input + error message, laid out the same everywhere.
 *
 *   <FormField id="title" label="Title" error={errors.title?.message}>
 *     <Input id="title" {...register('title')} />
 *   </FormField>
 */
export const FormField = ({ id, label, error, hint, children }: FormFieldProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label htmlFor={id}>{label}</Label>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
        {error}
      </p>
    )}
  </div>
);
