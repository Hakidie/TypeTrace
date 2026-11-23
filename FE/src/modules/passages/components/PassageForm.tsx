import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { useMemo, useState, type BaseSyntheticEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useCreatePassage, useSetPassageStatus, useUpdatePassage } from '../hooks/use-passages';
import { countWords, MAX_PASSAGE_WORDS } from '../passages.config';
import { canHardDelete, nextPassageStatus, type Passage, type PassageStatus } from '../types/passage.types';

// Mirrors the limits of the Passage model (BE/src/models/passage.model.ts).
const schemaOf = (t: TFunction<'passages'>) =>
  z.object({
    title: z.string().trim().min(1, t('form.titleRequired')).max(120, t('form.maxChars', { max: 120 })),
    source: z.string().trim().min(1, t('admin.form.sourceRequired')).max(300, t('form.maxChars', { max: 300 })),
    content: z
      .string()
      .trim()
      .min(1, t('admin.form.contentRequired'))
      .max(5000, t('form.maxChars', { max: 5000 }))
      .refine((text) => countWords(text) <= MAX_PASSAGE_WORDS, t('form.atMostWords', { max: MAX_PASSAGE_WORDS })),
    isPlacement: z.boolean(),
    // Only an edit of a published English passage can turn it on (the backend answers 400 / 409 otherwise).
    isRanked: z.boolean(),
    // English passages are for ranked duels; the backend refuses an English placement passage.
    language: z.enum(['vi', 'en']),
  });

type FormValues = z.infer<ReturnType<typeof schemaOf>>;

// No border (the focus ring stays) and 1.125rem text, placeholders included.
const fieldClass = 'border-0 px-0 text-[1.125rem]';

// Title and Source look like the learner's passage form (`OwnPassageForm`): no background, red text, as wide as their text.
// `field-sizing-content`: the field is as wide as its text (the placeholder while empty); the wrapper caps it at half the row.
const metaFieldClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent focus-visible:ring-0 px-0 py-1.5 text-[1.5rem] text-primary placeholder:text-primary';

/**
 * The shared tooltip of a switch, instead of the native `title`; the span keeps it working while the switch is disabled
 * (a placement passage cannot be ranked, a ranked one cannot be a placement passage).
 */
const SwitchHint = ({ label, children }: { label: string; children: ReactElement }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-fit">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const emptyValues: FormValues = { title: '', source: '', content: '', isPlacement: false, isRanked: false, language: 'vi' };

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
  /**
   * Edit mode: shows a Delete passage button on a passage that may be deleted for good (`canHardDelete`, its saved
   * status). The page asks for confirmation before deleting it (SCRUM-159).
   */
  onDelete?: (passage: Passage) => void;
}

