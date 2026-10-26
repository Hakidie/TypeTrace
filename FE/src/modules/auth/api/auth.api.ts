import { http } from '@/shared/api/http';
import type { AuthPayload, CurrentUser, LoginResponse, MessageResponse } from '../types/auth.types';

/** Every function resolves with the response body (not the Axios response). */
export const authApi = {
  register: (payload: AuthPayload) =>
    http.post<MessageResponse>('/auth/register', payload).then((r) => r.data),
  verifyRegisterOtp: (email: string, otp: string) =>
    http.post<MessageResponse>('/auth/register/verify-otp', { email, otp }).then((r) => r.data),
  login: (payload: AuthPayload) =>
    http.post<LoginResponse>('/auth/login', payload).then((r) => r.data),
  verifyLoginOtp: (email: string, otp: string) =>
    http.post<{ token: string }>('/auth/login/verify-otp', { email, otp }).then((r) => r.data),
  forgotPassword: (email: string) =>
    http.post<MessageResponse>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (email: string, token: string, newPassword: string) =>
    http.post<MessageResponse>('/auth/reset-password', { email, token, newPassword }).then((r) => r.data),
  // `isNewUser`: the Google account had no TypeTrace account yet, one was just created.
  googleLogin: (credential: string) =>
    http.post<{ token: string; isNewUser: boolean }>('/auth/google', { credential }).then((r) => r.data),
  getMe: () => http.get<CurrentUser>('/auth/me').then((r) => r.data),
};
