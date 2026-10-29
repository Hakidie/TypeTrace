import { useRef, useState, type ReactNode } from 'react';
import { Loader2, ImageIcon, Shirt, Upload, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { profileApi } from '@/modules/profile/api/profile.api';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';

interface AvatarUploadProps {
  /** The uploaded picture the account has, shown unless `avatarSource` is `pixel`. */
  avatarUrl?: string;
  /** What the account shows: the picture or its pixel avatar (`fallback`). Missing: the picture. */
  avatarSource?: 'picture' | 'pixel';
  userInitials?: string;
  onUploadSuccess: (newUrl: string) => void;
  /** Called after the account switched between its picture and its pixel avatar. */
  onSourceChange?: () => void;
  /** Where the "Change outfit" button leads (the wardrobe); without it there is no such button. */
  outfitTo?: string;
  /** Size of the picture (default the 61px tile of the user rows), e.g. `size-[228px]`. */
  className?: string;
  /** Size of the initials shown without a picture (default `text-xl`). */
  initialsClassName?: string;
  /** Shown without a picture instead of the initials (the profile page: the pixel avatar). */
  fallback?: ReactNode;
}

// Over the picture, which is busy (the pixel avatar): the buttons have their own page-color background and a border, so they read on it. Four of them, in two rows of two.
const iconButtonClass =
  'flex size-11 items-center justify-center border border-primary/40 bg-background text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-primary/40 disabled:hover:bg-background disabled:hover:text-primary'
// The button of what the account shows now: filled, and not faded although there is nothing to press.
const selectedClass = 'border-primary bg-primary text-primary-foreground disabled:opacity-100 disabled:hover:border-primary disabled:hover:bg-primary disabled:hover:text-primary-foreground';

/** A button with the project's tooltip; the span lets a disabled button still show it. */
const Tip = ({ label, children }: { label: string; children: ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">{children}</span>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

/**
 * The picture of the profile page, with four icon buttons over it (two rows of two) while it is hovered or holds the focus:
 * use the picture (switches back to the uploaded one), use the pixel avatar (the picture is kept), "Upload image" (picks an
 * image to upload and shows it) and "Change outfit" (the wardrobe).
 */
export const AvatarUpload = ({
  avatarUrl,
  avatarSource,
  userInitials = '??',
  onUploadSuccess,
  onSourceChange,
  outfitTo,
  className,
  initialsClassName,
  fallback,
}: AvatarUploadProps) => {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showingPicture = Boolean(avatarUrl) && avatarSource !== 'pixel';
  const canSwitchBack = Boolean(avatarUrl) && avatarSource === 'pixel';

  const switchTo = async (source: 'picture' | 'pixel') => {
    setBusy(true);
    try {
      await profileApi.updateAvatarSource(source);
      onSourceChange?.();
      toast.success(source === 'pixel' ? 'Now showing your pixel avatar.' : 'Now showing your picture.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to change the avatar.'));
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setBusy(true);
    try {
      const { avatarUrl: newUrl } = await profileApi.uploadAvatar(file);
      onUploadSuccess(newUrl);
      toast.success('Avatar updated successfully.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload avatar.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="shrink-0">
      {/* The 61px square tile of the user rows (`UserRow`); the buttons show on hover or while one of them has the focus. */}
      <div className="group relative block">
        <Avatar className={cn('size-[61px]', className)}>
          <AvatarImage src={showingPicture ? avatarUrl : undefined} alt="Profile avatar" />
          <AvatarFallback className={cn('bg-transparent text-xl font-black text-primary', initialsClassName)}>{fallback ?? userInitials}</AvatarFallback>
        </Avatar>

        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 transition-opacity',
            busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin text-primary" />
          ) : (
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-2 gap-2">
                  <Tip label={avatarUrl ? 'Use your picture' : 'Upload an image first'}>
                    <button type="button" onClick={() => void switchTo('picture')} disabled={!canSwitchBack} aria-label="Use a picture" aria-pressed={showingPicture} className={cn(iconButtonClass, showingPicture && selectedClass)}>
                      <ImageIcon className="size-5" />
                    </button>
                  </Tip>
                  <Tip label="Use your pixel avatar">
                    <button type="button" onClick={() => void switchTo('pixel')} disabled={!showingPicture} aria-label="Use the pixel avatar" aria-pressed={!showingPicture} className={cn(iconButtonClass, !showingPicture && selectedClass)}>
                      <UserRound className="size-5" />
                    </button>
                  </Tip>
                  <Tip label="Upload image (up to 5MB)">
                    <button type="button" onClick={() => inputRef.current?.click()} aria-label="Upload image" className={iconButtonClass}>
                      <Upload className="size-5" />
                    </button>
                  </Tip>
                  {outfitTo ? (
                    <Tip label="Change outfit">
                      <Link to={outfitTo} aria-label="Change outfit" className={iconButtonClass}>
                        <Shirt className="size-5" />
                      </Link>
                    </Tip>
                  ) : (
                    <span aria-hidden />
                  )}
                </div>
              </TooltipProvider>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
};
