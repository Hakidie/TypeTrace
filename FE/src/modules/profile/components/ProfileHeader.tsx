import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Pencil, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { Input } from '@/shared/components/ui/input';
import { currentStreak } from '@/shared/lib/streak';
import { cn } from '@/shared/lib/utils';
import { profileApi } from '../api/profile.api';
import type { TypingActivity } from '../types/profile.types';
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

// Row 1 of the header grid holds the labels (on the line of the name), row 2 the values (starting at the top of the email row).
const statColumn = ['sm:col-start-3', 'sm:col-start-4', 'sm:col-start-5'];
const statLabelClass = 'self-baseline text-right text-2xl font-semibold leading-none tracking-widest text-primary/70 sm:row-start-1 sm:pl-14';
const statValueClass = 'self-start text-right text-[2.25rem] font-black leading-none text-primary sm:row-start-2 sm:pl-14';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

interface ProfileHeaderProps {
  user: CurrentUser;
  /** The learner's typing activity (`useTypingActivity`): only the numbers are used here. */
  activity: UseQueryResult<TypingActivity>;
  /** Called with the new image once the avatar is uploaded. */
  onAvatarChange: (avatarUrl: string) => void;
}

/**
 * The top of the profile page, without a frame: the avatar, the name (changed in place), the email, the bio (also changed
 * in place), the speed, accuracy and streak and the day the account was made. Sits on the page, without background,
 * padding or border.
 */
export const ProfileHeader = ({ user, activity, onAvatarChange }: ProfileHeaderProps) => {
  const name = user.displayName || user.email;
  const sessions = activity.data?.sessions;
  const stats = activity.data?.stats;

  const statList = [
    { label: 'WPM', value: stats ? String(Math.round(stats.wpm)) : '0000' },
    { label: 'ACC', value: stats ? `${Math.round(stats.accuracy)}%` : '000%' },
    { label: 'STREAK', value: sessions ? `${String(currentStreak(sessions)).padStart(3, '0')}D` : '—' },
  ];

  // A grid so that the labels sit on the baseline of the name and the values at the bottom, whatever the sizes are. On
  // phones everything is stacked: picture, name, email and bio, then the labels with the values under them.
  return (
    <section
      aria-label="Profile header"
      className="grid grid-cols-3 gap-y-3 text-primary sm:grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] sm:grid-rows-[auto_1fr] sm:gap-y-0"
    >
      <div className="col-span-3 flex flex-col items-start gap-2 sm:col-span-1 sm:row-span-2 sm:mr-3">
        {/* Without an uploaded picture the pixel avatar shows (152px = the 76px frame at 2x, inside the 192px tile). */}
        <AvatarUpload currentAvatarUrl={user.avatarUrl} userInitials={name.slice(0, 2).toUpperCase()} onUploadSuccess={onAvatarChange}
          className="size-48"
          initialsClassName="text-6xl"
          fallback={<AvatarSprite look={user.avatar ?? DEFAULT_AVATAR} scale={2} label="Your avatar" />}
        />
        <Link to="/wardrobe" className="text-sm text-primary underline-offset-4 hover:underline">
          Change outfit
        </Link>
      </div>
      <div className="col-span-3 min-w-0 self-baseline sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {/* 2.25rem: bigger than a panel title (`panelTitleClass`). */}
        <EditableDisplayName user={user} textClassName="text-[2.25rem] font-extrabold text-primary/80" />
      </div>
      <div className="col-span-3 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-2">
        <p className="truncate text-[1.5rem] text-muted-foreground">{user.displayName ? user.email : 'No display name yet: hover the name to add one.'}</p>
        <EditableBio key={user.bio ?? ''} user={user} />
      </div>
      {statList.map(({ label }, i) => (
        <span key={label} className={cn(statLabelClass, statColumn[i])}>{label}</span>
      ))}
      {statList.map(({ label, value }, i) => (
        <span key={label} className={cn(statValueClass, statColumn[i])}>{value}</span>
      ))}
      {/* The bottom right of the header: under the values from `sm` up (the same cells, the values are at the top). */}
      <p className="col-span-3 self-end text-right text-sm text-muted-foreground sm:col-start-3 sm:row-start-2">Joined {formatDate(user.createdAt)}</p>
    </section>
  );
};
