import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { useAddOwnPassage } from '../hooks/use-learner-passages';
import { cleanPassageText } from '../lib/passage-text';
import { countWords, MAX_OWN_PASSAGES, MIN_OWN_PASSAGE_WORDS, PASSAGE_CONTENT_MAX, PASSAGE_TITLE_MAX } from '../passages.config';

// Mirrors `createPassageSchema` of `/api/passages`: the text is cleaned first, like the backend does (HTML tags and
// hidden characters out, `…` → `...`), so the limits apply to what is saved and the cleaned text is sent.
const cleanText = z.string().transform(cleanPassageText);

const schema = z.object({
  title: cleanText.pipe(z.string().max(PASSAGE_TITLE_MAX, `Max ${PASSAGE_TITLE_MAX} characters`)),
  content: cleanText.pipe(
    z
      .string()
      .max(PASSAGE_CONTENT_MAX, `Max ${PASSAGE_CONTENT_MAX} characters`)
      .refine((text) => countWords(text) >= MIN_OWN_PASSAGE_WORDS, `At least ${MIN_OWN_PASSAGE_WORDS} words`),
  ),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { title: '', content: '' };

// Same look as the admin passage form (`PassageForm`): no borders, the title in the red tint of the typing status bar.
const fieldClass = 'border-0 text-[1.125rem]';
const titleClass = 'h-12 bg-primary/15 px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary/60 focus-visible:ring-0';

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
}

/** Where a learner pastes (or types) a text of their own to practice. It is saved private and can be typed at once. */
export const OwnPassageForm = ({ ownCount }: OwnPassageFormProps) => {
  const addPassage = useAddOwnPassage();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });
  // Counted as it will be saved.
  const content = cleanPassageText(useWatch({ control, name: 'content' }));
  const full = ownCount !== undefined && ownCount >= MAX_OWN_PASSAGES;

  // An empty title is left out: the backend makes one from the first words of the text.
  const submit = handleSubmit(({ title, content: text }) =>
    addPassage.mutate({ ...(title ? { title } : {}), content: text }, { onSuccess: () => reset(emptyValues) }),
  );

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Input className={cn(fieldClass, titleClass)} aria-label="Title" placeholder="Title (optional)" {...register('title')} />
        <FieldError message={errors.title?.message} />
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
          {ownCount !== undefined && (
            <p className="text-base text-muted-foreground">
              Your passages: {ownCount}/{MAX_OWN_PASSAGES}
              {full && '. Delete one to add another.'}
            </p>
          )}
          <Button type="submit" disabled={full || addPassage.isPending}>
            {addPassage.isPending && <Loader2 className="size-4 animate-spin" />}
            Add passage
          </Button>
        </div>
      </div>
    </form>
  );
};
