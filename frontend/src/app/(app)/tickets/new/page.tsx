import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { TicketForm } from '@/components/tickets/ticket-form';

/** Formulir pembuatan tiket (F-2). */
export default function NewTicketPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['END_USER', 'AGENT', 'ADMIN']}>
        <div className="mx-auto w-full max-w-3xl">
          <PageHeader
            title="Buat Tiket"
            description="Jelaskan masalah Anda. Tim IT akan menerima tiket yang sudah terkategori dan diprioritaskan otomatis."
            breadcrumb={[
              { href: '/tickets', label: 'Tiket Saya' },
              { href: '/tickets/new', label: 'Buat Tiket' },
            ]}
            actions={
              <Link
                href="/tickets"
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Kembali
              </Link>
            }
          />
          <div className="p-4 sm:p-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                {/* useSearchParams di dalam TicketForm butuh batas Suspense. */}
                <Suspense fallback={<Spinner label="Menyiapkan formulir…" />}>
                  <TicketForm />
                </Suspense>
              </CardContent>
            </Card>
          </div>
        </div>
      </RequireRole>
    </RequireAuth>
  );
}