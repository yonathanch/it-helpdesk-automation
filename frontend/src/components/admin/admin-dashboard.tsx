'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  RefreshCw,
  Smile,
  Timer,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  SkeletonBlock,
} from '@/components/ui/states';
import { DataTable } from '@/components/ui/data-table';
import { FormAlert } from '@/components/ui/form-alert';
import { toUserMessage } from '@/lib/api-error';
import * as reportingService from '@/lib/services/reporting.service';
import type { CategoryReport, ExportKind, OverviewReport, SlaRiskTicket, TrendPoint } from '@/lib/services/reporting.service';
import { SlaRiskPanel } from '@/components/admin/sla-risk-panel';
import { SlaSettingsPanel } from '@/components/admin/sla-settings';
import { CategorySettingsPanel } from '@/components/admin/category-settings';
import { CsatPanel } from '@/components/admin/csat-panel';
import { UserManagement } from '@/components/admin/user-management';

type AdminTab = 'overview' | 'users' | 'sla' | 'csat' | 'reports';

const TAB_CONFIG: Record<AdminTab, { label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview: { label: 'Dashboard', hint: 'Statistik & tren tiket', icon: BarChart3 },
  users: { label: 'Pengguna', hint: 'Kelola akun agen & admin', icon: Users },
  sla: { label: 'SLA & Kategori', hint: 'Target waktu & kategori tiket', icon: Clock },
  csat: { label: 'Kepuasan', hint: 'Survei CSAT pengguna', icon: Smile },
  reports: { label: 'Laporan', hint: 'Unduh laporan CSV', icon: Download },
};

