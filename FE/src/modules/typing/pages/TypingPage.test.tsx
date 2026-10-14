import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingPage } from './TypingPage';

describe('TypingPage', () => {
  it('starts with no mistakes and nothing checked', () => {
    renderWithProviders(<TypingPage />);

    expect(screen.getByText('No mistakes yet')).toBeInTheDocument();
    expect(screen.getByText('Finish a word to see the rates.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart/i })).toBeDisabled();
  });

  it('checks a word when space is pressed and names the error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TypingPage />);

    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet ');

    expect(
      screen.getByText('Wrong vowel mark (â ê ô ă ơ ư), Wrong tone', { selector: 'td' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Viet', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('does not check the word that is still being typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TypingPage />);

    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet');

    expect(screen.getByText('No mistakes yet')).toBeInTheDocument();
  });

  it('clears the text on Restart', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TypingPage />);
    const area = screen.getByRole('textbox', { name: 'Typing area' });

    await user.type(area, 'Tiếng ');
    await user.click(screen.getByRole('button', { name: /restart/i }));

    expect(area).toHaveValue('');
  });
});
