'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BellRing,
  CheckCheck,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/states';
import { useNotifications } from '@/components/providers/notifications-provider';
import { toUserMessage } from '@/lib/api-error';
import * as metaService from '@/lib/services/meta.service';
import { NOTIFICATION_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/labels';
import type { AppNotification } from '@/lib/types';
import type { TicketStatus } from '@/lib/types';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationList() {
  const { unreadCount, markRead, markAllRead } = useNotifications();
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await metaService.listNotifications());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openNotification = async (item: AppNotification) => {
    if (!item.readAt) {
      setBusyId(item.id);
      try {
        await markRead(item.id);
        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
        );
      } catch (err) {
        setError(toUserMessage(err));
      } finally {
        setBusyId(null);
      }
    }
  };

  const readAll = async () => {
    setError(null);
    try {
      await markAllRead();
      await load();
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Pembaruan tiket, penugasan, dan peringatan SLA."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void readAll()}
              disabled={unreadCount === 0}
            >
              <CheckCheck aria-hidden />
              Tandai semua terbaca
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Muat ulang"
              title="Muat ulang"
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} aria-hidden />
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {loading && items.length === 0 ? (
        <SkeletonRows rows={5} columns={2} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Tidak ada notifikasi"
          description="Pemberitahuan tentang tiket dan SLA akan muncul di sini."
          icon={<Inbox className="size-5" aria-hidden />}
        />
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const unread = item.readAt === null;
            const ticketStatus = item.ticket?.status as TicketStatus | undefined;
            const statusColor = ticketStatus ? STATUS_TONE[ticketStatus] : undefined;
            const statusLabel = ticketStatus ? STATUS_LABEL[ticketStatus] : null;
            const body = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{NOTIFICATION_LABEL[item.type]}</Badge>
                  {statusLabel && statusColor ? (
                    <Badge style={{ backgroundColor: statusColor, color: 'white' }} className="font-semibold">
                      {statusLabel}
                    </Badge>
                  ) : null}
                  <span className="text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  {unread ? (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <BellRing className="size-3" aria-hidden />
                      Baru
                    </span>
                  ) : null}
                  <time
                    className="ml-auto text-xs text-muted-foreground"
                    dateTime={item.createdAt}
                  >
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                {item.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                ) : null}
                {item.ticket ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.ticket.code} — {item.ticket.title}
                  </p>
                ) : null}
              </>
            );

            return (
              <div key={item.id} className="px-4 py-3 sm:px-6">
                {item.ticket ? (
                  <Link
                    href={`/tickets/${item.ticket.id}`}
                    onClick={() => void openNotification(item)}
                    aria-busy={busyId === item.id}
                    className={`block rounded-md border p-3 transition-colors ${
                      unread
                        ? 'border-primary/30 bg-accent/30 hover:bg-accent/50'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    {body}
                  </Link>
                ) : (
                  <Card className={`p-3 ${unread ? 'border-primary/30' : ''}`}>
                    {body}
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}