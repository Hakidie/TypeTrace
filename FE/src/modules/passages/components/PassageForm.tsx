import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type BaseSyntheticEvent } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { useCreatePassage, useSetPassageStatus, useUpdatePassage } from '../hooks/use-passages';
import { countWords, PASSAGE_CONTENT_MAX } from '../passages.config';
import { nextPassageStatus, type Passage, type PassageStatus } from '../types/passage.types';

// Mirrors the limits of the Passage model (BE/src/models/passage.model.ts).
const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Max 120 characters'),
  source: z.string().trim().min(1, 'Source is required').max(300, 'Max 300 characters'),
  content: z.string().trim().min(1, 'Content is required').max(5000, 'Max 5000 characters'),
  isPlacement: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// No border (the focus ring stays) and 1.125rem text, placeholders included.
const fieldClass = 'border-0 text-[1.125rem]';

// Title and Source look like the status bar of the typing page (red tint, red text).
// `field-sizing-content`: the field is as wide as its text (the placeholder while empty); the wrapper caps it at half the row.
const metaFieldClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-primary/15 focus-visible:ring-0 px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary/60';

const emptyValues: FormValues = { title: '', source: '', content: '', isPlacement: false };

const CONTENT_PLACEHOLDER = 'Hà Nội vào thu, gió heo may se lạnh, hoa sữa thơm nồng trên từng con phố nhỏ.';

/** No visible labels in this form: the placeholders say what each field is, `aria-label` serves screen readers. */
const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

interface PassageFormProps {
  /** Passage to edit. Without it the form creates a new passage (always as a draft). */
  passage?: Passage;
  /** Edit mode: called after a successful update and by the Cancel button. */
  onDone?: () => void;
}

/** Form that creates a passage, or edits one when `passage` is given. Remount it (`key`) to switch passage. */
export const PassageForm = ({ passage, onDone }: PassageFormProps) => {
  const createPassage = useCreatePassage();
  const updatePassage = useUpdatePassage();
  const setStatus = useSetPassageStatus();
  const isPending = createPassage.isPending || updatePassage.isPending || setStatus.isPending;
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: passage
      ? { title: passage.title, source: passage.source, content: passage.content, isPlacement: passage.isPlacement }
      : emptyValues,
  });

  const content = useWatch({ control, name: 'content' });

  // The status button flips between the saved status and the next one; the change is saved with the form.
  const [status, setStatusChoice] = useState<PassageStatus>(passage?.status ?? 'draft');
  const next = passage ? nextPassageStatus[passage.status] : undefined;

  /** Saves the passage, then moves it to the status chosen with the status button (a new passage stays a draft). */
  const save = handleSubmit(async (input) => {
    const saved = passage
      ? await updatePassage.mutateAsync({ id: passage._id, input })
      : await createPassage.mutateAsync(input);
    if (status !== saved.status) await setStatus.mutateAsync({ id: saved._id, status });
    if (passage) {
      onDone?.();
      return;
    }
    reset(emptyValues);
  });

  // `.catch` keeps a failed request from becoming an unhandled rejection; the toast already explains it.
  const submit = (event?: BaseSyntheticEvent) => void save(event).catch(() => undefined);

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input className={cn(fieldClass, metaFieldClass)} aria-label="Title" placeholder="Mùa thu Hà Nội" {...register('title')} />
          <FieldError id="passage-title-error" message={errors.title?.message} />
        </div>
        {/* `ml-auto` keeps Source on the right, also when the two fields are stacked on a phone. */}
        <div className="ml-auto min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input
            className={cn(fieldClass, metaFieldClass)}
            aria-label="Source"
            placeholder="Wikipedia"
            {...register('source')}
          />
          <FieldError id="passage-source-error" message={errors.source?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Textarea
          className={cn(fieldClass, 'h-48 text-[2rem] leading-snug')}
          aria-label="Content"
          placeholder={CONTENT_PLACEHOLDER}
          {...register('content')}
        />
        <FieldError id="passage-content-error" message={errors.content?.message} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Bottom left: the same look as the status bar of the typing page. */}
        <p className="w-fit bg-primary/15 px-3 py-1.5 text-[1.125rem] text-primary">
          {countWords(content)} words · {content.length}/{PASSAGE_CONTENT_MAX}
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Controller
            control={control}
            name="isPlacement"
            render={({ field }) => (
              // The name stays "Placement passage"; `aria-checked` tells the state, the visible words show it.
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                aria-label="Placement passage"
                title="Used for the placement test."
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  field.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {field.value && <CheckCircle2 className="size-5" />}
                {field.value ? 'Placement passage' : 'Regular passage'}
              </button>
            )}
          />
          {/* Edit mode: the status of the passage, a button that flips it. Draft and archived look like "Regular passage", published is highlighted. */}
          {passage && (
            <button
              type="button"
              aria-label={`Status: ${status}`}
              disabled={!next}
              title={next ? `Click to change to ${status === passage.status ? next : passage.status}` : undefined}
              onClick={() => setStatusChoice(status === passage.status ? next! : passage.status)}
              className={cn(
                'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                status === 'published' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {status === 'published' && <CheckCircle2 className="size-5" />}
              {status}
            </button>
          )}
          {passage && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {passage ? 'Update passage' : 'Add passage'}
          </Button>
        </div>
      </div>
    </form>
  );
};
