import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { ListRow, ListRowMenu } from './list-row';

describe('ListRow', () => {
  it('leaves a gap between extra and action only when there is an action', () => {
    const { rerender } = render(<ListRow identity="Lan" extra={<p>Stats</p>} />);
    expect(screen.getByText('Stats').parentElement).not.toHaveClass('xl:mr-4');

    rerender(<ListRow identity="Lan" extra={<p>Stats</p>} action={<button type="button">Menu</button>} />);
    expect(screen.getByText('Stats').parentElement).toHaveClass('xl:mr-4');
  });

  it('shows every slot', () => {
    render(<ListRow identity="Lan" center="64 WPM" extra={<span>heatmap</span>} action="menu" tags={<span>Admin</span>} meta="15 Jan 2026" />);

    for (const text of ['Lan', '64 WPM', 'heatmap', 'menu', 'Admin', '15 Jan 2026']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('leaves out the meta text when there is none', () => {
    const { container } = render(<ListRow identity="Lan" tags="Admin" />);
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('ListRowMenu', () => {
  it('opens a menu with the given items', async () => {
    const onSelect = vi.fn();
    render(
      <ListRowMenu label="Actions for Lan">
        <DropdownMenuItem onClick={onSelect}>Edit</DropdownMenuItem>
      </ListRowMenu>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Lan' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(onSelect).toHaveBeenCalled();
  });

  it('is only decoration without items', () => {
    render(<ListRowMenu label="Actions for Lan" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
