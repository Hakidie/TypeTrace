import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandFooter } from './BrandFooter';

describe('BrandFooter', () => {
  it('shows the copyright line with the current year', () => {
    render(<BrandFooter />);

    expect(screen.getByText(`© ${new Date().getFullYear()} TypeTrace. All rights reserved.`)).toBeInTheDocument();
  });
});
