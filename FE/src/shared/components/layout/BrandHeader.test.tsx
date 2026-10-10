import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { BrandHeader } from './BrandHeader';

describe('BrandHeader', () => {
  it('shows the logo as a link and the extra controls', () => {
    renderWithProviders(<BrandHeader to="/login"><button>Extra</button></BrandHeader>);

    expect(screen.getByRole('link', { name: 'TypeTrace' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });
});
