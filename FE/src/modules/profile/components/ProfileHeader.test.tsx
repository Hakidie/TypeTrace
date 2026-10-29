import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Streak, TypingActivity } from '../types/profile.types';
import { ProfileHeader } from './ProfileHeader';

const updateProfile = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateProfile: (input: unknown) => updateProfile(input), uploadAvatar: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const user: CurrentUser = {
  bio: 'Hello there',
  _id: 'user-1',
  email: 'alice@example.com',
  role: 'user',
  isEmailVerified: true,
  loginOtpEnabled: false,
  displayName: 'Alice',
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const activity = (data?: TypingActivity) => ({ data }) as UseQueryResult<TypingActivity>;
const streakQuery = (data?: Streak) => ({ data }) as UseQueryResult<Streak>;
const streakOf = (current: number, longest: number): Streak => ({
  current,
  longest,
  today: { date: '2026-10-27', sessions: 0, missionGoal: 1, missionCompleted: false },
});

const renderHeader = (account: CurrentUser = user, data?: TypingActivity, streak = streakQuery(streakOf(5, 12))) =>
  renderWithProviders(<ProfileHeader user={account} activity={activity(data)} streak={streak} onAvatarChange={vi.fn()} />);

beforeEach(() => {
  updateProfile.mockReset();
  vi.mocked(toast.success).mockClear();
});

describe('ProfileHeader (SCRUM-157)', () => {
  it('shows the avatar, the name, the email and the numbers', () => {
    renderHeader(user, { stats: { wpm: 66.3, accuracy: 96.3 }, timezone: 'Asia/Ho_Chi_Minh', sessions: [] });

    expect(screen.getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('66')).toBeInTheDocument();
    expect(screen.getByText('005D')).toBeInTheDocument();
  });

  it('shows the current streak and, under it, the longest one, both from the streak query (SCRUM-31)', () => {
    // The activity has a session today, but the streak is the backend's: it is no longer counted from the heatmap days.
    const today = new Date().toISOString().slice(0, 10);
    renderHeader(user, { timezone: 'Asia/Ho_Chi_Minh', sessions: [{ date: today, sessions: 2, missionCompleted: true }] }, streakQuery(streakOf(0, 31)));

    expect(screen.getByText('STREAK')).toBeInTheDocument();
    expect(screen.getByText('000D')).toBeInTheDocument();
    expect(screen.getByTitle('Longest streak')).toHaveTextContent(/^BEST 031D$/);
    expect(screen.queryByText('001D')).not.toBeInTheDocument();
  });

  it('shows a dash for both streaks while the streak loads and when it could not load (SCRUM-31)', () => {
    const { unmount } = renderHeader(user, undefined, streakQuery());
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByTitle('Longest streak')).toHaveTextContent(/^BEST —$/);
    unmount();

    const failed = { isError: true, error: { response: { status: 500 } }, data: undefined } as unknown as UseQueryResult<Streak>;
    renderHeader(user, undefined, failed);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText(/^\d+D$/)).not.toBeInTheDocument();
  });

  it('keeps BEST over its value on phones, the dash too, so the header does not grow when the streak comes (SCRUM-31)', () => {
    const { unmount } = renderHeader(user, undefined, streakQuery());
    expect(screen.getByTitle('Longest streak')).toHaveClass('flex-col', 'sm:flex-row');
    unmount();

    renderHeader(user, undefined, streakQuery(streakOf(3, 12)));
    expect(screen.getByTitle('Longest streak')).toHaveClass('flex-col', 'sm:flex-row');
  });

  it('shows the day the account was made at the bottom right', () => {
    renderHeader();

    expect(screen.getByText('Joined 15 Jan 2026')).toHaveClass('text-right');
  });

  it('shows the bio under the email, or "No description" without one', () => {
    const { unmount } = renderHeader();
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Hello there');
    unmount();

    renderHeader({ ...user, bio: undefined });
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAttribute('placeholder', 'No description');
  });

  it('saves the bio on Enter', async () => {
    updateProfile.mockResolvedValue({ ...user, bio: 'Typist' });
    const person = userEvent.setup();
    renderHeader();

    const bio = screen.getByRole('textbox', { name: 'Description' });
    await person.clear(bio);
    await person.type(bio, 'Typist{Enter}');

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ bio: 'Typist' }));
    expect(toast.success).toHaveBeenCalledWith('Bio updated.');
  });

  it('saves the bio when the field loses focus, and clears it when emptied', async () => {
    updateProfile.mockResolvedValue({ ...user, bio: '' });
    const person = userEvent.setup();
    renderHeader();

    await person.clear(screen.getByRole('textbox', { name: 'Description' }));
    await person.tab();

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ bio: '' }));
  });

  it('keeps Shift+Enter as a new line, and sends nothing on Escape or when the text did not change', async () => {
    const person = userEvent.setup();
    renderHeader();
    const bio = screen.getByRole('textbox', { name: 'Description' });

    await person.click(bio);
    await person.type(bio, '{Shift>}{Enter}{/Shift}more');
    expect(bio).toHaveValue('Hello there\nmore');
    await person.keyboard('{Escape}');
    expect(bio).toHaveValue('Hello there');

    await person.click(bio);
    await person.tab();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('shows the email as the name, and a hint, while there is no display name', () => {
    renderHeader({ ...user, displayName: undefined });

    expect(screen.getAllByText('alice@example.com')).toHaveLength(1);
    expect(screen.getByText('No display name yet: hover the name to add one.')).toBeInTheDocument();
  });

  it('changes the name in place and shows the new one', async () => {
    updateProfile.mockResolvedValue({ ...user, displayName: 'Alice Nguyen' });
    const person = userEvent.setup();
    renderHeader();

    await person.click(screen.getByRole('button', { name: 'Edit display name' }));
    const input = screen.getByLabelText('New display name');
    expect(input).toHaveValue('Alice');
    await person.clear(input);
    await person.type(input, 'Alice Nguyen{Enter}');

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Alice Nguyen' }));
    expect(toast.success).toHaveBeenCalledWith('Display name updated.');
    expect(screen.queryByLabelText('New display name')).not.toBeInTheDocument();
  });

  it('does not save a name that is too short', async () => {
    const person = userEvent.setup();
    renderHeader();

    await person.click(screen.getByRole('button', { name: 'Edit display name' }));
    const input = screen.getByLabelText('New display name');
    await person.clear(input);
    await person.type(input, 'A{Enter}');

    expect(await screen.findByText('Display name must be at least 2 characters')).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('leaves the name alone on Escape or Cancel, and when nothing changed', async () => {
    const person = userEvent.setup();
    renderHeader();

    await person.click(screen.getByRole('button', { name: 'Edit display name' }));
    await person.type(screen.getByLabelText('New display name'), ' Nguyen{Escape}');
    expect(screen.getByText('Alice')).toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Edit display name' }));
    await person.click(screen.getByRole('button', { name: 'Save display name' }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('ProfileHeader: pixel avatar (ranked duel, phase 2)', () => {
  it('shows the pixel avatar when there is no uploaded picture', async () => {
    renderHeader({ ...user, avatar: { skin: 'tan', face: 'cute', hair: 'long-pink', top: 'mint', bottom: 'navy', shoes: 'sneakers-brown' } });

    expect(await screen.findByRole('img', { name: 'Your avatar' })).toBeInTheDocument();
  });

  it('links to the wardrobe', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: 'Change outfit' })).toHaveAttribute('href', '/wardrobe');
  });
});
