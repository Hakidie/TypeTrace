import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProfilePage } from './ProfilePage';

const getMe = vi.fn();
const getActivity = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: {
    getActivity: () => getActivity(),
    updateSecurity: vi.fn(),
    uploadAvatar: vi.fn(),
  },
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

/** The top of the page: who the learner is and how they type. */
const header = () => screen.getByRole('region', { name: 'Profile header' });
const year = new Date().getUTCFullYear();

beforeEach(() => {
  tokenStore.set('jwt-value');
  getMe.mockReset().mockResolvedValue(profile);
  getActivity.mockReset().mockResolvedValue({ stats: { wpm: 66.3, accuracy: 96.3 }, sessions: [{ date: today, sessions: 2 }] });
});

describe('ProfilePage (SCRUM-157)', () => {
  it('shows loading placeholders until the account is known', () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Profile header' })).not.toBeInTheDocument();
  });

  it('has the header and the heatmap, and no Profile, Edit profile or Security panel (Security is on the Settings page)', async () => {
    renderPage();

    expect(await screen.findByRole('region', { name: 'Profile header' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: `Completed sessions in ${year}` })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Email code at login' })).not.toBeInTheDocument();
  });

  it('shows who the learner is and how they type: speed, accuracy, streak and the sessions of the year', async () => {
    renderPage();
    await within(await screen.findByRole('region', { name: 'Profile header' })).findByText('96%');

    const card = header();
    expect(within(card).getByText('Alice')).toBeInTheDocument();
    expect(within(card).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveValue('Hello');
    expect(within(card).getByText('001D')).toBeInTheDocument();
    expect(within(card).getByText('66')).toBeInTheDocument();
    expect(within(card).getByText('Joined 15 Jan 2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
    expect(screen.getByTitle(`${today}: 2 sessions`)).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledOnce();
  });

  it('shows zeros and a way to start to a new learner, and asks for a display name instead of the email twice', async () => {
    getMe.mockResolvedValue({ ...profile, displayName: undefined, bio: undefined });
    getActivity.mockResolvedValue({ sessions: [] });
    renderPage();

    expect(await screen.findByText('No completed sessions yet.', { exact: false })).toBeInTheDocument();
    const card = header();
    expect(within(card).getByText('000D')).toBeInTheDocument();
    expect(within(card).getByText('000%')).toBeInTheDocument();
    expect(within(card).getByText('0000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice on the Typing page' })).toHaveAttribute('href', '/typing');
    expect(within(card).getAllByText('alice@example.com')).toHaveLength(1);
    expect(within(card).getByText('No display name yet: hover the name to add one.')).toBeInTheDocument();
    expect(within(card).getByRole('textbox', { name: 'Description' })).toHaveAttribute('placeholder', 'No description');
  });

  it('shows why the activity could not load, with a retry, and the header still works', async () => {
    getActivity.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database offline' } } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit display name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('img', { name: `Completed sessions in ${year}` })).toBeInTheDocument();
    expect(screen.queryByText('Database offline')).not.toBeInTheDocument();
  });
});
