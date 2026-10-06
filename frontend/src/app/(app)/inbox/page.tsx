import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { TicketList } from '@/components/tickets/ticket-list';

/** Antrean tiket untuk agen & admin (F-3). */
export default function InboxPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['AGENT', 'ADMIN']}>
        <TicketList scope="all" />
      </RequireRole>
    </RequireAuth>
  );
}
