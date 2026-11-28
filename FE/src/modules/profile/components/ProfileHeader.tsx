import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Pencil, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { languageNames } from '@/modules/typing/typing.config';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { profileApi } from '../api/profile.api';
import type { Streak, TypingActivity } from '../types/profile.types';
import { PlanBadge } from '@/modules/plan/components/PlanBadge';
import { AvatarUpload } from './AvatarUpload';

// Same rule as the display name in `ProfileEditForm`.
const nameSchemaOf = (t: TFunction<'profile'>) =>
  z.object({
    displayName: z.string().trim().min(2, t('header.nameMin')).max(100, t('header.nameMax')),
  });
type NameValues = z.infer<ReturnType<typeof nameSchemaOf>>;

const iconButtonClass =
  'flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

interface DisplayNameProps {
  user: CurrentUser;
  /** Classes of the name, shared by the text and the input so the row does not jump when editing starts. */
  textClassName: string;
  /** Shown between the name and the pencil (not while the name is edited). */
  beforeEdit?: ReactNode;
}

/** The name, with a pencil that shows on hover (or focus; always on touch screens) to change it right there: Enter saves, Escape cancels. */
const EditableDisplayName = ({ user, textClassName, beforeEdit }: DisplayNameProps) => {
  const { t } = useTranslation('profile');
  const [editing, setEditing] = useState(false);
  const setCurrentUser = useSetCurrentUser();
  const name = user.displayName || user.email;
  const nameSchema = useMemo(() => nameSchemaOf(t), [t]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: user.displayName ?? '' },
  });

  // No `onError`: the shared query client shows the backend message as a toast.
  const updateName = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      toast.success(t('header.nameUpdated'));
      setEditing(false);
    },
  });

  const start = () => {
    reset({ displayName: user.displayName ?? '' });
    setEditing(true);
  };
  const cancel = () => setEditing(false);
  const save = handleSubmit(({ displayName }) => {
    if (displayName === user.displayName) return cancel();
    updateName.mutate({ displayName });
  });

  if (!editing) {
    return (
      <div className="group flex min-w-0 items-center gap-1">
        <p className={cn('truncate', textClassName)}>{name}</p>
        {beforeEdit}
        <button
          type="button"
          aria-label={t('header.editName')}
          title={t('header.editName')}
          onClick={start}
          className={cn(iconButtonClass, 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100')}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="min-w-0">
      <div className="flex items-center gap-1">
        <Input
          aria-label={t('header.newName')}
          aria-invalid={!!errors.displayName}
          autoFocus
          autoComplete="off"
          disabled={updateName.isPending}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          className={cn('h-auto min-w-0 border-0 bg-transparent p-0 focus-visible:ring-0', textClassName)}
          {...register('displayName')}
        />
        <button type="submit" aria-label={t('header.saveName')} title={t('header.save')} disabled={updateName.isPending} className={iconButtonClass}>
          <Check className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label={t('header.cancel')} title={t('header.cancel')} onClick={cancel} disabled={updateName.isPending} className={iconButtonClass}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {errors.displayName && <p role="alert" className="text-base text-destructive">{errors.displayName.message}</p>}
    </form>
  );
};

/**
 * The bio, typed right where it is shown, with no frame or background. Enter saves (Shift+Enter is a new
 * line), so does leaving the field; Escape drops the change. Nothing is sent when the text did not change. Emptying it clears the bio.
 */
const EditableBio = ({ user }: { user: CurrentUser }) => {
  const { t } = useTranslation('profile');
  const setCurrentUser = useSetCurrentUser();
  const saved = user.bio ?? '';

  // No `onError`: the shared query client shows the backend message as a toast.
  const updateBio = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      toast.success(t('header.bioUpdated'));
    },
  });

  const save = (field: HTMLTextAreaElement) => {
    const text = field.value.trim();
    if (text === saved) {
      field.value = saved;
      return;
    }
    updateBio.mutate({ bio: text });
  };

  return (
    <textarea
      aria-label={t('header.description')}
      defaultValue={saved}
      placeholder={t('header.noDescription')}
      rows={1}
      maxLength={200}
      disabled={updateBio.isPending}
      onBlur={(e) => save(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.currentTarget.value = saved;
          e.currentTarget.blur();
        }
      }}
      className="mt-1 block w-full max-w-prose resize-none border-0 bg-transparent px-1 py-0 text-[1.5rem] text-muted-foreground [field-sizing:content] placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
    />
  );
};

