import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

export interface DataTableColumn<T> {
  /** Unique key of the column. */
  id: string;
  header: ReactNode;
  /** What the cell shows for one row. */
  cell: (row: T) => ReactNode;
  /** Backend field to sort by; makes the header clickable. Must be allowed by the endpoint's `sortSchema`. */
  sortKey?: string;
  /** Extra classes for the header and the cells, e.g. widths or `text-right`. */
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Current sort, e.g. `email` or `-createdAt` (descending). */
  sort?: string;
  onSortChange?: (sort: string) => void;
  /** Pass both to show checkboxes for bulk actions. */
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  /** Rows that cannot be selected (e.g. the signed-in admin). */
  isRowSelectable?: (row: T) => boolean;
  isLoading?: boolean;
  /** Shown instead of rows when there are none. */
  emptyState?: ReactNode;
  /** Accessible name of the table. */
  label: string;
}

const nextSort = (current: string | undefined, key: string) => (current === key ? `-${key}` : key);

const SortIcon = ({ sort, sortKey }: { sort?: string; sortKey: string }) => {
  if (sort === sortKey) return <ArrowUp className="size-3.5" />;
  if (sort === `-${sortKey}`) return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-40" />;
};

const checkboxClass = 'size-4 cursor-pointer border-input accent-primary disabled:cursor-not-allowed';

/**
 * Table for admin and list pages: column config, sortable headers (sorting is
 * done by the backend), optional row selection, loading and empty states.
 *
 *   <DataTable label="Users" columns={columns} rows={data.items} getRowId={(u) => u._id}
 *     sort={sort} onSortChange={setSort} />
 */
export const DataTable = <T,>({
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  selectedIds,
  onSelectedIdsChange,
  isRowSelectable = () => true,
  isLoading = false,
  emptyState,
  label,
}: DataTableProps<T>) => {
  const selectable = Boolean(selectedIds && onSelectedIdsChange);
  const selectableIds = rows.filter(isRowSelectable).map(getRowId);
  const allSelected = selectable && selectableIds.length > 0 && selectableIds.every((id) => selectedIds!.includes(id));
  const columnCount = columns.length + (selectable ? 1 : 0);

  const toggleAll = () => onSelectedIdsChange?.(allSelected ? [] : selectableIds);
  const toggleRow = (id: string) =>
    onSelectedIdsChange?.(selectedIds!.includes(id) ? selectedIds!.filter((value) => value !== id) : [...selectedIds!, id]);

  const renderBody = () => {
    if (isLoading) {
      return Array.from({ length: 5 }, (_, index) => (
        <tr key={index}>
          <td colSpan={columnCount} className="px-4 py-3">
            <Skeleton className="h-6 w-full" />
          </td>
        </tr>
      ));
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columnCount} className="p-6">
            {emptyState ?? <p className="text-center text-base text-muted-foreground">No data.</p>}
          </td>
        </tr>
      );
    }
    return rows.map((row) => {
      const id = getRowId(row);
      const checked = selectedIds?.includes(id) ?? false;
      return (
        <tr key={id} className={cn('border-t transition-colors hover:bg-muted/50', checked && 'bg-primary/5')}>
          {selectable && (
            <td className="w-10 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Select row ${id}`}
                className={checkboxClass}
                checked={checked}
                disabled={!isRowSelectable(row)}
                onChange={() => toggleRow(id)}
              />
            </td>
          )}
          {columns.map((column) => (
            <td key={column.id} className={cn('px-4 py-3 align-middle', column.className)}>
              {column.cell(row)}
            </td>
          ))}
        </tr>
      );
    });
  };

  return (
    <div className="overflow-x-auto border bg-card">
      <table className="w-full min-w-[640px] text-base" aria-label={label} aria-busy={isLoading}>
        <thead className="bg-muted/50 text-left text-sm uppercase tracking-wide text-muted-foreground">
          <tr>
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  className={checkboxClass}
                  checked={allSelected}
                  disabled={selectableIds.length === 0 || isLoading}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((column) => {
              const sortable = Boolean(column.sortKey && onSortChange);
              const ariaSort =
                sort === column.sortKey ? 'ascending' : sort === `-${column.sortKey}` ? 'descending' : undefined;
              return (
                <th key={column.id} scope="col" aria-sort={sortable ? (ariaSort ?? 'none') : undefined} className={cn('px-4 py-3 font-medium', column.className)}>
                  {sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                      onClick={() => onSortChange!(nextSort(sort, column.sortKey!))}
                    >
                      {column.header}
                      <SortIcon sort={sort} sortKey={column.sortKey!} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{renderBody()}</tbody>
      </table>
    </div>
  );
};
