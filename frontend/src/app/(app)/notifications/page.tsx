import { RequireAuth } from '@/components/auth/require-auth';
import { NotificationList } from '@/components/notifications/notification-list';

/** Daftar notifikasi in-app (B-7). */
export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationList />
    </RequireAuth>
  );
}