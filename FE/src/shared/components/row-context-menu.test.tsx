import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { RowContextMenu } from './row-context-menu';

const renderRow = (onEdit = vi.fn()) => {
  render(
    <RowContextMenu label="Actions for Lan" menu={<DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}>
      <p>Lan</p>
    </RowContextMenu>,
  );
  return onEdit;
};

describe('RowContextMenu', () => {
  it('opens its menu on a right click, runs an entry and closes', () => {
    const onEdit = renderRow();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Lan'), { clientX: 40, clientY: 60 });
    const menu = screen.getByRole('menu', { name: 'Actions for Lan' });
    expect(menu).toHaveStyle({ left: '40px', top: '60px' });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and on a click outside, and opens with the menu key', () => {
    renderRow();
    const row = screen.getByRole('group', { name: 'Actions for Lan' });

    fireEvent.keyDown(row, { key: 'ContextMenu' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(row, { clientX: 5, clientY: 5 });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
