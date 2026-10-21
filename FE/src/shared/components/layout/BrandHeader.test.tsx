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

  it('puts the navigation in the center and the controls on the right, after the mode toggle', () => {
    renderWithProviders(
      <BrandHeader nav={<nav aria-label="Main">links</nav>}>
        <button>Extra</button>
      </BrandHeader>,
    );

    const header = screen.getByRole('banner');
    const [, center, right] = Array.from(header.children);
    expect(center).toContainElement(screen.getByRole('navigation', { name: 'Main' }));
    expect(right.lastElementChild).toBe(screen.getByRole('button', { name: 'Extra' }));
  });

  it('can hide the mode toggle', () => {
    renderWithProviders(<BrandHeader themeToggle={false}>x</BrandHeader>);
    expect(screen.queryByRole('button', { name: /Switch mode/ })).not.toBeInTheDocument();
  });
});
