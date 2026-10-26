import { useRef, useState } from 'react';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { profileApi } from '@/modules/profile/api/profile.api';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  userInitials?: string;
  onUploadSuccess: (newUrl: string) => void;
}

export const AvatarUpload = ({ currentAvatarUrl, userInitials = '??', onUploadSuccess }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

    setUploading(true);
    try {
      const { avatarUrl } = await profileApi.uploadAvatar(file);
      onUploadSuccess(avatarUrl);
      toast.success('Avatar updated successfully.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload avatar.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="shrink-0">
      {/* The 61px square tile of the user rows (`UserRow`); the camera shows on hover or keyboard focus. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change avatar"
        title="Change avatar (an image up to 5MB)"
        className="group relative block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
      >
        <Avatar className="size-[61px]">
          <AvatarImage src={currentAvatarUrl} alt="Profile avatar" />
          <AvatarFallback className="bg-primary/25 text-xl font-black text-primary">{userInitials}</AvatarFallback>
        </Avatar>

        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-background/70 text-primary transition-opacity',
            uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
