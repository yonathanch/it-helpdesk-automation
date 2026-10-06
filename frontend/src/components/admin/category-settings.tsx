'use client';

import * as React from 'react';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormAlert } from '@/components/ui/form-alert';
import { Spinner } from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import * as categoriesService from '@/lib/services/categories.service';
import type { Category } from '@/lib/types';

/**
 * Manajemen kategori (ADMIN).
 *
 * Backend menolak menghapus kategori yang masih dipakai tiket, jadi pesan
 * error dari server ditampilkan apa adanya tanpa ditafsirkan ulang.
 */
export function CategorySettingsPanel() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await categoriesService.listCategories());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditingId('new');
    setName('');
    setDescription('');
    setError(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description ?? '');
    setError(null);
  };

  const cancel = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const save = async () => {
    if (name.trim().length < 3) {
      setError('Nama kategori minimal 3 karakter.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        await categoriesService.createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        setNotice(`Kategori "${name.trim()}" ditambahkan.`);
      } else if (editingId) {
        await categoriesService.updateCategory(editingId, {
          name: name.trim(),
          description: description.trim(),
        });
        setNotice(`Kategori "${name.trim()}" diperbarui.`);
      }
      cancel();
      await load();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await categoriesService.deleteCategory(deleteTarget.id);
      setNotice(`Kategori "${deleteTarget.name}" dihapus.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(toUserMessage(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <FolderTree className="size-4" aria-hidden />
              Kategori tiket
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Kategori memengaruhi klasifikasi AI dan grup notifikasi.
            </p>
          </div>
          <Button size="sm" onClick={startCreate} disabled={editingId !== null}>
            <Plus aria-hidden />
            Tambah kategori
          </Button>
        </div>

        <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
          {notice ?? ''}
        </p>

        <FormAlert message={error} />

        {editingId !== null ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name" required>
                Nama
              </Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value)
                }
                placeholder="Contoh: Jaringan & VPN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Deskripsi</Label>
              <Textarea
                id="cat-desc"
                rows={2}
                value={description}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(event.target.value)
                }
                placeholder="Ringkasan singkat untuk membantu pengguna memilih kategori yang tepat"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void save()} loading={saving}>
                Simpan
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <Spinner label="Memuat kategori…" />
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada kategori. Tambahkan agar pengguna bisa memilih jenis
            masalah dengan tepat.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{category.name}</p>
                  {category.description ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {category._count?.tickets ?? 0} tiket
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(category)}
                  aria-label={`Ubah kategori ${category.name}`}
                >
                  <Pencil aria-hidden />
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(category)}
                  aria-label={`Hapus kategori ${category.name}`}
                >
                  <Trash2 aria-hidden />
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}

        <ConfirmDialog
          open={deleteTarget !== null}
          title="Hapus kategori?"
          description={
            <>
              Kategori &ldquo;{deleteTarget?.name}&rdquo; akan dihapus. Bila
              kategori masih dipakai tiket, backend akan menolak dan kategori
              tetap ada.
            </>
          }
          confirmLabel="Hapus"
          variant="destructive"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      </CardContent>
    </Card>
  );
}