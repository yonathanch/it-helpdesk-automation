'use client';

import * as React from 'react';
import {
  Ban,
  CheckCircle2,
  CircleUser,
  Plus,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormAlert, FieldError } from '@/components/ui/form-alert';
import {
  DataTable,
  type SortableColumn,
} from '@/components/ui/data-table';
import { DataTableToolbar, PaginationControls } from '@/components/ui/select';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  SkeletonRows,
} from '@/components/ui/states';
import { useAuth } from '@/components/providers/auth-provider';
import { toUserMessage } from '@/lib/api-error';
import * as usersService from '@/lib/services/users.service';
import { ROLE_LABEL } from '@/lib/labels';
import { ROLES } from '@/lib/types';
import type { AdminUser, Role, UserListQuery } from '@/lib/types';

const PAGE_SIZE = 20;

/** Akun bawaan seed yang tidak boleh dimatikan agar demo tetap bisa dipakai. */
const SEED_EMAILS = [
  'admin@helpdesk.local',
  'agent@helpdesk.local',
  'user@helpdesk.local',
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Badge role dengan warna berbeda per tingkat akses. */
function RoleBadge({ role }: { role: Role }) {
  const tone =
    role === 'ADMIN'
      ? 'border-primary/40 text-primary'
      : role === 'AGENT'
        ? 'border-border text-foreground'
        : 'border-border text-muted-foreground';
  return (
    <Badge variant="outline" className={tone}>
      {role === 'ADMIN' ? <ShieldCheck className="size-3" aria-hidden /> : null}
      {ROLE_LABEL[role]}
    </Badge>
  );
}

export function UserManagement() {
  const { user: currentUser } = useAuth();

  const [query, setQuery] = React.useState<UserListQuery>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = React.useState('');
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Form pembuatan pengguna
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'AGENT' as Role,
    department: '',
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Aksi per baris
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    React.useState<AdminUser | null>(null);

  // Debounce pencarian agar tidak memanggil API tiap ketikan.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) => ({
        ...current,
        page: 1,
        search: searchInput || undefined,
      }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersService.listUsers(query);
      setUsers(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<UserListQuery>) => {
    setQuery((current) => ({ ...current, page: 1, ...patch }));
  };

  const changeRole = async (target: AdminUser, role: Role) => {
    if (role === target.role) return;
    setBusyId(target.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await usersService.updateUser(target.id, { role });
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(`Role ${updated.name} diubah menjadi ${ROLE_LABEL[updated.role]}.`);
    } catch (err) {
      setError(toUserMessage(err));
      await load(); // kembalikan tampilan ke nilai server yang sebenarnya
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (target: AdminUser, isActive: boolean) => {
    setBusyId(target.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await usersService.updateUser(target.id, { isActive });
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(
        `${updated.name} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      );
    } catch (err) {
      setError(toUserMessage(err));
      await load();
    } finally {
      setBusyId(null);
      setDeactivateTarget(null);
    }
  };

  const submitForm = async () => {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = 'Nama minimal 2 karakter';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      errors.email = 'Format email tidak valid';
    }
    if (form.password.length < 8) {
      errors.password = 'Password minimal 8 karakter';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const created = await usersService.createUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        department: form.department,
      });
      setNotice(
        `Akun ${created.email} dibuat sebagai ${ROLE_LABEL[created.role]}.`,
      );
      setFormOpen(false);
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'AGENT',
        department: '',
      });
      await load();
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isSelf = (target: AdminUser) => target.id === currentUser?.id;
  const isSeed = (target: AdminUser) => SEED_EMAILS.includes(target.email);

  const columns: SortableColumn<AdminUser>[] = [
    {
      key: 'name',
      label: 'Nama',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {row.name}
            {isSelf(row) ? (
              <span className="text-xs text-muted-foreground">(Anda)</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      className: 'w-40',
      render: (row) => {
        // Role akun sendiri tidak bisa diubah dari sini — backend menolaknya,
        // jadi kontrolnya pun tidak ditampilkan.
        if (isSelf(row)) return <RoleBadge role={row.role} />;
        return (
          <Select
            value={row.role}
            disabled={busyId === row.id}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              void changeRole(row, event.target.value as Role)
            }
            aria-label={`Role untuk ${row.name}`}
            className="h-8"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      key: 'department',
      label: 'Departemen',
      className: 'w-36 text-muted-foreground',
      render: (row) => row.department ?? <span className="text-xs">—</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      className: 'w-28',
      render: (row) =>
        row.isActive ? (
          <Badge variant="outline" className="border-success/40 text-success">
            <CheckCircle2 className="size-3" aria-hidden />
            Aktif
          </Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            <Ban className="size-3" aria-hidden />
            Nonaktif
          </Badge>
        ),
    },
    {
      key: 'createdAt',
      label: 'Dibuat',
      sortable: true,
      className: 'w-28 text-xs text-muted-foreground',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'actions',
      label: 'Aksi',
      className: 'w-40 text-right',
      render: (row) => {
        if (isSelf(row)) {
          return (
            <span className="text-xs text-muted-foreground">
              Akun sendiri
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant={row.isActive ? 'ghost' : 'outline'}
            className={row.isActive ? 'text-destructive' : undefined}
            disabled={busyId === row.id}
            onClick={() =>
              row.isActive ? setDeactivateTarget(row) : void setActive(row, true)
            }
          >
            {row.isActive ? (
              <>
                <Ban aria-hidden />
                Nonaktifkan
              </>
            ) : (
              <>
                <CircleUser aria-hidden />
                Aktifkan
              </>
            )}
          </Button>
        );
      },
    },
  ];

  const hasFilters =
    Boolean(query.search) || Boolean(query.role) || Boolean(query.isActive);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <CircleUser className="size-4" aria-hidden />
              Manajemen pengguna
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Akun Agen IT dan Administrator hanya bisa dibuat di sini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus aria-hidden />
              Tambah pengguna
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Muat ulang daftar pengguna"
              title="Muat ulang"
            >
              <RotateCw className={loading ? 'animate-spin' : undefined} aria-hidden />
            </Button>
          </div>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="min-h-4 px-4 text-xs text-muted-foreground"
        >
          {notice ?? ''}
        </p>

        <div className="px-4">
          <FormAlert message={error} />
        </div>

        {formOpen ? (
          <div className="mx-4 mb-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Pengguna baru</h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup formulir"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <FormAlert message={formError} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-name" required>
                  Nama
                </Label>
                <Input
                  id="new-name"
                  value={form.name}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'new-name-error' : undefined}
                />
                <FieldError id="new-name-error" message={formErrors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-email" required>
                  Email
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  value={form.email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={
                    formErrors.email ? 'new-email-error' : undefined
                  }
                />
                <FieldError id="new-email-error" message={formErrors.email} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" required>
                  Password awal
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={form.password}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(formErrors.password)}
                  aria-describedby={
                    formErrors.password ? 'new-password-error' : undefined
                  }
                  placeholder="Minimal 8 karakter"
                />
                <FieldError
                  id="new-password-error"
                  message={formErrors.password}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-role" required>
                  Role
                </Label>
                <Select
                  id="new-role"
                  value={form.role}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as Role,
                    }))
                  }
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-department">Departemen (opsional)</Label>
                <Input
                  id="new-department"
                  value={form.department}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={() => void submitForm()} loading={saving}>
                Simpan pengguna
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <p className="text-xs text-muted-foreground sm:ml-auto">
                Beri tahu password awal ke pengguna; ia bisa menggantinya nanti.
              </p>
            </div>
          </div>
        ) : null}

        <DataTableToolbar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Cari nama, email, atau departemen…"
        >
          <Select
            value={query.role ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              update({ role: (event.target.value || undefined) as Role | undefined })
            }
            aria-label="Filter role"
            className="w-40"
          >
            <option value="">Semua role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>

          <Select
            value={query.isActive ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              update({
                isActive: (event.target.value || undefined) as
                  | 'true'
                  | 'false'
                  | undefined,
              })
            }
            aria-label="Filter status"
            className="w-36"
          >
            <option value="">Semua status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>

          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setQuery({ page: 1, limit: PAGE_SIZE });
              }}
            >
              Reset
            </Button>
          ) : null}
        </DataTableToolbar>

        {error && users.length === 0 ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading && users.length === 0 ? (
          <SkeletonRows rows={6} columns={5} />
        ) : (
          <DataTable
            columns={columns}
            rows={users}
            rowKey={(row) => row.id}
            loading={loading}
            emptyState={
              hasFilters ? (
                <NoResultsState
                  query={query.search}
                  onReset={() => {
                    setSearchInput('');
                    setQuery({ page: 1, limit: PAGE_SIZE });
                  }}
                />
              ) : (
                <EmptyState
                  title="Belum ada pengguna"
                  description="Tambahkan agen atau administrator untuk mulai bekerja."
                />
              )
            }
          />
        )}

        {!error && users.length > 0 ? (
          <PaginationControls
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            disabled={loading}
            onPageChange={(page: number) =>
              setQuery((current) => ({ ...current, page }))
            }
          />
        ) : null}

        <p className="px-4 pb-4 pt-2 text-xs text-muted-foreground">
          Akun tidak bisa dihapus, hanya dinonaktifkan — supaya riwayat tiket
          lama tetap utuh. Admin aktif terakhir tidak bisa diturunkan.
        </p>
      </CardContent>

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Nonaktifkan akun?"
        description={
          <>
            <strong>{deactivateTarget?.name}</strong> tidak akan bisa masuk lagi.
            Tiket dan riwayatnya tetap tersimpan, dan akun bisa diaktifkan kembali
            kapan saja.
            {deactivateTarget && isSeed(deactivateTarget) ? (
              <span className="mt-2 block text-warning">
                Perhatian: ini akun bawaan data contoh.
              </span>
            ) : null}
          </>
        }
        confirmLabel="Nonaktifkan"
        variant="destructive"
        loading={busyId === deactivateTarget?.id}
        onConfirm={() =>
          deactivateTarget ? void setActive(deactivateTarget, false) : undefined
        }
        onClose={() => setDeactivateTarget(null)}
      />
    </Card>
  );
}