/** Form that creates a passage, or edits one when `passage` is given. Remount it (`key`) to switch passage. */
export const PassageForm = ({ passage, onDone, onDelete }: PassageFormProps) => {
  // The fields and their placeholders are the same as the learner's passage form (`OwnPassageForm`): its `form.*` words.
  const { t, i18n } = useTranslation('passages');
  const schema = useMemo(() => schemaOf(t), [t]);
  // The status names are lowercase in English and capitalized by CSS, as the raw statuses were; in Vietnamese they show as written.
  const capitalizeStatus = i18n.language !== 'vi';
  const createPassage = useCreatePassage();
  const updatePassage = useUpdatePassage();
  const setStatus = useSetPassageStatus();
  const isPending = createPassage.isPending || updatePassage.isPending || setStatus.isPending;
  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: passage
      ? {
          title: passage.title,
          source: passage.source,
          content: passage.content,
          isPlacement: passage.isPlacement,
          isRanked: passage.isRanked ?? false,
          language: passage.language ?? 'vi',
        }
      : emptyValues,
  });

  const content = useWatch({ control, name: 'content' });
  const isEnglish = useWatch({ control, name: 'language' }) === 'en';
  const isRanked = useWatch({ control, name: 'isRanked' });
  const isPlacement = useWatch({ control, name: 'isPlacement' });

  // The status button flips between the saved status and the next one; the change is saved with the form.
  const [status, setStatusChoice] = useState<PassageStatus>(passage?.status ?? 'draft');
  // Draft → Published → Archived → Draft; no button for a status outside the cycle (pending, rejected).
  // A ranked test must stay published: the status button waits until the ranked mark is removed.
  const next = passage && nextPassageStatus[passage.status] && !(isRanked && status === 'published') ? nextPassageStatus[status] : undefined;

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
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input className={cn(fieldClass, metaFieldClass)} aria-label={t('form.titleLabel')} placeholder={t('form.titlePlaceholder')} {...register('title')} />
          <FieldError id="passage-title-error" message={errors.title?.message} />
        </div>
        {/* `ml-auto` keeps Source on the right, also when the two fields are stacked on a phone. */}
        <div className="ml-auto min-w-0 max-w-full space-y-2 md:max-w-[calc(50%-0.5rem)]">
          <Input
            // `text-right`: the field is at least 6rem wide, so a short text would stop short of the right edge
            className={cn(fieldClass, metaFieldClass, 'text-right')}
            aria-label={t('form.sourceLabel')}
            placeholder={t('form.sourcePlaceholder')}
            {...register('source')}
          />
          <FieldError id="passage-source-error" message={errors.source?.message} />
        </div>
      </div>

      {/* The text area takes the height left on the screen (12rem at least); a longer text scrolls inside it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          className={cn(fieldClass, 'min-h-48 flex-1 resize-none text-[2rem] leading-snug')}
          aria-label={t('form.contentLabel')}
          placeholder={t('form.contentPlaceholder')}
          {...register('content')}
        />
        <FieldError id="passage-content-error" message={errors.content?.message} />
      </div>

      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {/* Bottom left: the same look as the learner's passage form. */}
        <p className="w-fit shrink-0 whitespace-nowrap bg-transparent px-0 py-1.5 text-[1.125rem] text-primary">
          {t('form.wordCount', { count: countWords(content), max: MAX_PASSAGE_WORDS })}
        </p>

        {/* In the middle: the switches, the status and Delete passage (up to four in edit mode; they wrap when the row is too narrow). */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              // English passages: English Practice, the English placement test (SCRUM-305) and the ranked duels, which are English only.
              <SwitchHint label={t('admin.form.englishHint')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value === 'en'}
                  aria-label={t('admin.form.englishSwitch')}
                  onClick={() => {
                    const english = field.value !== 'en';
                    field.onChange(english ? 'en' : 'vi');
                    if (!english) setValue('isRanked', false);
                  }}
                  className={cn(
                    'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    field.value === 'en' ? 'bg-transparent text-primary' : 'bg-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {field.value === 'en' && <CheckCircle2 className="size-5" />}
                  {field.value === 'en' ? t('admin.languages.en') : t('admin.languages.vi')}
                </button>
              </SwitchHint>
            )}
          />
          <Controller
            control={control}
            name="isPlacement"
            render={({ field }) => (
              // The name stays "Placement passage"; `aria-checked` tells the state, the visible words show it. A passage of either
              // language (the placement test of that language, SCRUM-305), never a ranked test as well.
              <SwitchHint label={isRanked ? t('admin.form.placementBlocked') : t('admin.form.placementHint')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  aria-label={t('admin.form.placementSwitch')}
                  disabled={isRanked}
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                    field.value ? 'bg-transparent text-primary' : 'bg-transparent text-muted-foreground enabled:hover:text-foreground',
                  )}
                >
                  {field.value && <CheckCircle2 className="size-5" />}
                  {field.value ? t('admin.form.placementSwitch') : t('admin.form.regular')}
                </button>
              </SwitchHint>
            )}
          />
          {/* Edit mode, published passages only: marks the passage as a ranked test (US6.4). */}
          {passage && (
            <Controller
              control={control}
              name="isRanked"
              render={({ field }) => (
                <SwitchHint
                  label={
                    isPlacement
                      ? t('admin.form.rankedBlockedPlacement')
                      : !isEnglish
                        ? t('admin.form.rankedOnlyEnglish')
                        : passage.status === 'published'
                          ? t('admin.form.rankedHint')
                          : t('admin.form.rankedOnlyPublished')
                  }
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    aria-label={t('admin.form.rankedSwitch')}
                    disabled={isPlacement || !isEnglish || passage.status !== 'published' || status !== 'published'}
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                      field.value ? 'bg-transparent text-primary' : 'bg-transparent text-muted-foreground enabled:hover:text-foreground',
                    )}
                  >
                    {field.value && <CheckCircle2 className="size-5" />}
                    {field.value ? t('admin.form.rankedSwitch') : t('admin.form.notRanked')}
                  </button>
                </SwitchHint>
              )}
            />
          )}
          {/* Edit mode: the status of the passage, a button that switches Draft, Published and Archived. Draft and archived look like "Regular passage", published is highlighted. */}
          {passage && (
            <button
              type="button"
              aria-label={t('admin.form.statusLabel', { status: t(`admin.status.${status}`) })}
              disabled={!next}
              title={next ? t('admin.form.statusNext', { status: t(`admin.status.${next}`) }) : undefined}
              onClick={() => next && setStatusChoice(next)}
              className={cn(
                'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                capitalizeStatus && 'capitalize',
                status === 'published' ? 'bg-transparent text-primary' : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {status === 'published' && <CheckCircle2 className="size-5" />}
              {t(`admin.status.${status}`)}
            </button>
          )}
          {passage && onDelete && canHardDelete(passage) && (
            // No background or border, in the destructive red.
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => onDelete(passage)}
              className="text-destructive hover:bg-transparent hover:text-destructive/80"
            >
              {t('admin.form.deletePassage')}
            </Button>
          )}
        </div>

        {/* On the right: Cancel and Add / Update passage. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          {passage && (
            <Button type="button" variant="outline" onClick={onDone}>
              {t('form.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : !passage && <Plus className="size-4" aria-hidden />}
            {passage ? t('form.update') : t('form.add')}
          </Button>
        </div>
      </div>
    </form>
  );
};
