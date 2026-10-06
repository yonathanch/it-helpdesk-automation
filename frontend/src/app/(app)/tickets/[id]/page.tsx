'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { TicketDetailView } from '@/components/tickets/ticket-detail';
import { useAuth } from '@/components/providers/auth-provider';
import { isStaff } from '@/lib/labels';

/**
 * Detail tiket (F-2).
 *
 * `staffActions` menentukan apakah panel draf AI dan perubahan status tampil.
 * Ini murni untuk mengatur tampilan — backend tetap menolak aksi yang tidak
 * diizinkan oleh role.
 */
export default function TicketDetailPage() {
  return (
    <RequireAuth>
      <TicketDetailGate />
    </RequireAuth>
  );
}

/** Pisahkan agar akses ke `user` tetap di dalam provider auth. */
function TicketDetailGate() {
  const { user } = useAuth();
  return <TicketDetailView staffActions={user ? isStaff(user.role) : false} />;
}