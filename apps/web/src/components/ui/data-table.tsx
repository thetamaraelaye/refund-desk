import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from './cn';
import { EmptyState, ErrorState, LoadingState } from './states';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

// Rows open with a click, Enter or Space; the selected row is announced with aria-selected.
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  selectedId,
  onRowActivate,
  isLoading,
  error,
  onRetry,
  empty,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  selectedId?: string | null;
  onRowActivate: (row: T) => void;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  empty: { title: string; message: string };
}) {
  if (isLoading && !rows) return <LoadingState label="Loading…" />;
  if (error && !rows) {
    return <ErrorState title="Couldn't load this list" message={error.message} onRetry={onRetry} />;
  }
  if (!rows?.length) return <EmptyState title={empty.title} message={empty.message} />;

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowActivate(row);
    }
  };

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line">
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={cn('px-4 py-2 text-xs font-medium text-muted', column.className)}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = getRowId(row);
          const selected = id === selectedId;
          return (
            <tr
              key={id}
              tabIndex={0}
              aria-selected={selected}
              onClick={() => onRowActivate(row)}
              onKeyDown={(event) => onKeyDown(event, row)}
              className={cn(
                'cursor-pointer border-b border-line align-top transition-colors duration-150 ease-in-out last:border-b-0 hover:bg-sunken',
                selected && 'bg-sunken shadow-[inset_3px_0_0_var(--color-ink)]',
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
