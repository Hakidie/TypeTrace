import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows the title, description and action', () => {
    render(<EmptyState title="No passages yet" description="Add the first one." action={<button type="button">Add</button>} />);
    expect(screen.getByText('No passages yet')).toBeInTheDocument();
    expect(screen.getByText('Add the first one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('has no border of its own', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.firstChild).not.toHaveClass('border');
  });
});
