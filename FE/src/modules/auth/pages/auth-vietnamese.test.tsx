import { fireEvent, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestHomePage } from '@/modules/home/pages/GuestHomePage';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ requiresOtp: true }),
    register: vi.fn(),
    emailExists: vi.fn().mockResolvedValue({ exists: false }),
    forgotPassword: vi.fn(),
    getMe: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('vi'));
});

describe('Auth pages and the guest home page in Vietnamese (SCRUM-329)', () => {
  it('translates the login page and its validation messages', async () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getAllByText('Đăng nhập')).toHaveLength(2); // the title and the button
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tạo tài khoản mới' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Cần nhập email')).toBeInTheDocument();
    expect(await screen.findByText('Mật khẩu phải có ít nhất 6 ký tự')).toBeInTheDocument();
  });

  it('translates the register page and the strength of the password', async () => {
    renderWithProviders(<RegisterPage />);

    expect(screen.getByRole('button', { name: 'Đăng ký và gửi OTP' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập vào tài khoản của bạn' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'abc' } });

    expect(screen.getByRole('meter', { name: 'Độ mạnh mật khẩu' })).toHaveAttribute('aria-valuetext', 'Quá ngắn');
  });

  it('translates the forgot password page', () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(screen.getByText('Quên mật khẩu')).toBeInTheDocument();
    expect(screen.getByText('Nhập email để nhận mã đặt lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi mã đặt lại' })).toBeInTheDocument();
  });

  it('translates the guest home page', () => {
    renderWithProviders(<GuestHomePage />);

    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toBeInTheDocument();
    expect(screen.getByText(/Thử bài gõ một phút/)).toBeInTheDocument();
  });
});
