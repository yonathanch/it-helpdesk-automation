import { RequireAuth } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Basis pengetahuan — pencarian semantik & artikel (F-4). */
export default function KnowledgePage() {
  return (
    <RequireAuth>
      <ComingSoon
        title="Basis Pengetahuan"
        description="Cari solusi dari artikel yang sudah dipublikasikan tim IT."
        milestone="F-4"
      />
    </RequireAuth>
  );
}
