'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, RotateCcw, Send, Sparkles, TicketPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import * as metaService from '@/lib/services/meta.service';
import type { ChatMessage, ChatSource } from '@/lib/types';

/**
 * Asisten AI (A-4) — antarmuka percakapan.
 *
 * Riwayat disimpan di state lokal, bukan di server. Hanya pasangan
 * role+content yang dikirim ke backend (dibatasi 20 pesan terakhir).
 */

const SUGGESTIONS = [
  'Saya lupa kata sandi email kantor',
  'Printer tidak bisa dipakai bersama',
  'VPN selalu terputus saat upload file besar',
  'Bagaimana cara mengajukan cuti di sistem?',
];

function SourceList({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <BookOpen className="size-3.5" aria-hidden />
        Sumber dari basis pengetahuan
      </p>
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={source.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{source.title}</span>
            <span className="ml-1.5 tabular-nums">
              ({(source.similarity * 100).toFixed(0)}% cocok)
            </span>
            <p className="mt-0.5 line-clamp-2">{source.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatAssistant() {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // Tampilkan pesan pengguna + placeholder "sedang thinking" sekaligus.
    setMessages((current) => [
      ...current,
      { role: 'user', content: text },
      { role: 'assistant', content: '', pending: true },
    ]);

    try {
      const history = messages
        .filter((message) => !message.pending && !message.failed)
        .map((message) => ({ role: message.role, content: message.content }));

      const result = await metaService.sendChat(text, history);
      setProvider(result.provider);

      setMessages((current) => [
        ...current.slice(0, -1),
        {
          role: 'assistant',
          content: result.answer,
          sources: result.sources,
          suggestTicket: result.suggestTicket,
          prefill: result.prefill,
        },
      ]);
    } catch (err) {
      setError(toUserMessage(err));
      setMessages((current) => [
        ...current.slice(0, -1),
        {
          role: 'assistant',
          content: 'Maaf, jawaban tidak bisa diambil saat ini.',
          failed: true,
        },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([]);
    setError(null);
    setProvider(null);
  };

  return (
    <>
      <PageHeader
        title="Asisten AI"
        description="Tanyakan kendala Anda. Jawaban diambil dari artikel basis pengetahuan tim IT."
        actions={
          <>
            {provider ? (
              <Badge variant="outline" title="Provider LLM yang dipakai backend">
                <Sparkles className="size-3" aria-hidden />
                {provider}
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={reset}
              disabled={messages.length === 0}
              aria-label="Mulai ulang percakapan"
              title="Mulai ulang"
            >
              <RotateCcw aria-hidden />
            </Button>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Apa yang bisa saya bantu?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tanyakan dalam bahasa sehari-hari. Bila jawabannya belum tersedia,
              asisten akan menyiapkan draf tiket untuk Anda kirim ke tim IT.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="h-full w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <article
                key={index}
                className={
                  message.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground'
                    : 'max-w-[92%] rounded-lg rounded-bl-sm border border-border bg-card px-3.5 py-2.5'
                }
              >
                {message.pending ? (
                  <Spinner label="Asisten sedang menjawab…" />
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>

                    {message.sources ? <SourceList sources={message.sources} /> : null}

                    {message.suggestTicket && message.prefill ? (
                      <div className="mt-3 rounded-md border border-primary/30 bg-accent/40 p-3">
                        <p className="text-sm font-medium text-foreground">
                          Buat tiket untuk masalah ini?
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Saya sudah siapkan judul dan deskripsi. Tinggal pilih
                          kategori lalu kirim ke tim IT.
                        </p>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const params = new URLSearchParams({
                              title: message.prefill?.title ?? '',
                              description: message.prefill?.description ?? '',
                            });
                            router.push(`/tickets/new?${params.toString()}`);
                          }}
                        >
                          <TicketPlus aria-hidden />
                          Buat tiket
                        </Button>
                      </div>
                    ) : null}

                    {message.failed ? (
                      <p className="mt-2 text-xs text-destructive">
                        Gagal mengambil jawaban. Coba ulangi pertanyaannya.
                      </p>
                    ) : null}
                  </>
                )}
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 rounded-lg border border-border bg-card p-3 shadow-sm">
          <label htmlFor="chat-input" className="sr-only">
            Pesan untuk asisten AI
          </label>
          <Textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setInput(event.target.value)
            }
            onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder="Tulis pertanyaan Anda… (Enter untuk kirim, Shift+Enter untuk baris baru)"
            disabled={sending}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Jawaban bisa saja tidak akurat — verifikasi artikel sumbernya.
            </p>
            <Button
              onClick={() => void send(input)}
              disabled={sending || !input.trim()}
              loading={sending}
            >
              {!sending ? <Send aria-hidden /> : null}
              Kirim
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}