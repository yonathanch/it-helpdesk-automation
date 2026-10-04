import type { Role } from './types';

/**
 * Definisi navigasi terpusat.
 * Filter per role di sini agar sidebar, mobile nav, dan breadcrumb konsisten.
 * Otorisasi sesungguhnya tetap ditegakkan backend (RolesGuard).
 */

export interface NavItem {
  href: string;
  label: string;
  /** Kunci ikon — dipetakan ke komponen Lucide di sidebar (client component). */
  icon: string;
  roles: Role[];
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/tickets',
    label: 'Tiket Saya',
    icon: 'ticket',
    roles: ['END_USER'],
    description: 'Buat dan pantau tiket dukungan Anda',
  },
  {
    href: '/chat',
    label: 'Asisten AI',
    icon: 'sparkles',
    roles: ['END_USER'],
    description: 'Tanya jawaban langsung dari basis pengetahuan',
  },
  {
    href: '/inbox',
    label: 'Inbox Tiket',
    icon: 'inbox',
    roles: ['AGENT', 'ADMIN'],
    description: 'Antrean tiket yang ditangani tim IT',
  },
  {
    href: '/knowledge',
    label: 'Basis Pengetahuan',
    icon: 'book',
    roles: ['END_USER', 'AGENT', 'ADMIN'],
    description: 'Panduan & solusi masalah',
  },
  {
    href: '/admin',
    label: 'Administrasi',
    icon: 'settings',
    roles: ['ADMIN'],
    description: 'Statistik, SLA, pengguna, dan kategori',
  },
];

/** Menu yang boleh dilihat oleh role tertentu. */
export function navForRole(role: Role | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Route "root" tiap role setelah login. */
export function homeForRole(role: Role): string {
  return role === 'ADMIN' ? '/admin' : role === 'AGENT' ? '/inbox' : '/tickets';
}
