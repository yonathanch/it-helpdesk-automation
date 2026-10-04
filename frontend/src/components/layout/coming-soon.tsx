import { PageHeader } from './page-header';
import { EmptyState } from '@/components/ui/states';
import { Construction } from 'lucide-react';

/**
 * Placeholder jujur untuk halaman yang belum diimplementasikan.
 * Sengaja TIDAK menampilkan data contoh agar tidak disalahartikan
 * sebagai data operasional nyata.
 */
export function ComingSoon({
  title,
  description,
  milestone,
}: {
  title: string;
  description: string;
  milestone: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Construction className="size-5" aria-hidden />}
        title={`Segera hadir — ${milestone}`}
        description="Halaman ini akan dibangun pada milestone berikutnya. Navigasi, layout, dan hak akses sudah siap."
      />
    </>
  );
}
