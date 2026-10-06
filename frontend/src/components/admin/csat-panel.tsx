'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { FormAlert } from '@/components/ui/form-alert';
import { toUserMessage } from '@/lib/api-error';
import * as reportingService from '@/lib/services/reporting.service';
import type { CsatResponse } from '@/lib/services/reporting.service';

/** Bintang terisi — dipakai baik di daftar hasil survei maupun di form penilaian. */
export function StarRating({
  value,
  size = 'sm',
}: {
  value: number;
  size?: 'sm' | 'lg';
}) {
  const starClass = size === 'lg' ? 'size-5' : 'size-3.5';
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rating ${value} dari 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={starClass}
          aria-hidden
          fill={star <= value ? 'currentColor' : 'none'}
          strokeWidth={star <= value ? 0 : 1.5}
        />
      ))}
    </span>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CsatPanel() {
  const [items, setItems] = React.useState<CsatResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await reportingService.listSurveys(50));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const distribution = React.useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of items) {
      if (counts[item.rating] !== undefined) counts[item.rating] += 1;
    }
    return counts;
  }, [items]);

  const average =
    items.length > 0
      ? items.reduce((total, item) => total + item.rating, 0) / items.length
      : null;

  const maxCount = Math.max(1, ...Object.values(distribution));

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Kepuasan pengguna (CSAT)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Penilaian dikirim pelapor tiket setelah tiket selesai. Hanya satu
            penilaian per tiket.
          </p>
        </div>

        <FormAlert message={error} />

        {loading ? (
          <Spinner label="Memuat hasil survei…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState
            className="py-8"
            title="Belum ada penilaian"
            description="Data muncul setelah pengguna menilai tiket yang sudah selesai."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {average!.toFixed(2)}
                </p>
                <StarRating value={Math.round(average!)} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  dari {items.length} penilaian
                </p>
              </div>

              <ul className="min-w-48 flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star];
                  return (
                    <li key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 shrink-0 tabular-nums text-muted-foreground">
                        {star} ★
                      </span>
                      <span
                        aria-hidden
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((item) => (
                <li key={item.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.ticket.code}
                    </span>
                    <StarRating value={item.rating} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.ticket.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.user.name}
                    </span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={item.createdAt}
                    >
                      {formatDate(item.createdAt)}
                    </time>
                  </div>
                  {item.comment ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      &ldquo;{item.comment}&rdquo;
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      Tanpa komentar
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && !error && items.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Rata-rata dihitung dari 50 penilaian terbaru.
            <Badge variant="outline" className="ml-2">
              Batas tampilan
            </Badge>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}