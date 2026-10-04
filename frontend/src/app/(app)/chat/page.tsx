import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { ComingSoon } from '@/components/layout/coming-soon';

/** Virtual assistant (F-2). */
export default function ChatPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['END_USER']}>
        <ComingSoon
          title="Asisten AI"
          description="Tanyakan kendala Anda; jawaban diambil dari basis pengetahuan."
          milestone="F-2"
        />
      </RequireRole>
    </RequireAuth>
  );
}