// The values sit as far under their labels as the name under the role (USER): 13px more than the row gap on phones, 12px from `sm` (the role's line is 1.5 times its font taller than the labels'). Three layouts. The numbers are left-aligned (right-aligned from `lg`) and, below `lg`, the chart and the Joined date take the whole width of the header, under the avatar. Phones: everything stacked, the picture, the name, the email and bio, then the labels with the values
// under them in three columns. From `sm`: the picture on the left, the name, email and bio on its right with the labels
// and values under them. From `lg`: the numbers on the right of the name, row 1 of the grid holding the labels (on the
// line of the name) and row 2 the values (from the top of the email row); below `lg` the name would be squeezed out.
// On phones the labels and values are one step smaller: at full size STREAK fills its third of a 375px screen and runs
// into ACC.
const statColumn = ['sm:col-start-2 lg:col-start-3', 'sm:col-start-3 lg:col-start-4', 'sm:col-start-4 lg:col-start-5'];
const statLabelClass =
  'self-baseline text-left text-xl font-semibold leading-none tracking-widest text-primary/70 sm:row-start-3 sm:text-2xl lg:row-start-1 lg:pl-14 lg:text-right';
const statValueClass = 'self-start pt-[13px] text-left text-[1.875rem] font-black leading-none text-primary sm:row-start-4 sm:pt-3 lg:pt-0 sm:text-[2.25rem] lg:row-start-2 lg:pl-14 lg:text-right';

const formatDate = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

/** A number of days the way the header writes it, `005D`; a dash while it loads or when it could not load. */
const daysValue = (days?: number) => (days === undefined ? '—' : `${String(days).padStart(3, '0')}D`);

