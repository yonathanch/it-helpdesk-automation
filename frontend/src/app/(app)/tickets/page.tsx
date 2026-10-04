import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Portal pengguna — daftar "Tiket Saya" (F-2). */
export default function MyTicketsPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['END_USER']}>
        <ComingSoon
          title="Tiket Saya"
          description="Daftar tiket yang pernah Anda ajukan beserta statusnya."
          milestone="F-2"
        />
      </RequireRole>
    </RequireAuth>
  );
}
