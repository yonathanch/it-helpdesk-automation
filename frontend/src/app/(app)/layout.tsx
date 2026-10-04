import { AppShell } from '@/components/layout/app-shell';

/** Layout untuk seluruh halaman yang butuh sesi login. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
