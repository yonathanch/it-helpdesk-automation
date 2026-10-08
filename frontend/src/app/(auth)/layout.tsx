import Link from "next/link";
import { Check } from "lucide-react";

/** Layout halaman autentikasi: form terpusat dengan identitas produk di samping. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* Panel identitas — disembunyikan di layar kecil agar form dapat ruang. */}

      <div
        className="hidden flex-col justify-between border-r border-sidebar-border bg-sidebar p-10 lg:flex"
        style={{
          backgroundImage: "url('background-it-helpdesk.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right bottom",
          backgroundSize: "100% auto",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            HD
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">
              Help Desk AI
            </p>
            <p className="text-xs text-sidebar-muted">Dukungan TI Internal</p>
          </div>
        </div>

        <div className="max-w-sm space-y-4">
          <h2 className="text-xl font-semibold leading-snug text-sidebar-foreground">
            Satu tempat untuk semua permintaan dukungan TI.
          </h2>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Ajukan tiket, pantau progresnya, dan tanyakan solusi langsung ke
            asisten AI. Tim IT menerima tiket yang sudah terkategori dan
            diprioritaskan otomatis.
          </p>
          <ul className="space-y-2 pt-2 text-sm text-sidebar-muted">
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                <Check
                  className="size-3 text-primary-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              Klasifikasi kategori &amp; prioritas otomatis
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary mt-1">
                <Check
                  className="size-3 text-primary-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              Jawaban instan dari basis pengetahuan
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary mt-1">
                <Check
                  className="size-3 text-primary-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              SLA dipantau otomatis oleh sistem
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-muted">
          Butuh bantuan? Hubungi tim IT internal.
        </p>
      </div>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              HD
            </span>
            <p className="text-sm font-semibold">Help Desk AI</p>
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">
              Kembali ke beranda
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