const RANGE_PRESETS = [
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
  { label: '90 hari', days: 90 },
] as const;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatHours(value: number | null): string {
  if (value === null) return '—';
  if (value < 1) return `${Math.round(value * 60)} menit`;
  if (value < 48) return `${value.toFixed(1)} jam`;
  return `${(value / 24).toFixed(1)} hari`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function StatCard({ label, value, hint, tone = 'default', icon }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'good' | 'warn' | 'bad'; icon?: React.ReactNode; }) {
  const toneClass = { default: 'text-foreground', good: 'text-success', warn: 'text-warning', bad: 'text-destructive' }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <EmptyState className="py-8" title="Belum ada data tren" description="Pilih rentang tanggal lain." />;
  }
  const max = Math.max(1, ...points.map((p) => Math.max(p.created, p.resolved)));
  const width = 640, height = 160, padding = 8;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const toY = (v: number) => height - padding - (v / max) * (height - padding * 2);
  const createdPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padding + i * stepX} ${toY(p.created)}`).join(' ');
  const resolvedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padding + i * stepX} ${toY(p.resolved)}`).join(' ');
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" strokeWidth={1} />
        <path d={createdPath} fill="none" stroke="var(--status-open)" strokeWidth={2} />
        <path d={resolvedPath} fill="none" stroke="var(--status-resolved)" strokeWidth={2} />
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ backgroundColor: 'var(--status-open)' }}/>Tiket masuk</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ backgroundColor: 'var(--status-resolved)' }}/>Tiket selesai</span>
        </span>
        <span className="tabular-nums">{points[0]?.date} — {points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function AdminSidebar({ activeTab, onTabChange }: { activeTab: AdminTab, onTabChange: (t: AdminTab) => void }) {
  return (
    <nav className="shrink-0 border-b border-border bg-card lg:w-56 lg:border-b-0 lg:border-r">
      <div className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3">
        <p className="hidden px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">Menu Admin</p>
        {(Object.keys(TAB_CONFIG) as AdminTab[]).map((tab) => {
          const config = TAB_CONFIG[tab];
          const Icon = config.icon;
          const isActive = activeTab === tab;
          return (
            <button key={tab} onClick={() => onTabChange(tab)} aria-current={isActive ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              title={config.hint}>
              <Icon className="size-4" aria-hidden />
              <span className="whitespace-nowrap">{config.label}</span>
              {isActive ? <ChevronRight className="ml-auto hidden size-4 lg:block" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = React.useState<AdminTab>('overview');
  const [days, setDays] = React.useState<number>(30);
  const [from, setFrom] = React.useState(() => isoDaysAgo(30));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [overview, setOverview] = React.useState<OverviewReport | null>(null);
  const [trend, setTrend] = React.useState<TrendPoint[]>([]);
  const [categories, setCategories] = React.useState<CategoryReport[]>([]);
  const [slaRisk, setSlaRisk] = React.useState<SlaRiskTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, trendData, categoryData, riskData] = await Promise.all([
        reportingService.getOverview({ from, to }),
        reportingService.getTrend({ from, to }),
        reportingService.getCategoryReport({ from, to }),
        reportingService.getSlaAtRisk(),
      ]);
      setOverview(overviewData);
      setTrend(trendData);
      setCategories(categoryData);
      setSlaRisk(riskData);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => { void load(); }, [load]);
  const applyPreset = (presetDays: number) => { setDays(presetDays); setFrom(isoDaysAgo(presetDays)); setTo(new Date().toISOString().slice(0, 10)); };
  const download = async (kind: ExportKind) => { setDownloading(kind); setExportError(null); try { await reportingService.downloadCsv(kind, { from, to }); } catch (err) { setExportError(toUserMessage(err)); } finally { setDownloading(null); } };

  const categoryColumns = [
    { key: 'categoryName', label: 'Kategori', render: (row: CategoryReport) => <span className="font-medium">{row.categoryName}</span> },
    { key: 'total', label: 'Total', className: 'w-20 text-right tabular-nums', render: (row: CategoryReport) => row.total },
    { key: 'completed', label: 'Selesai', className: 'w-20 text-right tabular-nums', render: (row: CategoryReport) => row.completed },
    { key: 'avgResolutionHours', label: 'Rata-rata penyelesaian', className: 'w-44 text-right text-muted-foreground', render: (row: CategoryReport) => formatHours(row.avgResolutionHours) },
    { key: 'slaBreached', label: 'SLA terlampaui', className: 'w-32 text-right tabular-nums', render: (row: CategoryReport) => row.slaBreached > 0 ? <span className="text-destructive">{row.slaBreached}</span> : <span className="text-muted-foreground">0</span> },
  ];

  const compliance = overview?.sla.compliancePercent ?? null;
  const activeConfig = TAB_CONFIG[activeTab];

  const renderContent = () => {
    switch (activeTab) {
      case 'users': return <UserManagement />;
      case 'sla': return <><SlaSettingsPanel /><CategorySettingsPanel /></>;
      case 'csat': return <CsatPanel />;
      case 'reports': return (
        <Card><CardContent className="space-y-4 p-4">
          <div><h2 className="flex items-center gap-1.5 text-sm font-semibold"><Download className="size-4" aria-hidden />Unduh laporan</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Berkas CSV aman dibuka di Excel.</p></div>
          <FormAlert message={exportError} />
          <div className="grid gap-2 sm:grid-cols-2">
            {[['tickets','Daftar tiket'],['overview','Ringkasan metrik'],['sla-at-risk','Tiket berisiko SLA'],['csat','Hasil survei CSAT']].map(([kind, label]) => (
              <Button key={kind} size="sm" variant="outline" onClick={() => void download(kind as ExportKind)} loading={downloading === kind} disabled={downloading !== null && downloading !== kind} className="justify-start">
                {downloading !== kind ? <Download aria-hidden /> : null}{label}
              </Button>
            ))}
          </div>
        </CardContent></Card>
      );
      default:
        return (
          <div className="space-y-4">
            <Card><CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-end">
              <div className="flex flex-wrap gap-1.5">{RANGE_PRESETS.map((p) => <Button key={p.days} size="sm" variant={days===p.days?'secondary':'outline'} onClick={() => applyPreset(p.days)}>{p.label}</Button>)}</div>
              <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
                <div className="space-y-1"><Label htmlFor="range-from">Dari</Label><Input id="range-from" type="date" value={from} max={to} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{setDays(0);setFrom(e.target.value)}} className="w-40"/></div>
                <div className="space-y-1"><Label htmlFor="range-to">Sampai</Label><Input id="range-to" type="date" value={to} min={from} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{setDays(0);setTo(e.target.value)}} className="w-40"/></div>
              </div>
            </CardContent></Card>
            {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {loading && !overview ? Array.from({length:8}).map((_,i)=>(<SkeletonBlock key={i} className="h-24"/>)) : overview ? (
                <><StatCard label="Total tiket" value={String(overview.totals.all)} hint={`${overview.totals.open} baru`} icon={<Gauge className="size-3.5"/>} />
                  <StatCard label="Tiket selesai" value={String(overview.completed)} hint={`${overview.totals.waitingUser} menunggu`} icon={<CheckCircle2 className="size-3.5"/>} />
                  <StatCard label="Rata-rata penyelesaian" value={formatHours(overview.resolution.mttrHours)} hint={`Respons ${formatHours(overview.resolution.mtfaHours)}`} icon={<Timer className="size-3.5"/>} />
                  <StatCard label="Kepatuhan SLA" value={formatPercent(compliance)} hint={`${overview.sla.breached} terlampaui`} tone={compliance===null?'default':compliance>=90?'good':compliance>=70?'warn':'bad'} icon={<AlertTriangle className="size-3.5"/>} />
                  <StatCard label="Belum ditugaskan" value={String(overview.totals.unassigned)} tone={overview.totals.unassigned>0?'warn':'default'} />
                  <StatCard label="Prioritas tinggi" value={String(overview.totals.highPriority)} tone={overview.totals.highPriority>0?'bad':'default'} />
                  <StatCard label="CSAT" value={overview.csat.average===null?'—':overview.csat.average.toFixed(2)} hint={`${overview.csat.totalResponses} responden`} tone={overview.csat.average===null?'default':overview.csat.average>=4?'good':overview.csat.average>=3?'warn':'bad'} icon={<Smile className="size-3.5"/>} />
                  <StatCard label="Pelanggaran SLA" value={`${overview.sla.breachRatePercent.toFixed(1)}%`} /></>
              ) : null}
            </section>
            <Card><CardContent className="space-y-3 p-4"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarRange className="size-4"/>Tren tiket</h2>
              <TrendChart points={trend} /></CardContent></Card>
            <Card><CardContent className="p-0"><div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><h2 className="text-sm font-semibold">Beban per kategori</h2></div>
              <DataTable columns={categoryColumns} rows={categories} rowKey={(r: CategoryReport)=>r.categoryId} emptyState={<NoResultsState onReset={()=>applyPreset(30)} />} /></CardContent></Card>
            <SlaRiskPanel tickets={slaRisk} loading={loading} />
          </div>
        );
    }
  };

  return (
    <>
      <PageHeader title="Administrasi" description={`${activeConfig.label} — ${activeConfig.hint}.`} actions={<Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={loading?'animate-spin':undefined}/></Button>} />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{renderContent()}</main>
      </div>
    </>
  );
}
