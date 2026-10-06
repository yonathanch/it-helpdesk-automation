'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FormAlert } from '@/components/ui/form-alert';
import { ApiError, toUserMessage } from '@/lib/api-error';
import * as reportingService from '@/lib/services/reporting.service';

const RATING_LABELS: Record<number, string> = {
  1: 'Sangat tidak puas',
  2: 'Tidak puas',
  3: 'Cukup',
  4: 'Puas',
  5: 'Sangat puas',
};

/**
 * Survei kepuasan untuk pelapor tiket (B-8).
 *
 * Backend hanya menerima penilaian dari pelapor, dan hanya setelah tiket
 * selesai — jadi form ini hanya dirender pada kondisi itu.
 */
export function SatisfactionForm({
  ticketId,
  ticketCode,
  onSubmitted,
}: {
  ticketId: string;
  ticketCode: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = React.useState<number | null>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    if (rating === null) {
      setError('Pilih nilai bintang terlebih dahulu.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await reportingService.submitSurvey(ticketId, rating, comment);
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      // 409 = tiket ini sudah pernah dinilai. Bukan kesalahan pengguna —
      // perlakukan seperti success supaya formulir tidak menggantung.
      if (err instanceof ApiError && err.status === 409) {
        setDone(true);
        onSubmitted?.();
      } else {
        setError(toUserMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground">
            Terima kasih atas penilaian Anda.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Masukan Anda membantu tim IT terus improve. Satu tiket hanya bisa
            dinilai satu kali.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = hovered ?? rating;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Seberapa dibantu oleh tim IT kami?</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Penilaian untuk tiket {ticketCode}. Skala 1 (sangat tidak puas) sampai
            5 (sangat puas).
          </p>
        </div>

        <FormAlert message={error} />

        <div
          role="radiogroup"
          aria-label="Nilai kepuasan"
          className="flex items-center gap-1"
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} — ${RATING_LABELS[value]}`}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(null)}
              onClick={() => setRating(value)}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className="size-6"
                aria-hidden
                fill={value <= (active ?? 0) ? 'currentColor' : 'none'}
                strokeWidth={value <= (active ?? 0) ? 0 : 1.5}
              />
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {active ? RATING_LABELS[active] : 'Belum dipilih'}
          </span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="csat-comment" className="text-xs text-muted-foreground">
            Catatan (opsional)
          </label>
          <Textarea
            id="csat-comment"
            rows={3}
            value={comment}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setComment(event.target.value)
            }
            placeholder="Apa yang berjalan baik, atau apa yang perlu diperbaiki?"
            maxLength={1000}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void submit()} loading={sending} disabled={rating === null}>
            Kirim penilaian
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}