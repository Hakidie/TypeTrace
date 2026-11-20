import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { monthShort } from '@/shared/lib/local-date';
import { currentStreak } from '@/shared/lib/streak';
import { cn } from '@/shared/lib/utils';
import { useSetUserStatus, useUpdateUser } from '../hooks/use-admin';
import type { UserSessionDay, UserStatus, UserTypingStats } from '../types/admin.types';

// Mirrors `adminUpdateUserSchema` in BE/src/validators/admin-user.validator.ts; the messages in the language of the interface.
const schemaOf = (t: TFunction<'admin'>) =>
  z.object({
    displayName: z.string().trim().min(1, t('form.nameRequired')).max(100, t('form.max', { max: 100 })),
    bio: z.string().trim().max(200, t('form.max', { max: 200 })),
    role: z.enum(['user', 'admin']),
    isEmailVerified: z.boolean(),
    loginOtpEnabled: z.boolean(),
  });

type FormValues = z.infer<ReturnType<typeof schemaOf>>;

/** "05 Dec 2026" on this device's calendar, the month in the language of the interface. */
const formatDay = (iso: string) => {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')} ${monthShort(date.getMonth() + 1)} ${date.getFullYear()}`;
};

// The numbers of the profile header (`ProfileHeader`): labels on the line of the role, values on the line of the name.
// On a phone everything is stacked and the numbers come last, in three columns; from `lg` they sit on the right.
const statColumn = ['lg:col-start-3', 'lg:col-start-4', 'lg:col-start-5'];
const statLabelClass = 'self-baseline pr-3 text-right text-[1.5rem] leading-none text-primary/70 lg:row-start-1 lg:pl-14';
const statValueClass = 'self-start pr-3 text-right text-[2rem] leading-none text-primary lg:row-start-2 lg:pl-14';
// The small labels over the name and the email (the role is the label of the name).
const fieldLabelClass = 'self-baseline px-0 text-[1.5rem] leading-normal text-primary/70';

// A switch button: highlighted when on, muted when off (as "Placement passage" in the passage form).
const switchClass = (on: boolean) =>
  cn(
    'flex w-fit items-center gap-2 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground enabled:hover:text-foreground',
  );

interface SwitchButtonProps {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  /** Shown in a tooltip; also tells why the button is disabled. */
  tip: string;
  disabled?: boolean;
  onToggle: () => void;
}

/** A role-switch button with the shared tooltip. The span around it lets the tooltip open on a disabled button. */
const SwitchButton = ({ label, on, onLabel, offLabel, tip, disabled, onToggle }: SwitchButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="w-fit">
        <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle} className={switchClass(on)}>
          {on && <CheckCircle2 className="size-5" />}
          {on ? onLabel : offLabel}
        </button>
      </span>
    </TooltipTrigger>
    <TooltipContent>{tip}</TooltipContent>
  </Tooltip>
);

interface UserFormProps {
  /** The user to edit. Without one the form is shown empty and disabled: there is no "new user". */
  user?: CurrentUser;
  stats?: UserTypingStats;
  sessions?: UserSessionDay[];
  status?: UserStatus;
  /** The signed-in admin: their own role and status cannot be changed here. */
  isSelf: boolean;
  /** Called after a successful update and by the Cancel button. */
  onDone: () => void;
}

