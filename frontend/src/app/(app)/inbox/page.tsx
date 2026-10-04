import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Antrean tiket untuk agen & admin (F-3). */
export default function InboxPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['AGENT', 'ADMIN']}>
        <ComingSoon
          title="Inbox Tiket"
          description="Antrean tiket masuk, belum ditugaskan, dan milik Anda."
          milestone="F-3"
        />
      </RequireRole>
    </RequireAuth>
  );
}
