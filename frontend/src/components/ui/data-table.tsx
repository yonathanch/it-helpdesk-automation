'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Kolom tabel yang bisa diurutkan. */
export interface SortableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Isi sel. Falls back ke `sortValue` bila tidak diberikan. */
  render?: (row: T) => React.ReactNode;
  /** Nilai untuk membandingkan saat sorting (default: isi sel). */
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: SortableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Status pengurutan eksternal (dikendalikan server). */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;
}

/**
 * Tabel data yang bisa diurutkan.
 *
 * Sengaja dibuat tanpa library tabel: kebutuhan kita sederhana (urut & klik
 * baris), dan ini menghindari bobot dependensi. Pada layar kecil tabel tetap
 * bisa digeser horizontal — bukan disembunyikan, karena data admin memang
 * butuh lebar.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sortBy,
  sortOrder = 'desc',
  onSortChange,
  onRowClick,
  emptyState,
  loading = false,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const renderSkeleton = () => (
    <tbody>
      {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border">
          {columns.map((column, colIndex) => (
            <td key={column.key} className={cn('px-3 py-2.5', column.className)}>
              <div
                className={cn(
                  'h-3.5 animate-pulse rounded bg-muted',
                  colIndex === 0 ? 'w-16' : 'w-full max-w-32',
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((column) => {
              const active = sortBy === column.key;
              const sortable = column.sortable && onSortChange;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(
                    'px-3 py-2 text-left text-xs font-medium text-muted-foreground',
                    column.headerClassName ?? column.className,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground"
                    >
                      {column.label}
                      {active ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="size-3" aria-hidden />
                        ) : (
                          <ChevronDown className="size-3" aria-hidden />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {loading ? (
          renderSkeleton()
        ) : rows.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns.length} className="p-0">
                {emptyState}
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-border last:border-0',
                  onRowClick &&
                    'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50',
                )}
              >
                {columns.map((column) => (
                  <td
                  key={column.key}
                  className={cn('px-3 py-2.5 align-middle', column.className)}
                >
                  {column.render
                    ? column.render(row)
                    : ((column.sortValue?.(row) ?? '') as React.ReactNode)}
                </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}