'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Select native dengan gaya konsisten — cukup untuk filter, bukan untuk combo_box. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs transition-colors',
      'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

/** Pagination dengan penomoran halaman & informasi jumlah data. */
export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) {
    return total !== undefined ? (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {total} data
      </p>
    ) : null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Halaman <span className="font-medium text-foreground">{page}</span> dari{' '}
        {totalPages}
        {total !== undefined ? ` · ${total} data` : ''}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
          <span className="sr-only sm:not-sr-only">Sebelumnya</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="sr-only sm:not-sr-only">Berikutnya</span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Baris alat di atas tabel: pencarian + filter + aksi. */
export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari…',
  children,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center">
      {onSearchChange ? (
        <div className="relative w-full sm:max-w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchValue ?? ''}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange(event.target.value)
            }
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8 pr-8"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>
      ) : null}
    </div>
  );
}

export { Select };