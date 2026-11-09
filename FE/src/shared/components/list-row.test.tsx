import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { ListRow, ListRowMenu } from './list-row';

describe('ListRow', () => {
  it('gives the kebab button no room until the row is hovered, so the columns before it take its place', () => {
    render(
      <ListRowMenu label="Actions for Lan">
        <DropdownMenuItem>Edit</DropdownMenuItem>
      </ListRowMenu>,
    );
    // a mouse: no width and no gap until hover (the gap is the button's own left margin); a touch screen: always there
    const kebab = screen.getByRole('button', { name: 'Actions for Lan' });
    expect(kebab).toHaveClass('ml-4', 'pointer-fine:w-0', 'pointer-fine:ml-0', 'pointer-fine:group-hover:w-8');
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
