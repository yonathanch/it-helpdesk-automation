import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

/** Dashboard & manajemen admin (F-5). */
export default function AdminPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['ADMIN']}>
        <AdminDashboard />
      </RequireRole>
    </RequireAuth>
  );
}