'use client';

import * as React from 'react';
import {
  Bot,
  CornerDownRight,
  Lock,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, PriorityBadge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/states';
import type { TicketDetail, TicketMessage } from '@/lib/types';

function formatTime(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Riwayat percakapan tiket.
 *
 * Catatan internal (isInternal) tampil dengan gaya berbeda yang jelas —
 * nunca disamakan dengan balasan publik, karena agen harus selalu tahu
 * apa yang dilihat pengguna.
 */
export function TicketConversation({ messages }: { messages: TicketMessage[] }) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Belum ada percakapan pada tiket ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {messages.map((message) => {
        const internal = message.isInternal;
        return (
          <article
            key={message.id}
            className={
              internal
                ? 'rounded-md border border-dashed border-warning/50 bg-warning/5 p-3'
                : 'rounded-md border border-border bg-card p-3'
            }
          >
            <header className="mb-1.5 flex flex-wrap items-center gap-2">
              <UserAvatar name={message.author.name} size="sm" />
              <span className="text-sm font-medium text-foreground">
                {message.author.name}
              </span>

              {internal ? (
                <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
                  <Lock className="size-3" aria-hidden />
                  Catatan internal
                </Badge>
              ) : null}

              {message.isAiGenerated ? (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="size-3" aria-hidden />
                  Draft AI
                </Badge>
              ) : null}

              <time
                className="ml-auto text-xs text-muted-foreground"
                dateTime={message.createdAt}
              >
                {formatTime(message.createdAt)}
              </time>
            </header>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {message.content}
            </p>

            {internal ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Hanya terlihat oleh tim IT — tidak dikirim ke pengguna.
              </p>
            ) : null}

            {message.attachments?.length ? (
              <ul className="mt-2 space-y-1">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="size-3" aria-hidden />
                    {attachment.filename}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

/** Kolom composer untuk mengirim balasan publik atau catatan internal. */
export function MessageComposer({
  onSend,
  disabled = false,
  allowInternal = false,
  placeholder = 'Tulis balasan…',
}: {
  onSend: (content: string, isInternal: boolean) => Promise<void>;
  disabled?: boolean;
  allowInternal?: boolean;
  placeholder?: string;
}) {
  const [content, setContent] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      await onSend(text, isInternal);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border p-3">
      {error ? (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Kirim sebagai:
        </span>
        <Button
          type="button"
          size="sm"
          variant={isInternal ? 'secondary' : 'outline'}
          onClick={() => setIsInternal(false)}
          aria-pressed={!isInternal}
        >
          <CornerDownRight aria-hidden />
          Balasan publik
        </Button>
        {allowInternal ? (
          <Button
            type="button"
            size="sm"
            variant={isInternal ? 'secondary' : 'outline'}
            onClick={() => setIsInternal(true)}
            aria-pressed={isInternal}
          >
            <Lock aria-hidden />
            Catatan internal
          </Button>
        ) : null}
      </div>

      <Textarea
        value={content}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setContent(event.target.value)
        }
        placeholder={placeholder}
        rows={3}
        disabled={disabled || sending}
        aria-label="Isi pesan"
        onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          // Ctrl/Cmd+Enter mengirim — Enter saja membuat baris baru.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isInternal
            ? 'Hanya tim IT yang akan melihat catatan ini.'
            : 'Pengguna akan menerima pesan ini.'}
        </p>
        <Button
          onClick={() => void submit()}
          disabled={disabled || !content.trim() || sending}
          loading={sending}
        >
          {sending ? <Spinner /> : <Send aria-hidden />}
          Kirim
        </Button>
      </div>
    </div>
  );
}

/** Panel ringkasan tiket di sisi kanan (desktop) / atas (mobile). */
export function TicketSummary({ ticket }: { ticket: TicketDetail }) {
  const overdue =
    ticket.slaDueAt !== null &&
    ticket.slaBreachedAt === null &&
    new Date(ticket.slaDueAt).getTime() < Date.now() &&
    ticket.status !== 'CLOSED';

  return (
    <div className="space-y-4 p-4">
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Kode</dt>
          <dd className="font-mono text-xs">{ticket.code}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={ticket.status} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Prioritas</dt>
          <dd>
            <PriorityBadge priority={ticket.priority} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Kategori</dt>
          <dd>{ticket.category.name}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Pelapor</dt>
          <dd className="text-right">{ticket.requester.name}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Ditugaskan</dt>
          <dd className="text-right">{ticket.assignee?.name ?? '—'}</dd>
        </div>
        {ticket.slaDueAt ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Batas SLA</dt>
            <dd className={overdue ? 'text-xs font-medium text-destructive' : 'text-xs'}>
              {formatTime(ticket.slaDueAt)}
              {overdue ? ' · lewat' : ''}
              {ticket.slaBreachedAt ? ' · terlampaui' : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {ticket.aiTriaged ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <Bot className="size-3.5" aria-hidden />
            Analisis AI
          </p>
          <p className="text-xs text-muted-foreground">
            Kategori &amp; prioritas sudah diklasifikasi otomatis.
            {ticket.aiConfidence !== null
              ? ` Keyakinan ${Math.round(ticket.aiConfidence * 100)}%.`
              : ''}
            {ticket.aiSentiment ? ` Sentimen: ${ticket.aiSentiment}.` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}