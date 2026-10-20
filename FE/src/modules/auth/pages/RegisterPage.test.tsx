import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { RegisterPage } from './RegisterPage';

const register = vi.fn();
const verifyRegisterOtp = vi.fn();
const login = vi.fn();
const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: {
    register: (payload: unknown) => register(payload),
    verifyRegisterOtp: (email: string, otp: string) => verifyRegisterOtp(email, otp),
    login: (payload: unknown) => login(payload),
    getMe: () => getMe(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const renderPage = () =>
  renderWithProviders(<RegisterPage />, {
    route: '/register',
    otherRoutes: { '/login': 'login page', '/typing': 'typing page' },
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
  login.mockReset().mockResolvedValue({ token: 'jwt-new' });
  getMe.mockReset().mockResolvedValue({ role: 'user' });
  tokenStore.clear();
});

describe('RegisterPage', () => {
  it('signs the new account in after the emailed code and opens the typing page', async () => {
    renderPage();

    await registerAndVerify();

    expect(await screen.findByText('typing page')).toBeInTheDocument();
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
});
