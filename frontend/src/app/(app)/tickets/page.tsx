import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { TicketList } from '@/components/tickets/ticket-list';

/** Portal pengguna — daftar "Tiket Saya" (F-2). */
export default function MyTicketsPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['END_USER', 'AGENT', 'ADMIN']}>
        <TicketList scope="mine" />
      </RequireRole>
    </RequireAuth>
  );
}
