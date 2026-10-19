import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('goes to the previous and next page and disables the ends', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(<Pagination page={3} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('is hidden when everything fits on one page', () => {
    render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('aligns right in the toolbar variant', () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} variant="toolbar" />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveClass('justify-end');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });
});
