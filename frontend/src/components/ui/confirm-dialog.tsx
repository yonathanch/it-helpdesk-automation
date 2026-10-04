'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Dialog konfirmasi untuk tindakan penting (hapus, tutup tiket, ubah role).
 * Aksesibel: role="dialog" + aria-modal, fokus awal ke tombol batal,
 * Tab terperangkap di dalam dialog, Escape menutup.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'default',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Fokus awal ke tombol batal agar pengguna tidak salah menekan aksi destruktif.
  React.useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Cegah isi halaman di belakang saat dialog terbuka.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !loading) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label="Tutup dialog"
        className="absolute inset-0 cursor-default bg-foreground/40"
        onClick={() => !loading && onClose()}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-dialog-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {description ? (
          <div
            id="confirm-dialog-desc"
            className="mt-2 text-sm text-muted-foreground"
          >
            {description}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
