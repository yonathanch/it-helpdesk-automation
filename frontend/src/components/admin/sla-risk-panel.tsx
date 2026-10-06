'use client';

import * as React from 'react';
import Link from 'next/link';
import { Siren } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { EmptyState, SkeletonRows } from '@/components/ui/states';
import type { SlaRiskTicket } from '@/lib/services/reporting.service';

/**
 * Panel tiket berisiko SLA.
 *
 * Angka "jam tersisa" dihitung backend dari `slaDueAt` yang sudah
 * dihitung dari tabel `slas`, jadi UI tidak mengira ulang aturan SLA.
 */
export function SlaRiskPanel({
  tickets,
  loading,
}: {
  tickets: SlaRiskTicket[];
  loading: boolean;
}) {
  const overdue = tickets.filter((ticket) => ticket.overdue);
  const soon = tickets.length - overdue.length;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Siren className="size-4 text-destructive" aria-hidden />
            Tiket berisiko SLA
          </h2>
          <div className="flex items-center gap-2 text-xs">
            {overdue.length > 0 ? (
              <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                {overdue.length} terlampaui
              </span>
            ) : null}
            {soon > 0 ? (
              <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 font-medium text-warning">
                {soon} mendekati batas
              </span>
            ) : null}
          </div>
        </div>

        {loading && tickets.length === 0 ? (
          <SkeletonRows rows={4} columns={4} />
        ) : tickets.length === 0 ? (
          <EmptyState
            className="py-10"
            title="Semua tiket aman"
            description="Tidak ada tiket terbuka yang mendekati atau melewati batas SLA."
          />
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="flex flex-wrap items-center gap-2 px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {ticket.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {ticket.title}
                  </span>
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {ticket.assignee?.name ?? 'Belum ada agen'}
                  </span>
                  <span
                    className={`w-32 text-right text-xs font-medium tabular-nums ${
                      ticket.overdue ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {ticket.hoursRemaining === null
                      ? '—'
                      : ticket.overdue
                        ? `lewat ${Math.abs(ticket.hoursRemaining).toFixed(1)} jam`
                        : `${ticket.hoursRemaining.toFixed(1)} jam lagi`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}