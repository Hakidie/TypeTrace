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

  it('uses the red theme text with accent, grey without', () => {
    const { rerender } = render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} variant="toolbar" />);
    expect(screen.getByText('Page 2 of 3')).toHaveClass('text-muted-foreground');

    rerender(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} variant="toolbar" accent />);
    expect(screen.getByText('Page 2 of 3')).toHaveClass('text-primary');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('text-primary', 'bg-transparent');
  });

  it('takes the right padding of the Next button away with flushRight', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} variant="toolbar" flushRight />);
    expect(screen.getByRole('button', { name: /Next/ })).toHaveClass('pr-0');
    expect(screen.getByRole('button', { name: /Previous/ })).not.toHaveClass('pr-0');
  });

  it('plain: shows "2 of 3" without the word Page and keeps the buttons without a hover background', () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} variant="toolbar" accent plain />);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toHaveClass('hover:bg-transparent');
    // Close together: small padding around the arrows and the page.
    expect(screen.getByText('2 of 3')).toHaveClass('px-1');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('px-2');
    // Only the arrows: the buttons keep their names for screen readers.
    expect(screen.getByRole('button', { name: 'Next' })).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveTextContent('');
  });
});