/** Shows `tip` in the project's tooltip while its text is hovered or focused. */
const HoverTip = ({ tip, children }: { tip: string; children: ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </span>
    </TooltipTrigger>
    <TooltipContent>{tip}</TooltipContent>
  </Tooltip>
);

interface ProfileHeaderProps {
  user: CurrentUser;
  /** The learner's typing activity (`useTypingActivity`): only the speed and accuracy (and their language) are used here. */
  activity: UseQueryResult<TypingActivity>;
  /** The learner's streak (`useStreak`): the current one, and the longest in a tooltip on it. */
  streak: UseQueryResult<Streak>;
  /** Called with the new image once the avatar is uploaded. */
  onAvatarChange: (avatarUrl: string) => void;
  /** Shown under the bio and the numbers, as wide as the header (the monthly chart, SCRUM-240); nothing when missing. */
  chart?: ReactNode;
}

/**
 * The top of the profile page, without a frame: the avatar, the name (changed in place), the email, the bio (also changed
 * in place, with `chart` under all of it when given), the speed, the accuracy, the current streak (the longest one in a tooltip) and the day the account
 * was made. Sits on the page, without background, padding or border.
 */
export const ProfileHeader = ({ user, activity, streak, onAvatarChange, chart }: ProfileHeaderProps) => {
  const { t, i18n } = useTranslation('profile');
  const name = user.displayName || user.email;
  // A phone, held upright (narrow) or on its side (short): the avatar is a third smaller (2x the sprite pixels, a 152px tile) so it does not fill the header.
  const compact = useMediaQuery('(max-width: 639px), (max-height: 500px)');
  const stats = activity.data?.stats;
  // The averages are the ones of the learner's typing language (SCRUM-219): the tooltip names it.
  const averagesTip = activity.data && t('header.averages', { language: languageNames[activity.data.language ?? 'vi'] });

  const statList = [
    { label: t('header.wpm'), value: stats ? String(Math.round(stats.wpm)) : '0000', tip: averagesTip },
    { label: t('header.acc'), value: stats ? `${Math.round(stats.accuracy)}%` : '000%', tip: averagesTip },
    { label: t('header.streak'), value: daysValue(streak.data?.current), tip: t('header.longestStreak', { value: daysValue(streak.data?.longest) }) },
  ];

  // A grid so that the labels sit on the baseline of the name and the values at the bottom, whatever the sizes are.
  return (
    <TooltipProvider delayDuration={200}>
    <section
      aria-label={t('header.aria')}
      className="grid grid-cols-3 gap-y-3 text-primary sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] lg:grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] lg:grid-rows-[auto_auto_1fr_auto] lg:gap-y-0"
    >
      <div className="col-span-3 flex flex-col items-start gap-2 sm:col-span-1 sm:row-span-4 sm:mr-3 lg:row-span-3">
        {/* Without an uploaded picture, or when the account chose its pixel avatar, the pixel avatar shows (228px = the 76px frame at 3x, filling the 228px tile, about as high as the header; 152px at 2x on a phone). */}
        <AvatarUpload avatarUrl={user.avatarUrl} avatarSource={user.avatarSource} userInitials={name.slice(0, 2).toUpperCase()} onUploadSuccess={onAvatarChange}
          onSourceChange={() => onAvatarChange(user.avatarUrl ?? '')}
          outfitTo="/wardrobe"
          className={compact ? 'size-[152px]' : 'size-[228px]'}
          initialsClassName={compact ? 'text-4xl' : 'text-6xl'}
          fallback={<AvatarSprite look={user.avatar ?? DEFAULT_AVATAR} scale={compact ? 2 : 3} label={t('header.avatar')} />}
        />
      </div>
      {/* `lg:col-span-1` sets `grid-column`, which drops the column start: `lg:col-start-2` gives it back. */}
      <div className="col-span-3 min-w-0 self-baseline sm:col-start-2 sm:row-start-1 lg:col-span-1 lg:col-start-2">
        {/* A line of the height of the name (2.25rem, bigger than a panel title, `panelTitleClass`): the role of the account, in the
            look of the labels (WPM, ACC, STREAK), and the hint while there is no display name. The name is the line under it. */}
        <p className="flex items-baseline gap-x-4 truncate text-[2.25rem] leading-normal">
          <span className="text-xl font-semibold uppercase tracking-widest text-primary/70 sm:text-2xl">{user.role}</span>
          {!user.displayName && <span className="truncate text-base text-muted-foreground">{t('header.noDisplayName')}</span>}
        </p>
      </div>
      <div className="col-span-3 min-w-0 sm:col-start-2 sm:row-start-2 lg:col-span-1 lg:col-start-2">
        <div className="flex min-w-0 items-center gap-3">
          <EditableDisplayName user={user} textClassName="text-[1.875rem] font-black text-primary sm:text-[2.25rem]" beforeEdit={<PlanBadge />} />
        </div>
        <EditableBio key={user.bio ?? ''} user={user} />
      </div>
      {statList.map(({ label, tip }, i) => (
        <span key={label} className={cn(statLabelClass, statColumn[i])}>
          {tip ? <HoverTip tip={tip}>{label}</HoverTip> : label}
        </span>
      ))}
      {statList.map(({ label, value, tip }, i) => (
        <div key={label} className={cn(statValueClass, statColumn[i])}>
          {tip ? <HoverTip tip={tip}>{value}</HoverTip> : value}
        </div>
      ))}
      {/* The chart under everything else, from the name column to the right edge of the header (and under the numbers). From `lg` its row takes
          what is left of the avatar's height (the avatar spans the three rows above the Joined date), so the bottom of the chart is level with the bottom of the avatar and the Joined date is the line under both. */}
      {chart && (
        <div className="col-span-3 sm:col-span-4 sm:col-start-1 sm:row-start-6 lg:relative lg:col-span-4 lg:col-start-2 lg:row-start-3 lg:min-h-[68px]">
          {/* From `lg` the chart is laid over its row (it does not make the row taller): the row is what is left of the avatar's height, but at least 68px: 60px of lines under 8px of margin. The chart hangs 24px below its row: the bottom of the lines is level with the bottom of the avatar, and the month names (shown on hover) sit in the 24px that the Joined line leaves free above it (`lg:pt-6`). */}
          <div className="lg:absolute lg:inset-x-0 lg:-bottom-6 lg:top-0">{chart}</div>
        </div>
      )}
      {/* The bottom right of the header: under the chart (under the numbers when there is none). */}
      <p className="col-span-3 text-right text-base text-muted-foreground sm:col-span-4 sm:col-start-1 sm:row-start-7 lg:col-span-4 lg:col-start-2 lg:row-start-4 lg:pt-6">
        {t('header.joined', { date: formatDate(user.createdAt, i18n.language === 'vi' ? 'vi-VN' : 'en-GB') })}
      </p>
    </section>
    </TooltipProvider>
  );
};
