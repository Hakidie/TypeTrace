import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { SocialButtons } from './SocialButtons';

describe('SocialButtons', () => {
  it('shows Google, Facebook and GitHub as icon buttons', () => {
    renderWithProviders(<SocialButtons />);

    for (const name of ['Google', 'Facebook', 'GitHub']) {
      expect(screen.getByRole('button', { name: `Continue with ${name}` })).toBeInTheDocument();
    }
  });
});
