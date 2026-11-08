import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthInput } from './AuthInput';

describe('AuthInput', () => {
  it('has no show button for a text field', () => {
    render(<AuthInput aria-label="Email" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows and hides the password with the button', async () => {
    const user = userEvent.setup();
    render(<AuthInput aria-label="Password" type="password" />);
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });
});
