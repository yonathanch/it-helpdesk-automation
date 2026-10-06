'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Sparkles,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { FormAlert } from '@/components/ui/form-alert';
import { ErrorState, Spinner } from '@/components/ui/states';
import {
  MessageComposer,
  TicketConversation,
  TicketSummary,
} from '@/components/tickets/ticket-conversation';
import { AttachmentPanel } from '@/components/tickets/attachment-panel';
import { SatisfactionForm } from '@/components/tickets/satisfaction-form';
import { useAuth } from '@/components/providers/auth-provider';
import { useRealtimeSubscription } from '@/components/providers/realtime-provider';
import { subscribeTicket } from '@/lib/realtime';
import { toUserMessage } from '@/lib/api-error';
import * as ticketsService from '@/lib/services/tickets.service';
import * as usersService from '@/lib/services/users.service';
import { ALLOWED_TRANSITIONS } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/labels';
import type { AgentOption, Attachment, TicketDetail, TicketStatus } from '@/lib/types';

export function TicketDetailView({ staffActions }: { staffActions: boolean }) {
  const params = useParams<{ id: string }>();
  const ticketId = params?.id ?? '';
  const { user } = useAuth();

  const [ticket, setTicket] = React.useState<TicketDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [statusBusy, setStatusBusy] = React.useState(false);

  // State draft AI
  const [draft, setDraft] = React.useState<string | null>(null);
  const [draftLoading, setDraftLoading] = React.useState(false);
  const [editedDraft, setEditedDraft] = React.useState('');

  // Daftar agen untuk penugasan manual
  const [agents, setAgents] = React.useState<AgentOption[]>([]);

  React.useEffect(() => {
    if (!staffActions) return;
    let cancelled = false;
    usersService
      .listAgents()
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch(() => {
        // Daftar agen adalah pelengkap — kegagalannya tidak boleh
        // menghalangi agen menangani tiket.
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [staffActions]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketsService.getTicket(ticketId);
      setTicket(data);
      setDraft(data.aiDraft);
      setEditedDraft(data.aiDraft ?? '');
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  React.useEffect(() => {
    if (ticketId) void load();
  }, [ticketId, load]);

  // Ikuti room realtime tiket ini supaya pesan & status baru langsung muncul.
  React.useEffect(() => {
    if (!ticketId) return;
    return subscribeTicket(ticketId);
  }, [ticketId]);

  // Pesan dari agen lain / sistem — tarik ulang detail agar sinkron.
  useRealtimeSubscription('message', () => {
    void load();
  });
  useRealtimeSubscription('ticket_updated', () => {
    void load();
  });

  const sendMessage = async (content: string, isInternal: boolean) => {
    const message = await ticketsService.addMessage(ticketId, content, isInternal);
    // Respons berisi satu TicketMessage, bukan detail tiket — jangan
    // replaceseluruh state atau percakapan yang tampil akan hilang.
    setTicket((current) =>
      current
        ? {
            ...current,
            messages: [...current.messages, message],
          }
        : current,
    );
  };

  const changeStatus = async (status: TicketStatus) => {
    setStatusBusy(true);
    setActionError(null);
    try {
      const updated = await ticketsService.updateStatus(ticketId, status);
      setTicket((current) => (current ? { ...current, ...updated } : current));
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const generateDraft = async () => {
    setDraftLoading(true);
    setActionError(null);
    try {
      const result = await ticketsService.generateDraft(ticketId);
      setDraft(result.draft);
      setEditedDraft(result.draft);
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setDraftLoading(false);
    }
  };

  const approveDraft = async () => {
    setDraftLoading(true);
    setActionError(null);
    try {
      await ticketsService.approveDraft(ticketId, editedDraft);
      setDraft(null);
      setEditedDraft('');
      await load();
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setDraftLoading(false);
    }
  };

  const discardDraft = async () => {
    setDraftLoading(true);
    try {
      await ticketsService.discardDraft(ticketId);
      setDraft(null);
      setEditedDraft('');
      await load();
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setDraftLoading(false);
    }
  };

  const autoAssign = async () => {
    setStatusBusy(true);
    setActionError(null);
    try {
      const updated = await ticketsService.autoAssign(ticketId);
      setTicket((current) => (current ? { ...current, ...updated } : current));
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const onAttachmentUploaded = (attachment: Attachment) => {
    // Respons upload adalah objek Attachment, bukan detail tiket — append
    // ke daftar agar percakapan & sisa data tiket tidak ikut hilang.
    setTicket((current) =>
      current
        ? { ...current, attachments: [...current.attachments, attachment] }
        : current,
    );
  };

  const assignTo = async (assigneeId: string) => {
    setStatusBusy(true);
    setActionError(null);
    try {
      const updated = await ticketsService.assignTicket(ticketId, assigneeId);
      // Penugasan mengembalikan tiket tanpa daftar pesan — gabungkan agar
      // percakapan yang sedang tampil tidak hilang.
      setTicket((current) => (current ? { ...current, ...updated } : current));
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Memuat tiket…" />
      </div>
    );
  }

  if (error || !ticket) {
    return <ErrorState message={error ?? 'Tiket tidak ditemukan'} onRetry={() => void load()} />;
  }

  const nextStatuses = ALLOWED_TRANSITIONS[ticket.status] ?? [];
  const isClosed = ticket.status === 'CLOSED';
  // Survei hanya untuk pelapor, dan hanya setelah tiket selesai.
  const canRate =
    user?.role === 'END_USER' &&
    user.id === ticket.requesterId &&
    (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED');

  return (
    <>
      <PageHeader
        title={ticket.title}
        description={`${ticket.code} · dibuat ${new Date(ticket.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`}
        breadcrumb={[
          { href: staffActions ? '/inbox' : '/tickets', label: staffActions ? 'Inbox Tiket' : 'Tiket Saya' },
          { href: `/tickets/${ticket.id}`, label: ticket.code },
        ]}
        actions={
          <>
            <Link
              href={staffActions ? '/inbox' : '/tickets'}
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Kembali
            </Link>
          </>
        }
      />

      {actionError ? (
        <div className="px-4 pt-3 sm:px-6">
          <FormAlert message={actionError} />
        </div>
      ) : null}

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Kolom utama: deskripsi + percakapan */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Deskripsi masalah
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <AttachmentPanel
            ticketId={ticket.id}
            attachments={ticket.attachments}
            disabled={isClosed}
            onUploaded={onAttachmentUploaded}
          />

          {/* Panel draft AI untuk agen */}
          {staffActions ? (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Wand2 className="size-4 text-primary" aria-hidden />
                    Draf balasan AI
                  </h2>
                  <div className="ml-auto flex gap-2">
                    {!draft ? (
                      <Button size="sm" onClick={() => void generateDraft()} loading={draftLoading} disabled={isClosed}>
                        <Sparkles aria-hidden />
                        Buat draf
                      </Button>
                    ) : null}
                  </div>
                </div>

                {!draft ? (
                  <p className="text-xs text-muted-foreground">
                    AI menyusun draf dari isi tiket, percakapan, dan artikel terkait.
                    Draf <strong>tidak</strong> dikirim sampai Anda menyetujuinya.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={editedDraft}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setEditedDraft(event.target.value)
                      }
                      rows={6}
                      aria-label="Draf balasan — boleh disunting sebelum dikirim"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void approveDraft()}
                        loading={draftLoading}
                        disabled={!editedDraft.trim() || isClosed}
                      >
                        <Check aria-hidden />
                        Setujui &amp; kirim
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void discardDraft()}
                        disabled={draftLoading}
                      >
                        Buang draf
                      </Button>
                      {isClosed ? (
                        <p className="text-xs text-muted-foreground">
                          Tiket sudah ditutup — draf tidak bisa dikirim.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <TicketConversation messages={ticket.messages} />
            {!isClosed ? (
              <MessageComposer
                onSend={sendMessage}
                allowInternal={Boolean(staffActions)}
                placeholder={
                  staffActions
                    ? 'Tulis balasan atau catatan internal…'
                    : 'Tambahkan informasi atau jawab pertanyaan tim…'
                }
              />
            ) : (
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Tiket sudah ditutup — percakapan tidak bisa dilanjutkan.
              </p>
            )}
          </Card>

          {canRate ? (
            <SatisfactionForm ticketId={ticket.id} ticketCode={ticket.code} />
          ) : null}
        </div>

        {/* Sisi kanan: ringkasan + aksi agen */}
        <aside className="space-y-4">
          <Card>
            <TicketSummary ticket={ticket} />
          </Card>

          {staffActions ? (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <UserCheck className="size-4" aria-hidden />
                  Aksi agen
                </h2>

                {nextStatuses.length > 0 ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="status-select"
                      className="block text-xs text-muted-foreground"
                    >
                      Ubah status ke
                    </label>
                    <Select
                      id="status-select"
                      value=""
                      disabled={statusBusy}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                        if (event.target.value) {
                          void changeStatus(event.target.value as TicketStatus);
                        }
                      }}
                    >
                      <option value="">Pilih status…</option>
                      {nextStatuses.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Status saat ini tidak punya transisi lanjutan.
                  </p>
                )}

                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <label
                    htmlFor="assignee-select"
                    className="block text-xs text-muted-foreground"
                  >
                    Tugaskan ke agen
                  </label>
                  <Select
                    id="assignee-select"
                    value={ticket.assigneeId ?? ''}
                    disabled={statusBusy || agents.length === 0}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                      if (event.target.value) {
                        void assignTo(event.target.value);
                      }
                    }}
                  >
                    <option value="">
                      {agents.length === 0
                        ? 'Tidak ada agen aktif'
                        : 'Belum ditugaskan'}
                    </option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} · {agent.activeTickets} tiket aktif
                      </option>
                    ))}
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => void autoAssign()}
                    loading={statusBusy}
                    disabled={isClosed}
                  >
                    <UserCheck aria-hidden />
                    {ticket.assignee
                      ? 'Hitung ulang penugasan otomatis'
                      : 'Tugaskan otomatis ke agen'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Penugasan otomatis memilih agen dengan beban kerja terendah.
                    Tekan <kbd className="rounded border border-border px-1">F5</kbd>{' '}
                    untuk menyegarkan bila perlu.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}