/** Edits one user, laid out like the passage form. Mount it with `key={user?._id}` to switch user. */
export const UserForm = ({ user, stats, sessions, status: savedStatus = 'active', isSelf, onDone }: UserFormProps) => {
  const { t } = useTranslation('admin');
  const schema = useMemo(() => schemaOf(t), [t]);
  const updateUser = useUpdateUser();
  const setStatus = useSetUserStatus();
  const isPending = updateUser.isPending || setStatus.isPending;
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      role: user?.role ?? 'user',
      isEmailVerified: user?.isEmailVerified ?? false,
      loginOtpEnabled: user?.loginOtpEnabled ?? false,
    },
  });

  // The status button flips between active and locked; the change is saved with the form.
  const [status, setStatusChoice] = useState<UserStatus>(savedStatus);
  // Admins and your own account cannot be disabled (the backend refuses), but a locked one can always be enabled again.
  const statusLocked = savedStatus !== 'locked' && (user?.role === 'admin' || isSelf);

  const save = handleSubmit(async (input) => {
    if (!user) return;
    await updateUser.mutateAsync({ id: user._id, input: isSelf ? { ...input, role: undefined } : input });
    if (status !== savedStatus) await setStatus.mutateAsync({ id: user._id, status });
    onDone();
  });

  const role = useWatch({ control, name: 'role' });
  const statList = [
    { key: 'wpm', label: t('form.stats.wpm'), value: stats ? String(Math.round(stats.wpm)) : '0000' },
    { key: 'accuracy', label: t('form.stats.accuracy'), value: stats ? `${Math.round(stats.accuracy)}%` : '000%' },
    { key: 'streak', label: t('form.stats.streak'), value: sessions ? `${String(currentStreak(sessions)).padStart(3, '0')}D` : user ? '—' : '000D' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-6">
      {/* The user's avatar on the left, as tall as the form: the uploaded picture (unless the account chose its pixel avatar) fills the column, else the pixel avatar, centered. */}
      <div className="hidden w-40 shrink-0 items-center justify-center self-stretch overflow-hidden lg:flex" aria-hidden={user ? undefined : true}>
        {user?.avatarUrl && user.avatarSource !== 'pixel' ? (
          <img src={user.avatarUrl} alt={t('form.avatarOf', { name: user.displayName })} className="size-full object-cover" />
        ) : (
          <AvatarSprite look={user?.avatar ?? DEFAULT_AVATAR} scale={3.25} label={t('form.avatarOf', { name: user?.displayName ?? t('form.theUser') })} />
        )}
      </div>
      <form className="flex min-w-0 flex-1 flex-col gap-4" onSubmit={(event) => void save(event).catch(() => undefined)}>
        {/* The look of the profile header: the role as a small label over the name, the email and the
            description under it, the numbers on the right (labels on the line of the role, values on the line of the name).
            The grid takes the height left on the screen: the description grows with it. */}
        <section
          aria-label={t('form.info')}
          className="grid grid-cols-3 content-start gap-y-3 text-primary lg:grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] lg:grid-rows-[auto_auto_auto_auto] lg:gap-y-0"
        >
          <p className={cn(fieldLabelClass, 'col-span-3 lg:col-span-1 lg:col-start-1 lg:row-start-1')}>{!user ? t('form.role') : t(`roles.${role}`)}</p>

          {/* The email is under the name; `pb` on the email is the gap of the passage form (its 1rem gap + 0.375rem under the title). */}
          <div className="col-span-3 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <Input
              className="h-auto w-full min-w-0 border-0 bg-transparent px-0 py-0 text-[2rem] leading-snug text-primary placeholder:text-primary focus-visible:ring-0 lg:field-sizing-content lg:w-auto lg:max-w-full"
              aria-label={t('form.displayName')}
              placeholder={t('form.displayName')}
              disabled={!user}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p role="alert" className="text-base text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>

          {/* The email is read only (the backend does not let an admin change it), in the look of the name. */}
          <p
            className="col-span-3 min-w-0 truncate self-start px-0 text-[1.25rem] leading-snug text-primary/70 lg:col-span-2 lg:col-start-1 lg:row-start-3 lg:pb-[1.375rem]"
            aria-label={t('form.emailAddress')}
          >
            {user?.email ?? 'name@example.com'}
          </p>

          {/* The description (bio), 200 characters at most. One line (cut with the text it hides) until it is focused: then it grows to show all of it. */}
          <div className="col-span-3 min-w-0 lg:col-span-5 lg:col-start-1 lg:row-start-4">
            <Textarea
              rows={1}
              className={cn(
                'resize-none border-0 bg-transparent px-0 text-[1.5rem] leading-snug text-muted-foreground placeholder:text-muted-foreground/70 focus-visible:ring-0',
                // 3.0625rem = one line of 1.5rem text (leading-snug) and the padding.
                'min-h-0 h-[3.0625rem] overflow-hidden focus:h-auto focus:max-h-[60vh] focus:overflow-auto focus:[field-sizing:content]',
              )}
              aria-label={t('form.description')}
              placeholder={t('form.noDescription')}
              maxLength={200}
              disabled={!user}
              {...register('bio')}
            />
            {errors.bio && (
              <p role="alert" className="px-0 text-base text-destructive">
                {errors.bio.message}
              </p>
            )}
          </div>

          {statList.map(({ key, label }, i) => (
            <span key={key} className={cn(statLabelClass, statColumn[i])}>
              {label}
            </span>
          ))}
          {statList.map(({ key, value }, i) => (
            <div key={key} className={cn(statValueClass, statColumn[i])}>
              {value}
            </div>
          ))}
        </section>

        {/* As in the passage form: the date on the left, the switches and the buttons on the right (on a second line when the row is too narrow). */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="w-fit shrink-0 whitespace-nowrap bg-transparent px-0 py-1.5 text-[1.125rem] text-primary">
            {t('form.joined', { day: user ? formatDay(user.createdAt) : t('form.noDay') })}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <SwitchButton
                  label={t('form.adminRole')}
                  on={field.value === 'admin'}
                  onLabel={t('roles.admin')}
                  offLabel={t('roles.user')}
                  tip={isSelf ? t('form.ownRole') : t('form.adminsOpen')}
                  disabled={isSelf || !user}
                  onToggle={() => field.onChange(field.value === 'admin' ? 'user' : 'admin')}
                />
              )}
            />
            <Controller
              control={control}
              name="isEmailVerified"
              render={({ field }) => (
                <SwitchButton
                  label={t('form.emailVerified')}
                  on={field.value}
                  onLabel={t('columns.verified')}
                  offLabel={t('columns.unverified')}
                  tip={t('form.verifiedTip')}
                  disabled={!user}
                  onToggle={() => field.onChange(!field.value)}
                />
              )}
            />
            <SwitchButton
              label={t('form.accountActive')}
              on={status === 'active'}
              onLabel={t('form.active')}
              offLabel={t('form.locked')}
              tip={statusLocked ? t('form.cannotDisable') : t('form.lockedTip')}
              disabled={statusLocked || !user}
              onToggle={() => setStatusChoice(status === 'locked' ? 'active' : 'locked')}
            />
            <Controller
              control={control}
              name="loginOtpEnabled"
              render={({ field }) => (
                <SwitchButton
                  label={t('form.emailCode')}
                  on={field.value}
                  onLabel={t('form.emailCode')}
                  offLabel={t('form.noEmailCode')}
                  tip={t('form.emailCodeTip')}
                  disabled={!user}
                  onToggle={() => field.onChange(!field.value)}
                />
              )}
            />
            <Button type="button" variant="outline" disabled={!user} onClick={onDone}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!user || isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t('form.update')}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </TooltipProvider>
  );
};
