import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from './AvatarUpload';

const uploadAvatar = vi.fn();
const updateAvatarSource = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: {
    uploadAvatar: (file: File) => uploadAvatar(file),
    updateAvatarSource: (source: string) => updateAvatarSource(source),
  },
}));

// Radix AvatarImage only mounts <img> after the browser loads it, which never happens in jsdom.
vi.mock('@/shared/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (src ? <img src={src} alt={alt} /> : null),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => toastError(message),
    success: (message: string) => toastSuccess(message),
  },
}));

const NEW_URL = 'https://res.cloudinary.com/test/image/upload/v1/avatars/new.png';

const imageFile = (byteLength = 16, type = 'image/png', name = 'avatar.png') =>
  new File([new Uint8Array(byteLength)], name, { type });

const renderUpload = (onUploadSuccess = vi.fn()) => {
  const view = render(<AvatarUpload userInitials="AB" onUploadSuccess={onUploadSuccess} />);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...view, input, onUploadSuccess };
};

const selectFile = (input: HTMLInputElement, file: File) =>
  fireEvent.change(input, { target: { files: [file] } });

beforeEach(() => {
  uploadAvatar.mockReset().mockResolvedValue({ avatarUrl: NEW_URL });
  updateAvatarSource.mockReset().mockResolvedValue({});
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe('AvatarUpload', () => {
  it('uploads the selected image and reports the new URL', async () => {
    const { input, onUploadSuccess } = renderUpload();

    selectFile(input, imageFile());

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith(NEW_URL));
    expect(uploadAvatar).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalledWith('Avatar updated successfully.');
  });

  it('rejects a non-image file without calling the API', async () => {
    const { input, onUploadSuccess } = renderUpload();

    selectFile(input, new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Only image files are allowed.'));
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5MB without calling the API', async () => {
    const { input } = renderUpload();

    selectFile(input, imageFile(5 * 1024 * 1024 + 1));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Image must be under 5MB.'));
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('accepts a file exactly at the 5MB limit', async () => {
    const { input, onUploadSuccess } = renderUpload();

    selectFile(input, imageFile(5 * 1024 * 1024));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith(NEW_URL));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('does nothing when the file dialog is dismissed', () => {
    const { input } = renderUpload();

    fireEvent.change(input, { target: { files: [] } });

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('surfaces the server error message and resets the input for a retry', async () => {
    uploadAvatar.mockRejectedValue({ response: { data: { message: 'File too large' } } });
    const { input, onUploadSuccess } = renderUpload();

    selectFile(input, imageFile());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('File too large'));
    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('falls back to a generic message when the server sends none', async () => {
    uploadAvatar.mockRejectedValue(new Error('network down'));
    const { input } = renderUpload();

    selectFile(input, imageFile());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to upload avatar.'));
  });

  it('takes the buttons away while an upload is in flight', async () => {
    let resolveUpload: ((value: unknown) => void) | undefined;
    uploadAvatar.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    const { input } = renderUpload();

    selectFile(input, imageFile());

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument());

    resolveUpload?.({ avatarUrl: NEW_URL });
    expect(await screen.findByRole('button', { name: 'Upload image' })).toBeInTheDocument();
  });

  it('shows the avatar URL that arrives after the first render', () => {
    const { rerender } = render(<AvatarUpload onUploadSuccess={vi.fn()} />);
    expect(screen.queryByAltText('Profile avatar')).not.toBeInTheDocument();

    rerender(<AvatarUpload avatarUrl={NEW_URL} onUploadSuccess={vi.fn()} />);
    expect(screen.getByAltText('Profile avatar')).toHaveAttribute('src', NEW_URL);
  });

  describe('the buttons over the picture', () => {
    const renderTile = (props: Partial<React.ComponentProps<typeof AvatarUpload>> = {}) => {
      const onSourceChange = vi.fn();
      const view = render(
        <MemoryRouter>
          <AvatarUpload userInitials="AB" onUploadSuccess={vi.fn()} onSourceChange={onSourceChange} fallback={<span>pixel</span>} {...props} />
        </MemoryRouter>,
      );
      return { ...view, onSourceChange, input: view.container.querySelector('input[type="file"]') as HTMLInputElement };
    };

    it('opens the file picker from Upload image, whatever is shown', () => {
      for (const props of [{ avatarUrl: NEW_URL }, { avatarUrl: NEW_URL, avatarSource: 'pixel' as const }, {}]) {
        const { input, unmount } = renderTile(props);
        const open = vi.spyOn(input, 'click');

        fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));

        expect(open).toHaveBeenCalledOnce();
        expect(updateAvatarSource).not.toHaveBeenCalled();
        unmount();
      }
    });

    it('marks the button of what is shown as pressed, so it can be told from the other one', () => {
      const { unmount } = renderTile({ avatarUrl: NEW_URL, avatarSource: 'picture' });
      expect(screen.getByRole('button', { name: 'Use a picture' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Use the pixel avatar' })).toHaveAttribute('aria-pressed', 'false');
      unmount();

      renderTile({ avatarUrl: NEW_URL, avatarSource: 'pixel' });
      expect(screen.getByRole('button', { name: 'Use a picture' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Use the pixel avatar' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches to the pixel avatar from its icon, and keeps the picture', async () => {
      const { onSourceChange } = renderTile({ avatarUrl: NEW_URL, avatarSource: 'picture' });
      expect(screen.getByRole('button', { name: 'Use a picture' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Use the pixel avatar' }));

      await waitFor(() => expect(onSourceChange).toHaveBeenCalledOnce());
      expect(updateAvatarSource).toHaveBeenCalledWith('pixel');
      expect(uploadAvatar).not.toHaveBeenCalled();
    });

    it('shows the pixel avatar, not the picture, while it is chosen, and the picture icon brings the picture back without a new upload', async () => {
      const { onSourceChange, input } = renderTile({ avatarUrl: NEW_URL, avatarSource: 'pixel' });
      expect(screen.queryByAltText('Profile avatar')).not.toBeInTheDocument();
      expect(screen.getByText('pixel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use the pixel avatar' })).toBeDisabled();
      const open = vi.spyOn(input, 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Use a picture' }));

      await waitFor(() => expect(updateAvatarSource).toHaveBeenCalledWith('picture'));
      expect(onSourceChange).toHaveBeenCalledOnce();
      expect(open).not.toHaveBeenCalled();
    });

    it('has nothing to switch between without a picture', () => {
      renderTile();
      expect(screen.getByRole('button', { name: 'Use a picture' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Use the pixel avatar' })).toBeDisabled();
    });

    it('says why when the switch fails, and does not report a change', async () => {
      updateAvatarSource.mockRejectedValue({ response: { data: { message: 'Upload a picture first' } } });
      const { onSourceChange } = renderTile({ avatarUrl: NEW_URL });

      fireEvent.click(screen.getByRole('button', { name: 'Use the pixel avatar' }));

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Upload a picture first'));
      expect(onSourceChange).not.toHaveBeenCalled();
    });

    it('has a Change outfit link only when it is given a place to go', () => {
      const { unmount } = renderTile();
      expect(screen.queryByRole('link', { name: 'Change outfit' })).not.toBeInTheDocument();
      unmount();

      renderTile({ outfitTo: '/wardrobe' });
      expect(screen.getByRole('link', { name: 'Change outfit' })).toHaveAttribute('href', '/wardrobe');
    });
  });
});
