import { RequireAuth } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Daftar notifikasi in-app (B-7 sudah ada di backend). */
export default function NotificationsPage() {
  return (
    <RequireAuth>
      <ComingSoon
        title="Notifikasi"
        description="Pembaruan tiket, penugasan, dan peringatan SLA."
        milestone="F-2"
      />
    </RequireAuth>
  );
}
