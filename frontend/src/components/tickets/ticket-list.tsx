'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type SortableColumn } from '@/components/ui/data-table';
import { PaginationControls } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { TicketFilters } from './ticket-filters';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  SkeletonRows,
} from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import { useRealtimeSubscription } from '@/components/providers/realtime-provider';
import * as ticketsService from '@/lib/services/tickets.service';
import type {
  Ticket,
  TicketListQuery,
} from '@/lib/types';

const PAGE_SIZE = 20;

/** Format tanggal ringkas dalam bahasa Indonesia. */
function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelative(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
}

export function TicketList({ scope }: { scope: 'mine' | 'all' }) {
  const router = useRouter();

  const [query, setQuery] = React.useState<TicketListQuery>({
    page: 1,
    limit: PAGE_SIZE,
    scope: scope === 'mine' ? undefined : 'all',
  });
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);



  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ticketsService.listTickets(query);
      setTickets(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Antrean berubah tanpa perlu tombol muat ulang. Event dari room `agents`
  // (tiket baru/berubah) dan room `user:<id>` keduanya ditangani di sini.
  useRealtimeSubscription('ticket_created', () => {
    void load();
  });
  useRealtimeSubscription('ticket_updated', () => {
    void load();
  });

  const columns: SortableColumn<Ticket>[] = [
    {
      key: 'code',
      label: 'Kode',
      sortable: true,
      className: 'w-24 font-mono text-xs text-muted-foreground',
      render: (ticket) => ticket.code,
    },
    {
      key: 'title',
      label: 'Judul',
      sortable: true,
      render: (ticket) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{ticket.title}</p>
          {scope === 'all' ? (
            <p className="truncate text-xs text-muted-foreground">
              {ticket.requester.name}
            </p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {ticket.category.name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      className: 'w-36',
      render: (ticket) => <StatusBadge status={ticket.status} />,
    },
    {
      key: 'priority',
      label: 'Prioritas',
      sortable: true,
      className: 'w-28',
      render: (ticket) => <PriorityBadge priority={ticket.priority} />,
    },
    {
      key: 'assignee',
      label: 'Ditugaskan',
      className: 'w-36 text-muted-foreground',
      render: (ticket) => ticket.assignee?.name ?? <span className="text-xs">—</span>,
    },
    {
      key: 'updatedAt',
      label: 'Diperbarui',
      sortable: true,
      className: 'w-32 text-xs text-muted-foreground',
      render: (ticket) => formatRelative(ticket.updatedAt),
    },
  ];

  const hasFilters =
    Boolean(query.search) ||
    Boolean(query.status) ||
    Boolean(query.priority) ||
    Boolean(query.dateFrom) ||
    Boolean(query.dateTo);

  return (
    <>
      <PageHeader
        title={scope === 'mine' ? 'Tiket Saya' : 'Inbox Tiket'}
        description={
          scope === 'mine'
            ? 'Daftar tiket yang pernah Anda ajukan beserta statusnya.'
            : 'Antrean tiket masuk. Klik baris untuk membuka dan menangani.'
        }
        actions={
          <>
            {scope === 'mine' ? (
              <Button onClick={() => router.push('/tickets/new')}>
                Buat tiket
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Muat ulang"
              title="Muat ulang"
            >
              <RotateCw className={loading ? 'animate-spin' : undefined} aria-hidden />
            </Button>
          </>
        }
      />

      <TicketFilters
        query={query}
        onUpdate={(patch) => { setQuery((c) => ({ ...c, page: 1, ...patch })); }}
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && tickets.length === 0 ? (
        <SkeletonRows rows={6} columns={6} />
      ) : (
        <DataTable
          columns={columns}
          rows={tickets}
          rowKey={(ticket) => ticket.id}
          loading={loading}
          sortBy={query.sortBy ?? 'createdAt'}
          sortOrder={query.sortOrder ?? 'desc'}
          onSortChange={(key) =>
            setQuery((current) => ({
              ...current,
              page: 1,
              sortBy: key as TicketListQuery['sortBy'],
              sortOrder:
                current.sortBy === key && current.sortOrder === 'desc'
                  ? 'asc'
                  : 'desc',
            }))
          }
          onRowClick={(ticket) => router.push(`/tickets/${ticket.id}`)}
          emptyState={
            hasFilters ? (
              <NoResultsState
                query={query.search}
                onReset={() => {
                  setQuery({ page: 1, limit: PAGE_SIZE });
                }}
              />
            ) : (
              <EmptyState
                title={scope === 'mine' ? 'Belum ada tiket' : 'Antrean kosong'}
                description={
                  scope === 'mine'
                    ? 'Ajukan tiket pertama Anda bila butuh bantuan tim IT.'
                    : 'Tidak ada tiket yang cocok dengan filter saat ini.'
                }
                action={
                  scope === 'mine' ? (
                    <Button onClick={() => router.push('/tickets/new')}>
                      Buat tiket
                    </Button>
                  ) : null
                }
              />
            )
          }
        />
      )}

      {!error && tickets.length > 0 ? (
        <PaginationControls
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          disabled={loading}
          onPageChange={(page: number) => setQuery((current) => ({ ...current, page }))}
        />
      ) : null}
    </>
  );
}