import { PrismaClient, Role, TicketPriority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // === Users ===
  const password = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@helpdesk.local' },
    update: {},
    create: {
      email: 'admin@helpdesk.local',
      passwordHash: password,
      name: 'Administrator',
      role: Role.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@helpdesk.local' },
    update: {},
    create: {
      email: 'agent@helpdesk.local',
      passwordHash: password,
      name: 'Support Agent',
      role: Role.AGENT,
      department: 'IT Support',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@helpdesk.local' },
    update: {},
    create: {
      email: 'user@helpdesk.local',
      passwordHash: password,
      name: 'End User',
      role: Role.END_USER,
      department: 'Finance',
    },
  });

  // === Categories ===
  const categories = [
    { name: 'Hardware', slug: 'hardware', description: 'Masalah perangkat fisik: laptop, printer, monitor' },
    { name: 'Software', slug: 'software', description: 'Masalah aplikasi dan program' },
    { name: 'Network', slug: 'network', description: 'Masalah jaringan, internet, VPN' },
    { name: 'Akun & Akses', slug: 'akun-akses', description: 'Reset password, akses sistem, izin user' },
    { name: 'Lainnya', slug: 'lainnya', description: 'Kategori umum lainnya' },
  ];
  const categoryRecords: Record<string, string> = {};
  for (const c of categories) {
    const rec = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryRecords[c.slug] = rec.id;
  }

  // === SLA rules (1 per prioritas) ===
  const slas: { name: string; priority: TicketPriority; responseMinutes: number; resolutionMinutes: number }[] = [
    { name: 'SLA Urgent', priority: TicketPriority.URGENT, responseMinutes: 15, resolutionMinutes: 240 },
    { name: 'SLA High', priority: TicketPriority.HIGH, responseMinutes: 30, resolutionMinutes: 480 },
    { name: 'SLA Medium', priority: TicketPriority.MEDIUM, responseMinutes: 120, resolutionMinutes: 1440 },
    { name: 'SLA Low', priority: TicketPriority.LOW, responseMinutes: 480, resolutionMinutes: 4320 },
  ];
  for (const s of slas) {
    await prisma.sla.upsert({
      where: { priority: s.priority },
      update: {},
      create: s,
    });
  }

  // === Knowledge base contoh ===
  await prisma.knowledgeArticle.upsert({
    where: { slug: 'reset-password' },
    update: {},
    create: {
      title: 'Cara Reset Password',
      slug: 'reset-password',
      content:
        '# Cara Reset Password\n\n1. Buka halaman login\n2. Klik **Lupa Password**\n3. Masukkan email kamu\n4. Cek inbox (dan folder spam) untuk link reset\n5. Buat password baru (min. 8 karakter, kombinasi huruf & angka)\n\nMasalah tidak bisa reset? Buat tiket dengan kategori **Akun & Akses**.',
      published: true,
      authorId: admin.id,
      categoryId: categoryRecords['akun-akses'],
    },
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: 'vpn-tidak-bisa-connect' },
    update: {},
    create: {
      title: 'VPN Tidak Bisa Connect',
      slug: 'vpn-tidak-bisa-connect',
      content:
        '# VPN Tidak Bisa Connect\n\n1. Pastikan internet biasa bisa jalan\n2. Restart klien VPN\n3. Cek apakah password VPN berubah dalam 30 hari terakhir\n4. Coba ganti server ke **Jakarta-2**\n\nJika tetap gagal, kirim pesan error saat connect ke IT Help Desk.',
      published: true,
      authorId: admin.id,
      categoryId: categoryRecords['network'],
    },
  });

  console.log('Seed selesai:');
  console.log('  - Users: admin/agent/user @helpdesk.local (password: Password123!)');
  console.log(`  - Categories: ${categories.length}`);
  console.log(`  - SLA rules: ${slas.length}`);
  console.log('  - Knowledge articles: 2');
  console.log(`  (admin=${admin.id}, agent=${agent.id}, user=${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
