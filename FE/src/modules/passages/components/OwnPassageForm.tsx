import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { useAddOwnPassage, useUpdateOwnPassage } from '../hooks/use-learner-passages';
import { cleanPassageText } from '../lib/passage-text';
import {
  countWords,
  MAX_OWN_PASSAGES,
  MIN_OWN_PASSAGE_WORDS,
  PASSAGE_CONTENT_MAX,
  PASSAGE_SOURCE_MAX,
  PASSAGE_TITLE_MAX,
} from '../passages.config';
import type { OwnPassage } from '../types/passage.types';

// Mirrors `createPassageSchema` of `/api/passages`: every field is cleaned first, like the backend does (HTML tags and
// hidden characters out, `…` → `...`), so the limits apply to what is saved and the cleaned text is sent. All three are
// required: a title or a source made only of spaces or tags is empty once cleaned.
const cleanText = z.string().transform(cleanPassageText);

const schema = z.object({
  title: cleanText.pipe(z.string().min(1, 'Title is required').max(PASSAGE_TITLE_MAX, `Max ${PASSAGE_TITLE_MAX} characters`)),
  source: cleanText.pipe(z.string().min(1, 'Source is required').max(PASSAGE_SOURCE_MAX, `Max ${PASSAGE_SOURCE_MAX} characters`)),
  content: cleanText.pipe(
    z
      .string()
      .max(PASSAGE_CONTENT_MAX, `Max ${PASSAGE_CONTENT_MAX} characters`)
      .refine((text) => countWords(text) >= MIN_OWN_PASSAGE_WORDS, `At least ${MIN_OWN_PASSAGE_WORDS} words`),
  ),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { title: '', source: '', content: '' };

// Same look as the admin passage form (`PassageForm`): no borders, Title and Source in the red tint of the typing status bar.
const fieldClass = 'border-0 text-[1.125rem]';
const metaClass = 'h-12 bg-primary/15 px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary/60 focus-visible:ring-0';

/** No visible labels: the placeholders say what each field is, `aria-label` serves screen readers. */
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

interface OwnPassageFormProps {
  /** How many passages of their own the learner has (unknown while loading); adding stops at `MAX_OWN_PASSAGES`. */
  ownCount?: number;
  /** The passage to edit, with its text. Without it the form adds a new passage. */
  passage?: OwnPassage;
  /** Edit mode: called after a successful update and by the Cancel button. */
  onDone?: () => void;
}

/**
 * Where a learner pastes (or types) a text of their own to practice. It is saved private and can be typed at once. With
 * `passage` it edits that passage instead, like the admin `PassageForm`; remount it (`key`) to switch passage.
 */
export const OwnPassageForm = ({ ownCount, passage, onDone }: OwnPassageFormProps) => {
  const addPassage = useAddOwnPassage();
  const updatePassage = useUpdateOwnPassage();
  const isPending = addPassage.isPending || updatePassage.isPending;
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: passage ? { title: passage.title, source: passage.source, content: passage.content } : emptyValues,
  });
  // Counted as it will be saved.
  const content = cleanPassageText(useWatch({ control, name: 'content' }));
  const full = !passage && ownCount !== undefined && ownCount >= MAX_OWN_PASSAGES;

  const submit = handleSubmit((input) => {
    if (passage) {
      updatePassage.mutate({ id: passage._id, input }, { onSuccess: onDone });
      return;
    }
    addPassage.mutate(input, { onSuccess: () => reset(emptyValues) });
  });

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Input className={cn(fieldClass, metaClass)} aria-label="Title" placeholder="Title" {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>
        <div className="min-w-0 space-y-2">
          <Input
            className={cn(fieldClass, metaClass)}
            aria-label="Source"
            placeholder="Source: a book, a website or your own"
            {...register('source')}
          />
          <FieldError message={errors.source?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Textarea
          className={cn(fieldClass, 'h-48 text-[2rem] leading-snug')}
          aria-label="Content"
          placeholder="Paste or type the text you want to practice…"
          {...register('content')}
        />
        <FieldError message={errors.content?.message} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Bottom left: the same look as the status bar of the typing page. */}
        <p className="w-fit bg-primary/15 px-3 py-1.5 text-[1.125rem] text-primary">
          {countWords(content)} words · {content.length}/{PASSAGE_CONTENT_MAX}
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {!passage && ownCount !== undefined && (
            <p className="text-base text-muted-foreground">
              Your passages: {ownCount}/{MAX_OWN_PASSAGES}
              {full && '. Delete one to add another.'}
            </p>
          )}
          {passage && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={full || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {passage ? 'Update passage' : 'Add passage'}
          </Button>
        </div>
      </div>
    </form>
  );
};
