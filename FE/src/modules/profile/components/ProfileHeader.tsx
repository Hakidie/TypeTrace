import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Pencil, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { profileApi } from '../api/profile.api';
import type { Streak, TypingActivity } from '../types/profile.types';
import { AvatarUpload } from './AvatarUpload';

// Same rule as the display name in `ProfileEditForm`.
const nameSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(100, 'Max 100 characters'),
});
type NameValues = z.infer<typeof nameSchema>;

const iconButtonClass =
  'flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

interface DisplayNameProps {
  user: CurrentUser;
  /** Classes of the name, shared by the text and the input so the row does not jump when editing starts. */
  textClassName: string;
}

/** The name, with a pencil that shows on hover (or focus; always on touch screens) to change it right there: Enter saves, Escape cancels. */
const EditableDisplayName = ({ user, textClassName }: DisplayNameProps) => {
  const [editing, setEditing] = useState(false);
  const setCurrentUser = useSetCurrentUser();
  const name = user.displayName || user.email;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: user.displayName ?? '' },
  });

  // No `onError`: the shared query client shows the backend message as a toast.
  const updateName = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      toast.success('Display name updated.');
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
        <button
          type="button"
          aria-label="Edit display name"
          title="Edit display name"
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
          aria-label="New display name"
          aria-invalid={!!errors.displayName}
          autoFocus
          autoComplete="off"
          disabled={updateName.isPending}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          className={cn('h-auto min-w-0 border-0 bg-transparent p-0 focus-visible:ring-0', textClassName)}
          {...register('displayName')}
        />
        <button type="submit" aria-label="Save display name" title="Save" disabled={updateName.isPending} className={iconButtonClass}>
          <Check className="size-4" aria-hidden />
        </button>
        <button type="button" aria-label="Cancel" title="Cancel" onClick={cancel} disabled={updateName.isPending} className={iconButtonClass}>
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
  const setCurrentUser = useSetCurrentUser();
  const saved = user.bio ?? '';

  // No `onError`: the shared query client shows the backend message as a toast.
  const updateBio = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      toast.success('Bio updated.');
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
      aria-label="Description"
      defaultValue={saved}
      placeholder="No description"
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
      className="mt-4 block w-full max-w-prose resize-none border-0 bg-transparent px-1 py-0 text-[1.5rem] text-muted-foreground [field-sizing:content] placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
    />
  );
};

// Three layouts. Phones: everything stacked, the picture, the name, the email and bio, then the labels with the values
// under them in three columns. From `sm`: the picture on the left, the name, email and bio on its right with the labels
// and values under them. From `lg`: the numbers on the right of the name, row 1 of the grid holding the labels (on the
// line of the name) and row 2 the values (from the top of the email row); below `lg` the name would be squeezed out.
// On phones the labels and values are one step smaller: at full size STREAK fills its third of a 375px screen and runs
// into ACC.
const statColumn = ['sm:col-start-2 lg:col-start-3', 'sm:col-start-3 lg:col-start-4', 'sm:col-start-4 lg:col-start-5'];
const statLabelClass =
  'self-baseline text-right text-xl font-semibold leading-none tracking-widest text-primary/70 sm:row-start-3 sm:text-2xl lg:row-start-1 lg:pl-14';
const statValueClass = 'self-start text-right text-[1.875rem] font-black leading-none text-primary sm:row-start-4 sm:text-[2.25rem] lg:row-start-2 lg:pl-14';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** A number of days the way the header writes it, `005D`; a dash while it loads or when it could not load. */
const daysValue = (days?: number) => (days === undefined ? '—' : `${String(days).padStart(3, '0')}D`);

interface ProfileHeaderProps {
  user: CurrentUser;
  /** The learner's typing activity (`useTypingActivity`): only the speed and accuracy are used here. */
  activity: UseQueryResult<TypingActivity>;
  /** The learner's streak (`useStreak`): the current one, and the longest under it. */
  streak: UseQueryResult<Streak>;
  /** Called with the new image once the avatar is uploaded. */
  onAvatarChange: (avatarUrl: string) => void;
}

/**
 * The top of the profile page, without a frame: the avatar, the name (changed in place), the email, the bio (also changed
 * in place), the speed, the accuracy, the current streak with the longest one under it ("BEST") and the day the account
 * was made. Sits on the page, without background, padding or border.
 */
export const ProfileHeader = ({ user, activity, streak, onAvatarChange }: ProfileHeaderProps) => {
  const name = user.displayName || user.email;
  const stats = activity.data?.stats;

  const statList = [
    { label: 'WPM', value: stats ? String(Math.round(stats.wpm)) : '0000' },
    { label: 'ACC', value: stats ? `${Math.round(stats.accuracy)}%` : '000%' },
    { label: 'STREAK', value: daysValue(streak.data?.current), best: daysValue(streak.data?.longest) },
  ];

  // A grid so that the labels sit on the baseline of the name and the values at the bottom, whatever the sizes are.
  return (
    <section
      aria-label="Profile header"
      className="grid grid-cols-3 gap-y-3 text-primary sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] lg:grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] lg:grid-rows-[auto_1fr] lg:gap-y-0"
    >
      <div className="col-span-3 sm:col-span-1 sm:row-span-4 sm:mr-3 lg:row-span-2">
        <AvatarUpload currentAvatarUrl={user.avatarUrl} userInitials={name.slice(0, 2).toUpperCase()} onUploadSuccess={onAvatarChange}
          className="size-48"
          initialsClassName="text-6xl"
        />
      </div>
      {/* `lg:col-span-1` sets `grid-column`, which drops the column start: `lg:col-start-2` gives it back. */}
      <div className="col-span-3 min-w-0 self-baseline sm:col-start-2 sm:row-start-1 lg:col-span-1 lg:col-start-2">
        {/* 2.25rem: bigger than a panel title (`panelTitleClass`). */}
        <EditableDisplayName user={user} textClassName="text-[2.25rem] font-extrabold text-primary/80" />
      </div>
      <div className="col-span-3 min-w-0 sm:col-start-2 sm:row-start-2 lg:col-span-1 lg:col-start-2">
        <p className="truncate text-[1.5rem] text-muted-foreground">{user.displayName ? user.email : 'No display name yet: hover the name to add one.'}</p>
        <EditableBio key={user.bio ?? ''} user={user} />
      </div>
      {statList.map(({ label }, i) => (
        <span key={label} className={cn(statLabelClass, statColumn[i])}>{label}</span>
      ))}
      {statList.map(({ label, value, best }, i) => (
        <div key={label} className={cn(statValueClass, statColumn[i])}>
          {value}
          {/* The longest streak, a smaller label and value under the current one: no fourth column to squeeze the name. On
              phones the label always sits over the value, the dash too: "BEST 012D" does not fit a third of the screen, and
              a line that only wraps once the streak comes would push the page down. */}
          {best && (
            <p
              title="Longest streak"
              className="mt-2 flex flex-col items-end text-base font-semibold tracking-widest text-primary/70 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-end sm:gap-x-1.5"
            >
              BEST <span className="text-xl font-black tracking-normal text-primary">{best}</span>
            </p>
          )}
        </div>
      ))}
      {/* The bottom right of the header: under the values (from `lg` up in the same cells, the values are at the top). */}
      <p className="col-span-3 self-end text-right text-sm text-muted-foreground sm:col-start-2 sm:row-start-5 lg:col-start-3 lg:row-start-2">
        Joined {formatDate(user.createdAt)}
      </p>
    </section>
  );
};
