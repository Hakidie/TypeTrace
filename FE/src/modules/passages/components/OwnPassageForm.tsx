import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

const schemaOf = (t: TFunction<'passages'>) =>
  z.object({
    title: cleanText.pipe(z.string().min(1, t('form.titleRequired')).max(PASSAGE_TITLE_MAX, t('form.maxChars', { max: PASSAGE_TITLE_MAX }))),
    source: cleanText.pipe(z.string().max(PASSAGE_SOURCE_MAX, t('form.maxChars', { max: PASSAGE_SOURCE_MAX }))),
    content: cleanText.pipe(
      z
        .string()
        .max(PASSAGE_CONTENT_MAX, t('form.maxChars', { max: PASSAGE_CONTENT_MAX }))
        .refine((text) => countWords(text) <= MAX_PASSAGE_WORDS, t('form.atMostWords', { max: MAX_PASSAGE_WORDS }))
        .refine((text) => countWords(text) >= MIN_OWN_PASSAGE_WORDS, t('form.atLeastWords', { min: MIN_OWN_PASSAGE_WORDS })),
    ),
  });

type FormValues = z.infer<ReturnType<typeof schemaOf>>;

const emptyValues: FormValues = { title: '', source: '', content: '' };

// The same as the admin passage form (`PassageForm`): no borders, Title and Source in the red tint of the typing status
// bar, as wide as their text (`field-sizing-content`), Title on the left and Source on the right.
const fieldClass = 'border-0 px-0 text-[1.125rem] focus-visible:ring-0';
const metaFieldClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent focus-visible:ring-0 px-0 py-1.5 text-[1.5rem] text-primary placeholder:text-primary';

/** No visible labels: the placeholders say what each field is, `aria-label` serves screen readers. */
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

interface OwnPassageFormProps {
  /** How many passages of their own the learner has and how many their plan allows (unknown while loading); adding stops at the limit. */
  ownCount?: number;
  maxCount?: number;
  /** The passage to edit, with its text. Without it the form adds a new passage. */
  passage?: OwnPassage;
  /** Edit mode: called after a successful update and by the Cancel button. */
  onDone?: () => void;
}

/**
 * Where a learner pastes (or types) a text of their own to practice. It is saved private and can be typed at once. With
 * `passage` it edits that passage instead, like the admin `PassageForm`; remount it (`key`) to switch passage.
 */
export const OwnPassageForm = ({ ownCount, maxCount, passage, onDone }: OwnPassageFormProps) => {
  const { t } = useTranslation('passages');
  const schema = useMemo(() => schemaOf(t), [t]);
  const addPassage = useAddOwnPassage();
  const updatePassage = useUpdateOwnPassage();
  const isPending = addPassage.isPending || updatePassage.isPending;
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: passage ? { title: passage.title, source: passage.source, content: passage.content } : emptyValues,
  });
  // Counted as it will be saved.
  const content = cleanPassageText(useWatch({ control, name: 'content' }));
  const full = !passage && ownCount !== undefined && maxCount !== undefined && ownCount >= maxCount;

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
          <Input className={cn(fieldClass, metaFieldClass)} aria-label={t('form.titleLabel')} placeholder={t('form.titlePlaceholder')} {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>
        {/* `ml-auto` keeps Source on the right, also when the two fields are stacked on a phone. */}
        <div className="ml-auto min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          {/* `text-right`: the field is at least 6rem wide, so a short text would stop short of the right edge */}
          <Input className={cn(fieldClass, metaFieldClass, 'text-right')} aria-label={t('form.sourceLabel')} placeholder={t('form.sourcePlaceholder')} {...register('source')} />
          <FieldError message={errors.source?.message} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          className={cn(fieldClass, 'min-h-48 flex-1 resize-none text-[2rem] leading-snug lg:min-h-20')}
          aria-label={t('form.contentLabel')}
          placeholder={t('form.contentPlaceholder')}
          {...register('content')}
        />
        <FieldError message={errors.content?.message} />
      </div>

      {passage?.visibility === 'public' && (
        <p className="text-base text-muted-foreground">
          {t('form.publicNote')}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Bottom left: the same look as the status bar of the typing page. */}
        <p className="w-fit bg-transparent px-0 py-1.5 text-[1.125rem] text-primary">
          {t('form.wordCount', { count: countWords(content), max: MAX_PASSAGE_WORDS })}
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {!passage && ownCount !== undefined && maxCount !== undefined && (
            <p className="text-base text-muted-foreground">
              {t('form.yourPassages', { count: ownCount, max: maxCount })}
              {full && t('form.full')}
            </p>
          )}
          {passage && (
            <Button type="button" variant="outline" onClick={onDone}>
              {t('form.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={full || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {passage?.visibility === 'public' ? t('form.sendEdit') : passage ? t('form.update') : t('form.add')}
          </Button>
        </div>
      </div>
    </form>
  );
};
