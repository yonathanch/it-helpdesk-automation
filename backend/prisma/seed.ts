import { PrismaClient, Role, TicketPriority, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database untuk portfolio...');
  const password = await bcrypt.hash('Password123!', 10);

  // ============ REMOVE OLD DATA (CLEAN SLATE) ============
  // hapus ticket dulu (FK), lalu user, lalu artikel, lalu category
  await prisma.ticket.deleteMany({});
  await prisma.knowledgeArticle.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Data lama dihapus.');

  // ============ 1 ADMIN ============
  const admin = await prisma.user.create({
    data: {
      email: 'admin@helpdesk.local',
      passwordHash: password,
      name: 'Budi Santoso',
      role: Role.ADMIN,
      department: 'IT Management',
    },
  });

  // ============ 44 USERS TOTAL ============
  // 1 Admin (sudah dibuat di atas) + 4 IT Support + 39 End Users = 44
  // 4 IT SUPPORT: 2 Hardware, 2 Network
  const agents = await Promise.all([
    prisma.user.create({ data: { email: 'hw1@helpdesk.local', passwordHash: password, name: 'Ahmad Hardware', role: Role.AGENT, department: 'Hardware Support' } }),
    prisma.user.create({ data: { email: 'hw2@helpdesk.local', passwordHash: password, name: 'Siti Hardware', role: Role.AGENT, department: 'Hardware Support' } }),
    prisma.user.create({ data: { email: 'nw1@helpdesk.local', passwordHash: password, name: 'Dedi Network', role: Role.AGENT, department: 'Network Support' } }),
    prisma.user.create({ data: { email: 'nw2@helpdesk.local', passwordHash: password, name: 'Rina Network', role: Role.AGENT, department: 'Network Support' } }),
  ]);

  // 39 END USERS
  const users = await Promise.all(
    Array.from({ length: 39 }).map((_, i) => 
      prisma.user.create({
        data: {
          email: `user${i + 1}@helpdesk.local`,
          passwordHash: password,
          name: `User ${i + 1}`,
          role: Role.END_USER,
          department: 'User Dept',
        },
      })
    )
  );

  // ============ CATEGORIES ============
  const categories = [
    { name: 'Hardware', slug: 'hardware', description: 'Masalah perangkat fisik: laptop, printer, monitor' },
    { name: 'Software', slug: 'software', description: 'Masalah aplikasi, sistem operasi, lisensi' },
    { name: 'Network', slug: 'network', description: 'Masalah jaringan, internet, VPN, WiFi' },
    { name: 'Akun & Akses', slug: 'akun-akses', description: 'Reset password, hak akses, SSO' },
    { name: 'Email', slug: 'email', description: 'Masalah email, Outlook, konfigurasi' },
    { name: 'Security', slug: 'security', description: 'Virus, malware, phishing, keamanan' },
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

  // ============ SLA RULES ============
  const slas = [
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

  // ============ KNOWLEDGE BASE (12 ARTIKEL) ============
  const articles = [
    {
      title: 'Cara Reset Password Akun Perusahaan',
      slug: 'reset-password',
      content: `# Cara Reset Password

## Langkah-langkah
1. Buka halaman login
2. Klik **Lupa Password**
3. Masukkan email kantor (format: nama@perusahaan.co.id)
4. Cek inbox untuk link reset
5. Buat password baru (min. 8 karakter)

## Masalah Umum
- Link tidak masuk? Cek folder spam
- Link expired? Valid 24 jam saja

Hubungi IT Help Desk jika masalah berlanjut.`,
      category: 'akun-akses',
    },
    {
      title: 'VPN Tidak Bisa Connect - Troubleshooting',
      slug: 'vpn-troubleshooting',
      content: `# VPN Troubleshooting

## Checklist Awal
1. Pastikan internet biasa bisa jalan
2. Restart VPN client
3. Cek password VPN (update setiap 30 hari)

## Solusi by Error
**Authentication Failed:** Password expired atau salah format
**Connection Timeout:** Ganti server ke Jakarta-2 atau Singapore-1
**License Limit:** Terlalu banyak device, disconnect yang lain

Buat tiket kategori Network jika tetap gagal.`,
      category: 'network',
    },
    {
      title: 'Panduan Install Printer Network',
      slug: 'install-printer',
      content: `# Install Printer Network

1. Catat IP address printer (lihat di layar printer)
2. Settings > Devices > Printers & Scanners
3. Add Printer > TCP/IP
4. Masukkan IP address
5. Pilih driver (HP, Canon, Epson)
6. Test print

**Troubleshoot:**
- Printer offline? Restart Print Spooler service
- Print stuck? Hapus queue dan restart

Hubungi Hardware Support untuk bantuan.`,
      category: 'hardware',
    },
    {
      title: 'Lisensi Microsoft Office Expired',
      slug: 'office-license',
      content: `# Microsoft Office License

## Cek Status
File > Account > Product Information

## Aktivasi Ulang
1. Change License
2. Masukkan email kantor
3. SSO login
4. Restart Office

## Reinstall
1. Download dari portal.perusahaan.co.id/software
2. Uninstall Office lama
3. Install versi baru
4. Aktivasi dengan akun kantor

Setiap user dapat 5 lisensi (PC + mobile).`,
      category: 'software',
    },
    {
      title: 'WiFi Perusahaan Tidak Terdeteksi',
      slug: 'wifi-not-found',
      content: `# WiFi Network Issues

## SSID Perusahaan
- **Perusahaan-Corp** (5GHz) - lebih cepat
- **Perusahaan-Guest** (2.4GHz) - coverage luas

## Troubleshooting
1. Pastikan WiFi adapter menyala (Fn+F12)
2. Restart laptop
3. Update driver WiFi
4. Forget network dan reconnect

Password WiFi = password SSO login.`,
      category: 'network',
    },
    {
      title: 'Backup Data ke OneDrive',
      slug: 'backup-onedrive',
      content: `# OneDrive Backup

## Setup
1. Buka OneDrive (ikon awan di taskbar)
2. Login: nama@perusahaan.co.id
3. Pilih folder sync: Documents, Desktop, Pictures

## Auto-Backup
Settings > Backup > Manage Backup
Aktifkan Files On-Demand untuk hemat storage

## Recovery
- File terhapus? Recycle Bin (30 hari)
- Versi lama? Version History

Quota: 1 TB per user.`,
      category: 'software',
    },
    {
      title: 'Mengenali Email Phishing',
      slug: 'phishing-awareness',
      content: `# Email Phishing Warning

## Ciri-ciri Phishing
⚠️ Sender mencurigakan (domain mirip)
⚠️ Urgent: "Akun akan ditutup dalam 24 jam!"
⚠️ Link panjang dengan karakter acak
⚠️ Attachment .exe, .zip dari unknown sender

## Jika Dapat Email Phishing
1. JANGAN KLIK link atau download
2. Forward ke security@perusahaan.co.id
3. Report ke IT Help Desk
4. Hapus email

## Jika Sudah Klik
- Ganti password SSO segera
- Scan komputer dengan antivirus
- Report ke IT Security team

Stay safe!`,
      category: 'security',
    },
    {
      title: 'Setup Outlook Mobile',
      slug: 'outlook-mobile',
      content: `# Outlook Mobile Configuration

## Android/iOS
1. Download Microsoft Outlook
2. Add Account
3. Email: nama@perusahaan.co.id
4. Pilih Office 365
5. SSO login
6. Allow notifications

## Settings Recommended
- Sync: Push (real-time)
- Download: WiFi only
- Signature: Gunakan template perusahaan

## Troubleshoot
- Notifikasi off? Check app permissions
- Sync lambat? Reduce sync range ke 3 hari`,
      category: 'email',
    },
    {
      title: 'Laptop Lambat - Optimasi Performance',
      slug: 'laptop-slow',
      content: `# Optimize Laptop Performance

## Quick Fix (5 menit)
1. Restart laptop (bukan sleep)
2. Close apps di Task Manager
3. Delete temporary: Win+R > %temp% > Delete all
4. Empty Recycle Bin

## Disk Cleanup
- This PC > C: Properties > Disk Cleanup
- Clean temp files, thumbnails, downloads
- Minimal 20% free space untuk performa optimal

## Startup Programs
Task Manager > Startup > Disable yang tidak perlu
Jangan disable: antivirus, OneDrive, Teams

## Upgrade Hardware
RAM 8GB → 16GB atau HDD → SSD untuk boost besar.`,
      category: 'hardware',
    },
    {
      title: 'Microsoft Teams Meeting Guide',
      slug: 'teams-guide',
      content: `# Teams Meeting Best Practices

## Before Meeting
1. Test audio & video (Settings > Devices)
2. Check internet: min 1 Mbps
3. Lighting & background OK

## During Meeting
- Mute when not speaking (Ctrl+Shift+M)
- Raise hand to ask (Ctrl+Shift+K)
- Share only relevant window

## Troubleshooting
**Audio off?** Check speaker & device settings
**Video black?** Restart camera driver
**Lag?** Close other apps, disable video sementara

## Fitur Berguna
- Live captions
- Breakout rooms
- Whiteboard`,
      category: 'software',
    },
    {
      title: 'Akses Remote Desktop',
      slug: 'remote-desktop',
      content: `# Remote Desktop Access

## Setup
1. Pastikan VPN connect dulu
2. Windows: Remote Desktop Connection
3. Computer: hostname.perusahaan.local
4. Credentials: akun SSO

## Troubleshooting
- Cannot connect? Cek VPN aktif
- Slow performance? Reduce resolution
- Clipboard tidak work? Restart RDP session

Hanya untuk authorized users. Request akses via IT Admin.`,
      category: 'akun-akses',
    },
    {
      title: 'Software Installation Request',
      slug: 'software-request',
      content: `# Request Software Installation

## Prosedur
1. Cek apakah software sudah tersedia di portal
2. Jika belum ada, buat tiket kategori Software
3. Sertakan:
   - Nama software & versi
   - Business justification
   - Manager approval

## Review Process
IT akan review untuk:
- Security compliance
- Lisensi availability
- Compatibility dengan existing system

Approved request: install dalam 2-3 hari kerja.`,
      category: 'software',
    },
  ];

  for (const a of articles) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: a.slug },
      update: { content: a.content },
      create: {
        title: a.title,
        slug: a.slug,
        content: a.content,
        published: true,
        authorId: admin.id,
        categoryId: categoryRecords[a.category],
      },
    });
  }

  // ============ 25 TICKETS ============
  const ticketData = [
    // OPEN (5)
    { code: 'HD-0001', title: 'Laptop tidak bisa nyala setelah update', desc: 'Dell Latitude tidak booting. Layar hitam dengan cursor.', status: TicketStatus.OPEN, priority: TicketPriority.HIGH, cat: 'hardware', req: 0, asn: null },
    { code: 'HD-0002', title: 'Printer lantai 3 tidak terdeteksi', desc: 'HP LaserJet tidak muncul di printer list.', status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, cat: 'hardware', req: 1, asn: null },
    { code: 'HD-0003', title: 'VPN timeout saat WFH', desc: 'VPN client selalu timeout. Sudah restart router.', status: TicketStatus.OPEN, priority: TicketPriority.URGENT, cat: 'network', req: 2, asn: 2 },
    { code: 'HD-0004', title: 'Lupa password portal HR', desc: 'Email reset tidak masuk ke inbox.', status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, cat: 'akun-akses', req: 3, asn: 3 },
    { code: 'HD-0005', title: 'Outlook mobile tidak sync', desc: 'iPhone tidak terima email baru sejak kemarin.', status: TicketStatus.OPEN, priority: TicketPriority.LOW, cat: 'email', req: 4, asn: null },
    
    // IN_PROGRESS (6)
    { code: 'HD-0006', title: 'Install Adobe Creative Suite', desc: 'Photoshop + Illustrator untuk design. Lisensi approved.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, cat: 'software', req: 5, asn: 1 },
    { code: 'HD-0007', title: 'Setup dual monitor', desc: 'Monitor kedua tiba. Perlu setup & kalibrasi warna.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.MEDIUM, cat: 'hardware', req: 6, asn: 0 },
    { code: 'HD-0008', title: 'WiFi lantai 5 lemot', desc: 'Speed 2 Mbps saja. Lantai 2 dapat 50 Mbps.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, cat: 'network', req: 7, asn: 2 },
    { code: 'HD-0009', title: 'Akun terkunci setelah salah password', desc: '3x salah password. Butuh unlock untuk ERP.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.URGENT, cat: 'akun-akses', req: 0, asn: 3 },
    { code: 'HD-0010', title: 'Laptop BSOD berulang', desc: 'Lenovo BSOD 3x hari ini. Error: CRITICAL_PROCESS_DIED.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, cat: 'hardware', req: 1, asn: 0 },
    { code: 'HD-0011', title: 'Email spam filter terlalu ketat', desc: 'Email penting masuk spam. Butuh whitelist domain.', status: TicketStatus.IN_PROGRESS, priority: TicketPriority.MEDIUM, cat: 'email', req: 2, asn: null },
    
    // WAITING_USER (4)
    { code: 'HD-0012', title: 'Verifikasi identitas reset password', desc: 'Perlu foto KTP untuk verifikasi.', status: TicketStatus.WAITING_USER, priority: TicketPriority.MEDIUM, cat: 'akun-akses', req: 3, asn: 3 },
    { code: 'HD-0013', title: 'Pilih opsi upgrade hardware', desc: '(A) RAM 8→16GB Rp1.5jt atau (B) SSD 256→512GB Rp2jt?', status: TicketStatus.WAITING_USER, priority: TicketPriority.LOW, cat: 'hardware', req: 4, asn: null },
    { code: 'HD-0014', title: 'Konfirmasi lokasi access point', desc: 'AP lantai 5: meeting room atau pantry?', status: TicketStatus.WAITING_USER, priority: TicketPriority.MEDIUM, cat: 'network', req: 5, asn: 2 },
    { code: 'HD-0015', title: 'Approve lisensi Figma Pro', desc: 'Butuh approval manager untuk Figma Pro license.', status: TicketStatus.WAITING_USER, priority: TicketPriority.LOW, cat: 'software', req: 6, asn: 1 },
    
    // RESOLVED (5)
    { code: 'HD-0016', title: 'Printer HR sudah installed', desc: 'Canon installed. Test print OK. Driver shared.', status: TicketStatus.RESOLVED, priority: TicketPriority.MEDIUM, cat: 'hardware', req: 7, asn: 0 },
    { code: 'HD-0017', title: 'Password reset & 2FA aktif', desc: 'Password direset. 2FA diaktifkan. User confirm OK.', status: TicketStatus.RESOLVED, priority: TicketPriority.HIGH, cat: 'akun-akses', req: 0, asn: 3 },
    { code: 'HD-0018', title: 'VPN remote team fixed', desc: 'VPN config updated. Remote team connect OK.', status: TicketStatus.RESOLVED, priority: TicketPriority.URGENT, cat: 'network', req: 1, asn: 2 },
    { code: 'HD-0019', title: 'Email forwarding diaktifkan', desc: 'Auto-forward ke assistant@perusahaan.co.id aktif.', status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, cat: 'email', req: 2, asn: null },
    { code: 'HD-0020', title: 'Virus scan & cleanup selesai', desc: '3 malware dihapus. Antivirus updated. Laptop aman.', status: TicketStatus.RESOLVED, priority: TicketPriority.HIGH, cat: 'security', req: 3, asn: 1 },
    
    // CLOSED (5)
    { code: 'HD-0021', title: 'Training Teams untuk new hire', desc: 'Training selesai. 5 new hire trained.', status: TicketStatus.CLOSED, priority: TicketPriority.LOW, cat: 'software', req: 4, asn: 1 },
    { code: 'HD-0022', title: 'Ganti keyboard laptop', desc: 'Keyboard replaced. Garansi 3 bulan.', status: TicketStatus.CLOSED, priority: TicketPriority.MEDIUM, cat: 'hardware', req: 5, asn: null },
    { code: 'HD-0023', title: 'Network setup event company', desc: 'Temp network OK. 50 devices simultaneous.', status: TicketStatus.CLOSED, priority: TicketPriority.HIGH, cat: 'network', req: 6, asn: 2 },
    { code: 'HD-0024', title: 'Onboarding karyawan baru', desc: 'SSO, email, Teams created untuk 3 new employees.', status: TicketStatus.CLOSED, priority: TicketPriority.MEDIUM, cat: 'akun-akses', req: 7, asn: 3 },
    { code: 'HD-0025', title: 'Data recovery laptop crash', desc: '95% data recovered. User verified OK.', status: TicketStatus.CLOSED, priority: TicketPriority.URGENT, cat: 'hardware', req: 0, asn: 0 },
  ];

  const now = new Date();
  for (const t of ticketData) {
    let slaMin = 1440;
    if (t.priority === TicketPriority.URGENT) slaMin = 240;
    else if (t.priority === TicketPriority.HIGH) slaMin = 480;
    else if (t.priority === TicketPriority.LOW) slaMin = 4320;

    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    await prisma.ticket.create({
      data: {
        code: t.code,
        title: t.title,
        description: t.desc,
        status: t.status,
        priority: t.priority,
        categoryId: categoryRecords[t.cat],
        requesterId: users[t.req].id,
        assigneeId: t.asn !== null ? (t.asn < agents.length ? agents[t.asn].id : null) : null,
        slaDueAt: new Date(now.getTime() + slaMin * 60 * 1000),
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  console.log('\n✅ Seed Complete!\n');
  console.log('=== ADMIN ===');
  console.log('  admin@helpdesk.local\n');
  console.log('=== IT SUPPORT (4) ===');
  console.log('  hw1@helpdesk.local - Ahmad Hardware (Hardware Support)');
  console.log('  hw2@helpdesk.local - Siti Hardware (Hardware Support)');
  console.log('  nw1@helpdesk.local - Dedi Network (Network Support)');
  console.log('  nw2@helpdesk.local - Rina Network (Network Support)\n');
  console.log('=== END USERS (39) ===');
  console.log('  user1-user39@helpdesk.local\n');
  console.log('=== TOTAL USERS: 44 ===\n');
  console.log('Password semua: Password123!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());