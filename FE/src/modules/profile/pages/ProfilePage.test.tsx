import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProfilePage } from './ProfilePage';

const getMe = vi.fn();
const getActivity = vi.fn();
const updateProfile = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: {
    getActivity: () => getActivity(),
    updateProfile: (input: unknown) => updateProfile(input),
    updateSecurity: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const profile = {
  _id: 'user-1',
  email: 'alice@example.com',
  role: 'user',
  isEmailVerified: true,
  loginOtpEnabled: false,
  displayName: 'Alice',
  bio: 'Hello',
  phone: '0123456789',
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const today = new Date().toISOString().slice(0, 10);

const renderPage = () => renderWithProviders(<ProfilePage />, { route: '/profile' });

/** The Profile panel: who the learner is and how they type. */
const summary = () => screen.getByRole('article', { name: 'Profile summary' });

beforeEach(() => {
  tokenStore.set('jwt-value');
  getMe.mockReset().mockResolvedValue(profile);
  getActivity.mockReset().mockResolvedValue({ stats: { wpm: 66.3, accuracy: 96.3 }, sessions: [{ date: today, sessions: 2 }] });
  updateProfile.mockReset();
  vi.mocked(toast.success).mockClear();
});

describe('ProfilePage (SCRUM-157)', () => {
  it('shows loading placeholders until the account is known', () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByRole('article', { name: 'Profile summary' })).not.toBeInTheDocument();
  });

  it('has a Profile, an Edit profile and a Security panel', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Profile summary' })).toBeInTheDocument();
  });

  it('shows who the learner is and how they type: streak, accuracy, speed and a year of sessions', async () => {
    renderPage();
    await within(await screen.findByRole('article', { name: 'Profile summary' })).findByText('96.3%');

    const card = summary();
    expect(within(card).getByText('Alice')).toBeInTheDocument();
    expect(within(card).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(card).getByText('Hello')).toBeInTheDocument();
    expect(within(card).getByText('001D')).toBeInTheDocument();
    expect(within(card).getByText('66')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Completed sessions in the last 364 days' })).toBeInTheDocument();
    expect(within(card).getByTitle(`${today}: 2 sessions`)).toBeInTheDocument();
    expect(within(card).getByText('Verified')).toBeInTheDocument();
    expect(within(card).getByText('Learner')).toBeInTheDocument();
    expect(within(card).getByText('Joined 15 Jan 2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledOnce();
  });

  it('shows zeros and a way to start to a new learner, and asks for a display name instead of the email twice', async () => {
    getMe.mockResolvedValue({ ...profile, displayName: undefined, bio: undefined });
    getActivity.mockResolvedValue({ sessions: [] });
    renderPage();

    expect(await screen.findByText('No completed sessions yet.', { exact: false })).toBeInTheDocument();
    const card = summary();
    expect(within(card).getByText('000D')).toBeInTheDocument();
    expect(within(card).getByText('000%')).toBeInTheDocument();
    expect(within(card).getByText('0000')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Practice on the Typing page' })).toHaveAttribute('href', '/typing');
    expect(within(card).getAllByText('alice@example.com')).toHaveLength(1);
    expect(within(card).getByText('No display name yet: add one in Edit profile.')).toBeInTheDocument();
  });

  it('shows why the activity could not load, with a retry, and the rest of the page still works', async () => {
    getActivity.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database offline' } } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toHaveValue('Alice');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await within(summary()).findByRole('img', { name: 'Completed sessions in the last 364 days' })).toBeInTheDocument();
    expect(screen.queryByText('Database offline')).not.toBeInTheDocument();
  });

  it('does not render the edit form until the user is loaded, then fills it in', async () => {
    renderPage();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByLabelText('Display name')).toHaveValue('Alice'));
    expect(screen.getByLabelText('Phone')).toHaveValue('0123456789');
    expect(screen.getByLabelText('Bio')).toHaveValue('Hello');
  });

  it('saves the edited profile', async () => {
    updateProfile.mockResolvedValue({ ...profile, displayName: 'Alice Nguyen' });
    const user = userEvent.setup();
    renderPage();
    const name = await screen.findByLabelText('Display name');

    await user.clear(name);
    await user.type(name, 'Alice Nguyen');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Alice Nguyen', bio: 'Hello', phone: '0123456789' }));
    expect(toast.success).toHaveBeenCalledWith('Profile updated successfully.');
  });

  it('shows the login code switch reflecting the saved setting', async () => {
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Email code at login' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
