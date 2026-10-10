import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { GoogleSignInButton } from './GoogleSignInButton';

describe('GoogleSignInButton', () => {
  it('still shows the button when no Google client ID is configured', () => {
    renderWithProviders(<GoogleSignInButton />);

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });
});
