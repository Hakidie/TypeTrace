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
  MAX_PASSAGE_WORDS,
  MIN_OWN_PASSAGE_WORDS,
  PASSAGE_CONTENT_MAX,
  PASSAGE_SOURCE_MAX,
  PASSAGE_TITLE_MAX,
} from '../passages.config';
import type { OwnPassage } from '../types/passage.types';

// Mirrors `createPassageSchema` of `/api/passages`: every field is cleaned first, like the backend does (HTML tags and
// hidden characters out, `…` → `...`), so the limits apply to what is saved and the cleaned text is sent. The title and
// the text are required (a title made only of spaces or tags is empty once cleaned); the source is optional.
const cleanText = z.string().transform(cleanPassageText);

const schema = z.object({
  title: cleanText.pipe(z.string().min(1, 'Title is required').max(PASSAGE_TITLE_MAX, `Max ${PASSAGE_TITLE_MAX} characters`)),
  source: cleanText.pipe(z.string().max(PASSAGE_SOURCE_MAX, `Max ${PASSAGE_SOURCE_MAX} characters`)),
  content: cleanText.pipe(
    z
      .string()
      .max(PASSAGE_CONTENT_MAX, `Max ${PASSAGE_CONTENT_MAX} characters`)
      .refine((text) => countWords(text) <= MAX_PASSAGE_WORDS, `At most ${MAX_PASSAGE_WORDS} words`)
      .refine((text) => countWords(text) >= MIN_OWN_PASSAGE_WORDS, `At least ${MIN_OWN_PASSAGE_WORDS} words`),
  ),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { title: '', source: '', content: '' };

// The same as the admin passage form (`PassageForm`): no borders, Title and Source in the red tint of the typing status
// bar, as wide as their text (`field-sizing-content`), Title on the left and Source on the right.
const fieldClass = 'border-0 text-[1.125rem] focus-visible:ring-0';
const metaFieldClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent focus-visible:ring-0 px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary';

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
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input className={cn(fieldClass, metaFieldClass)} aria-label="Title" placeholder="Title of The Passage" {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>
        {/* `ml-auto` keeps Source on the right, also when the two fields are stacked on a phone. */}
        <div className="ml-auto min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input className={cn(fieldClass, metaFieldClass)} aria-label="Source" placeholder="Source" {...register('source')} />
          <FieldError message={errors.source?.message} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          className={cn(fieldClass, 'min-h-48 flex-1 resize-none text-[2rem] leading-snug lg:min-h-20')}
          aria-label="Content"
          placeholder="Paste or type the text you want to practice…"
          {...register('content')}
        />
        <FieldError message={errors.content?.message} />
      </div>

      {passage?.visibility === 'public' && (
        <p className="text-base text-muted-foreground">
          This passage is public. An admin reads your changes first: the approved text stays public until they are approved.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Bottom left: the same look as the status bar of the typing page. */}
        <p className="w-fit bg-transparent px-3 py-1.5 text-[1.125rem] text-primary">
          {countWords(content)}/{MAX_PASSAGE_WORDS} words
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
            {passage?.visibility === 'public' ? 'Send edit for review' : passage ? 'Update passage' : 'Add passage'}
          </Button>
        </div>
      </div>
    </form>
  );
};
