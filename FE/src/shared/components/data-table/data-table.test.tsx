import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Lan' },
  { id: '2', name: 'Minh' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', sortKey: 'name', cell: (row) => row.name },
  { id: 'plain', header: 'Plain', cell: () => 'x' },
];

const renderTable = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
  render(<DataTable label="People" columns={columns} rows={rows} getRowId={(row) => row.id} {...props} />);

describe('DataTable', () => {
  it('renders one row per item', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'People' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Minh')).toBeInTheDocument();
  });

  it('cycles sorting ascending then descending on sortable headers only', () => {
    const onSortChange = vi.fn();
    const { rerender } = renderTable({ onSortChange });

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenLastCalledWith('name');

    rerender(<DataTable label="People" columns={columns} rows={rows} getRowId={(row) => row.id} sort="name" onSortChange={onSortChange} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenLastCalledWith('-name');

    expect(screen.queryByRole('button', { name: /Plain/ })).not.toBeInTheDocument();
  });

  it('selects rows one by one and all at once, skipping unselectable rows', () => {
    const onSelectedIdsChange = vi.fn();
    renderTable({ selectedIds: [], onSelectedIdsChange, isRowSelectable: (row) => row.id !== '2' });

    fireEvent.click(screen.getByLabelText('Select row 1'));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(['1']);
    expect(screen.getByLabelText('Select row 2')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Select all rows'));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith(['1']);
  });

  it('clears the selection when everything is already selected', () => {
    const onSelectedIdsChange = vi.fn();
    renderTable({ selectedIds: ['1', '2'], onSelectedIdsChange });
    expect(screen.getByLabelText('Select all rows')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Select all rows'));
    expect(onSelectedIdsChange).toHaveBeenLastCalledWith([]);
  });

  it('shows the empty state and the loading state', () => {
    const { rerender } = renderTable({ rows: [], emptyState: <p>Nothing here</p> });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();

    rerender(<DataTable label="People" columns={columns} rows={[]} getRowId={(row) => row.id} isLoading />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
  });

  it('scrolls sideways inside its own box, which also holds the visually hidden headers', () => {
    renderTable({ columns: [...columns, { id: 'actions', header: <span className="sr-only">Actions</span>, cell: () => null }] });

    // `sr-only` is positioned absolutely: without `relative` on the scroll box it would stick out on a phone and make
    // the whole page scroll sideways.
    const box = screen.getByRole('table').parentElement;
    expect(box).toHaveClass('overflow-x-auto', 'relative');
    expect(box).toContainElement(screen.getByText('Actions'));
  });
});
