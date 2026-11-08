export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** Shortest password the server accepts (mirrors `registerSchema` in the backend). */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * How strong a password looks, 0 (empty or shorter than the minimum) to 4. One point each for: 8+ characters, upper and lower
 * case, a digit, a symbol; 12+ characters makes up for a missing kind. A hint for the learner only: the server checks the length alone.
 */
export const passwordStrength = (password: string): PasswordStrength => {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  let points = 0;
  if (password.length >= 8) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  if (password.length >= 12) points += 1;
  return Math.min(4, Math.max(1, points)) as PasswordStrength;
};
