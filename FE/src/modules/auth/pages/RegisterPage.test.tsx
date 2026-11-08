import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { RegisterPage } from './RegisterPage';

const register = vi.fn();
const verifyRegisterOtp = vi.fn();
const login = vi.fn();
const emailExists = vi.fn();
const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: {
    register: (payload: unknown) => register(payload),
    verifyRegisterOtp: (email: string, otp: string) => verifyRegisterOtp(email, otp),
    login: (payload: unknown) => login(payload),
    emailExists: (email: string) => emailExists(email),
    getMe: () => getMe(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/** The typing page, saying whether it was told that the account is new (it then asks to take the placement test). */
const TypingPageProbe = () => (
  <p>typing page{(useLocation().state as { newAccount?: boolean } | null)?.newAccount ? ' for a new account' : ''}</p>
);

const renderPage = () =>
  renderWithProviders(<RegisterPage />, {
    route: '/register',
    otherRoutes: { '/login': 'login page', '/typing': <TypingPageProbe /> },
  });

/** Fills the form, then types the emailed code. */
const registerAndVerify = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'new@b.com');
  await user.type(screen.getByLabelText('Password'), 'secret123');
  await user.click(screen.getByRole('button', { name: 'Register and Send OTP' }));

  expect(await screen.findByText('Confirm OTP')).toBeInTheDocument();
  await user.type(screen.getAllByRole('textbox')[0], '123456');
  await user.click(screen.getByRole('button', { name: 'Verify OTP' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  register.mockReset().mockResolvedValue({ message: 'OTP has been sent to your email' });
  verifyRegisterOtp.mockReset().mockResolvedValue({ message: 'Email verified successfully' });
  emailExists.mockReset().mockResolvedValue({ exists: false });
  login.mockReset().mockResolvedValue({ token: 'jwt-new' });
  getMe.mockReset().mockResolvedValue({ role: 'user' });
  tokenStore.clear();
});

describe('RegisterPage', () => {
  it('signs the new account in after the emailed code and opens the typing page, which asks for the placement test', async () => {
    renderPage();

    await registerAndVerify();

    expect(await screen.findByText('typing page for a new account')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith({ email: 'new@b.com', password: 'secret123' });
    expect(verifyRegisterOtp).toHaveBeenCalledWith('new@b.com', '123456');
    expect(login).toHaveBeenCalledWith({ email: 'new@b.com', password: 'secret123' });
    expect(tokenStore.get()).toBe('jwt-new');
  });

  it('opens the login page when signing in after the code does not work', async () => {
    login.mockRejectedValue(new Error('down'));
    renderPage();

    await registerAndVerify();

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Account verified! You can login now.');
    expect(tokenStore.get()).toBeNull();
  });

  it('stays on the code step and does not sign in when the code is wrong', async () => {
    verifyRegisterOtp.mockRejectedValue(new Error('Invalid or expired OTP'));
    renderPage();

    await registerAndVerify();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Confirm OTP')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('tells the learner that the email already has an account', async () => {
    emailExists.mockResolvedValue({ exists: true });
    renderPage();

    await userEvent.setup().type(screen.getByLabelText('Email'), 'taken@b.com');

    expect(await screen.findByRole('img', { name: /already has an account/i })).toBeInTheDocument();
    expect(emailExists).toHaveBeenCalledWith('taken@b.com');
  });

  it('says nothing about a free email and does not ask for an invalid one', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.type(screen.getByLabelText('Email'), '@b.com');

    await waitFor(() => expect(emailExists).toHaveBeenCalledWith('nope@b.com'));
    expect(emailExists).not.toHaveBeenCalledWith('nope');
    expect(screen.queryByRole('img', { name: /already has an account/i })).not.toBeInTheDocument();
  });

  it('shows how strong the password is while typing', async () => {
    renderPage();
    const user = userEvent.setup();

    expect(screen.queryByTestId('password-strength')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'abcdefgh');
    expect(screen.getByRole('meter', { name: 'Password strength' })).toHaveAttribute('aria-valuetext', 'Weak');
    await user.type(screen.getByLabelText('Password'), 'A1!');
    expect(screen.getByRole('meter', { name: 'Password strength' })).toHaveAttribute('aria-valuetext', 'Strong');
    await user.hover(screen.getByTestId('password-strength'));
    expect((await screen.findAllByText('Password strength: Strong')).length).toBeGreaterThan(0);
  });
});
