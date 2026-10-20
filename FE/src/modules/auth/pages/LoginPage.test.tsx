import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { LoginPage } from './LoginPage';

const login = vi.fn();
const verifyLoginOtp = vi.fn();
const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: {
    login: (payload: unknown) => login(payload),
    verifyLoginOtp: (email: string, otp: string) => verifyLoginOtp(email, otp),
    getMe: () => getMe(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const submit = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

const renderPage = () =>
  renderWithProviders(<LoginPage />, {
    route: '/login',
    otherRoutes: { '/': 'home page', '/typing': 'typing page', '/admin': 'admin page' },
  });

beforeEach(() => {
  login.mockReset();
  verifyLoginOtp.mockReset();
  getMe.mockReset();
  tokenStore.clear();
});

describe('LoginPage', () => {
  it('stores the token and opens the typing page when no email code is needed', async () => {
    login.mockResolvedValue({ token: 'jwt-value' });
    getMe.mockResolvedValue({ role: 'user' });
    renderPage();

    submit();

    expect(await screen.findByText('typing page')).toBeInTheDocument();
    expect(tokenStore.get()).toBe('jwt-value');
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' });
  });

  it('opens the typing page after the emailed code too', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ message: 'OTP sent', requiresOtp: true, email: 'a@b.com' });
    verifyLoginOtp.mockResolvedValue({ token: 'jwt-otp' });
    getMe.mockResolvedValue({ role: 'user' });
    renderPage();

    submit();
    expect(await screen.findByText('Verify OTP')).toBeInTheDocument();
    await user.type(screen.getAllByRole('textbox')[0], '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and Login' }));

    expect(await screen.findByText('typing page')).toBeInTheDocument();
    expect(verifyLoginOtp).toHaveBeenCalledWith('a@b.com', '123456');
    expect(tokenStore.get()).toBe('jwt-otp');
  });

  it('opens the admin area for an admin', async () => {
    login.mockResolvedValue({ token: 'jwt-admin' });
    getMe.mockResolvedValue({ role: 'admin' });
    renderPage();

    submit();

    expect(await screen.findByText('admin page')).toBeInTheDocument();
  });

  it('asks for the emailed code when the user turned it on', async () => {
    login.mockResolvedValue({ message: 'OTP sent', requiresOtp: true, email: 'a@b.com' });
    renderPage();

    submit();

    expect(await screen.findByText('Verify OTP')).toBeInTheDocument();
    await waitFor(() => expect(tokenStore.get()).toBeNull());
  });
});
