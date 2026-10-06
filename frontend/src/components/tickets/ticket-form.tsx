'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FieldError, FieldHint, FormAlert } from '@/components/ui/form-alert';
import { toUserMessage } from '@/lib/api-error';
import * as ticketsService from '@/lib/services/tickets.service';
import * as categoriesService from '@/lib/services/categories.service';
import { PRIORITY_LABEL } from '@/lib/labels';
import type { Category, Ticket, TicketPriority } from '@/lib/types';

/**
 * Aturan validasi mencerminkan CreateTicketDto backend:
 * title min 3 karakter, description min 1, categoryId wajib.
 */
const schema = z.object({
  title: z
    .string()
    .min(3, 'Judul minimal 3 karakter')
    .max(200, 'Judul maksimal 200 karakter'),
  description: z
    .string()
    .min(10, 'Deskripsi minimal 10 karakter agar tim bisa membantu')
    .max(5000, 'Deskripsi terlalu panjang'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type FormValues = z.infer<typeof schema>;

export function TicketForm({
  initialCategoryId,
  onCreated,
}: {
  initialCategoryId?: string;
  onCreated?: (ticket: Ticket) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Prefill dari halaman asisten AI: ?title=...&description=...
  const prefillTitle = searchParams.get('title') ?? undefined;
  const prefillDescription = searchParams.get('description') ?? undefined;
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: prefillTitle ?? '',
      description: prefillDescription ?? '',
      categoryId: initialCategoryId ?? '',
      priority: 'MEDIUM',
    },
  });

  // Muat kategori saat komponen dimuat.
  React.useEffect(() => {
    let cancelled = false;
    categoriesService
      .listCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((error) => {
        if (!cancelled) setCategoriesError(toUserMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    try {
      const ticket = await ticketsService.createTicket({
        title: values.title.trim(),
        description: values.description.trim(),
        categoryId: values.categoryId,
        // Prioritas hanya dikirim bila pengguna mengubahnya dari default.
        priority: values.priority !== 'MEDIUM' ? values.priority : undefined,
      });

      setSuccess(`Tiket ${ticket.code} berhasil dibuat.`);
      reset();

      if (onCreated) {
        onCreated(ticket);
      } else {
        router.push(`/tickets/${ticket.id}`);
      }
    } catch (error) {
      setServerError(toUserMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormAlert message={categoriesError} />

      {success ? (
        <div
          role="status"
          className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          {success}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="title" required>
          Judul masalah
        </Label>
        <Input
          id="title"
          placeholder="Contoh: Printer di lantai 2 tidak terdeteksi"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : 'title-hint'}
          {...register('title')}
        />
        {errors.title ? (
          <FieldError id="title-error" message={errors.title.message} />
        ) : (
          <FieldHint id="title-hint">
            Ringkas dan spesifik — membantu tim klasifikasi dengan lebih cepat.
          </FieldHint>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="categoryId" required>
            Kategori
          </Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                id="categoryId"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={categories.length === 0}
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={errors.categoryId ? 'category-error' : undefined}
              >
                <option value="">
                  {categories.length === 0 ? 'Memuat kategori…' : 'Pilih kategori'}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.categoryId ? (
            <FieldError id="category-error" message={errors.categoryId.message} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="priority">Prioritas</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                id="priority"
                value={field.value}
                onChange={field.onChange}
                aria-describedby="priority-hint"
              >
                {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </option>
                ))}
              </Select>
            )}
          />
          <FieldHint id="priority-hint">
            {user?.role === 'END_USER'
              ? 'Biarkan “Sedang” bila tidak yakin — AI akan membantu menyesuaikan.'
              : 'Pilih sesuai tingkat dampak.'}
          </FieldHint>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" required>
          Deskripsi masalah
        </Label>
        <Textarea
          id="description"
          rows={6}
          placeholder="Jelaskan kronologi: apa yang terjadi, sejak kapan, sudah mencoba apa saja, dan pesan error bila ada."
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
        {errors.description ? (
          <FieldError id="description-error" message={errors.description.message} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Mengirim…' : 'Kirim tiket'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={isSubmitting}
        >
          Reset
        </Button>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Tiket akan otomatis diklasifikasi &amp; diprioritaskan oleh AI.
        </p>
      </div>
    </form>
  );
}