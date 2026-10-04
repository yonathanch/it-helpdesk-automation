import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Dashboard & manajemen admin (F-5). */
export default function AdminPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['ADMIN']}>
        <ComingSoon
          title="Administrasi"
          description="Statistik operasional, monitoring SLA, pengguna, dan kategori."
          milestone="F-5"
        />
      </RequireRole>
    </RequireAuth>
  );
}
