import * as React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

/** Empty state — jelaskan apa yang kosong dan aksi lanjutan yang tersedia. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Error state — selalu menawarkan coba ulang bila aksi tersedia. */
export function ErrorState({
  title = 'Gagal memuat data',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

/** Baris skeleton untuk placeholder tabel. */
export function SkeletonRows({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div
              key={colIndex}
              className={cn(
                'h-3.5 animate-pulse rounded bg-muted',
                colIndex === 0 ? 'w-16' : 'flex-1',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton blok untuk area lain (kartu statistik, panel). */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : null}
      <span className="sr-only">{label ?? 'Memuat'}</span>
    </span>
  );
}

/** Empty state khusus untuk hasil pencarian. */
export function NoResultsState({
  query,
  onReset,
}: {
  query?: string;
  onReset?: () => void;
}) {
  return (
    <EmptyState
      title="Tidak ada hasil"
      description={
        query
          ? `Tidak ada yang cocok dengan "${query}". Coba kata kunci lain.`
          : 'Belum ada data yang cocok dengan filter saat ini.'
      }
      action={
        onReset ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset filter
          </Button>
        ) : null
      }
    />
  );
}
