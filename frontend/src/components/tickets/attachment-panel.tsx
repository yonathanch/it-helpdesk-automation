'use client';

import * as React from 'react';
import { Download, Loader2, Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toUserMessage } from '@/lib/api-error';
import { downloadAttachment } from '@/lib/api';
import * as ticketsService from '@/lib/services/tickets.service';
import type { Attachment } from '@/lib/types';

const MAX_SIZE_MB = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Panel lampiran tiket.
 *
 * Unggah memakai multipart field "file" sesuai kontrak backend. Batas 10 MB
 * dicek di sini juga supaya pengguna tidak mengunggah berkas yang pasti ditolak.
 */
export function AttachmentPanel({
  ticketId,
  attachments,
  disabled = false,
  onUploaded,
}: {
  ticketId: string;
  attachments: Attachment[];
  disabled?: boolean;
  onUploaded: (attachment: Attachment) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Ukuran berkas melebihi ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const attachment = await ticketsService.uploadAttachment(ticketId, file);
      onUploaded(attachment);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const download = async (attachment: Attachment) => {
    setError(null);
    setDownloadingId(attachment.id);
    try {
      await downloadAttachment(attachment.id, attachment.filename);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Paperclip className="size-4" aria-hidden />
            Lampiran
          </h2>
          {!disabled ? (
            <>
              <input
                ref={inputRef}
                id={`attachment-${ticketId}`}
                type="file"
                className="sr-only"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                loading={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {!uploading ? <Upload aria-hidden /> : null}
                Unggah berkas
              </Button>
            </>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Belum ada lampiran. Tambahkan tangkapan layar atau pesan error agar
            tim lebih cepat menemukan penyebab.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {attachment.filename}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatSize(attachment.size)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void download(attachment)}
                  loading={downloadingId === attachment.id}
                  aria-label={`Unduh ${attachment.filename}`}
                >
                  {downloadingId !== attachment.id ? <Download aria-hidden /> : null}
                  Unduh
                </Button>
              </li>
            ))}
          </ul>
        )}

        {uploading ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Mengunggah berkas…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}