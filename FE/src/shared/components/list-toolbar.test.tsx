import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListToolbar } from './list-toolbar';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const sortOptions = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'email', label: 'Email A–Z' },
];
const roleOptions = [{ value: 'admin', label: 'Admin' }];

describe('ListToolbar', () => {
  it('shows the title as a part of its own before the search box', () => {
    render(<ListToolbar title="My Passages" search={{ onSearch: vi.fn(), label: 'Search users' }} />);

    const title = screen.getByText('My Passages');
    expect(title).toHaveClass('text-primary');
    expect(title.compareDocumentPosition(screen.getByLabelText('Search users'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('reports the search text only when Enter is pressed', () => {
    const onSearch = vi.fn();
    render(<ListToolbar search={{ onSearch, label: 'Search users' }} />);

    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'lan' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText('Search users'), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('lan');
  });

  it('opens the sort menu from the Sort button, marks the current sort and reports the choice', () => {
    const onSort = vi.fn();
    render(<ListToolbar sort={{ value: '-createdAt', options: sortOptions, onChange: onSort }} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    const menu = screen.getByRole('menu', { name: 'Sort options' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Newest' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Email A–Z' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Email A–Z' }));

    expect(onSort).toHaveBeenCalledWith('email');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the filter menu with one group per filter and reports a choice or "All"', () => {
    const onRole = vi.fn();
    const onEmail = vi.fn();
    render(
      <ListToolbar
        filters={[
          { label: 'Role', value: 'admin', options: roleOptions, onChange: onRole },
          { label: 'Email', value: '', options: [{ value: 'true', label: 'Verified' }], onChange: onEmail },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    const role = within(screen.getByRole('group', { name: 'Role' }));
    expect(role.getByRole('menuitemradio', { name: 'Admin' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(role.getByRole('menuitemradio', { name: 'All' }));
    expect(onRole).toHaveBeenCalledWith('');

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Email' })).getByRole('menuitemradio', { name: 'Verified' }));
    expect(onEmail).toHaveBeenCalledWith('true');
  });

  it('shows how many filters are on', () => {
    render(
      <ListToolbar
        filters={[
          { label: 'Role', value: 'admin', options: roleOptions, onChange: vi.fn() },
          { label: 'Email', value: '', options: [], onChange: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByLabelText('1 active')).toBeInTheDocument();
  });

  it('shows the summary before the Sort button', () => {
    render(<ListToolbar summary="12 accounts in total" sort={{ value: '-createdAt', options: sortOptions, onChange: vi.fn() }} />);

    const summary = screen.getByText('12 accounts in total');
    const sort = screen.getByRole('button', { name: 'Sort' });
    expect(summary.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('turns the Sort and Filter buttons red-orange only when a non-default option is chosen', () => {
    const filter = { label: 'Role', options: roleOptions, onChange: vi.fn() };
    const { rerender } = render(
      <ListToolbar
        sort={{ value: '-createdAt', options: sortOptions, onChange: vi.fn() }}
        filters={[{ ...filter, value: '' }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sort' })).not.toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'Filter' })).not.toHaveClass('bg-primary');

    rerender(
      <ListToolbar
        sort={{ value: 'email', options: sortOptions, onChange: vi.fn() }}
        filters={[{ ...filter, value: 'admin' }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sort' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: /Filter/ })).toHaveClass('bg-primary');
  });

  it('shows the decisions as buttons of their own between the summary and Sort', () => {
    const approve = vi.fn();
    const reject = vi.fn();
    render(
      <ListToolbar
        summary="3 waiting"
        sort={{ value: 'a', options: [{ value: 'a', label: 'A' }], onChange: vi.fn() }}
        decisions={[
          { label: 'Approve 2', onClick: approve },
          { label: 'Reject 2', onClick: reject, destructive: true },
        ]}
      />,
    );

    expect(screen.getByText('3 waiting')).not.toContainElement(screen.getByRole('button', { name: 'Approve 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject 2' }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledTimes(1);
    const order = screen.getAllByRole('button').map((button) => button.textContent);
    expect(order).toEqual(['Approve 2', 'Reject 2', 'Sort']);
  });

  it('shows only the parts it is given, and the actions', () => {
    render(<ListToolbar actions={<button type="button">Delete selected</button>} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sort' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filter/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeInTheDocument();
  });
});
