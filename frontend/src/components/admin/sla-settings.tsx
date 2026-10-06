'use client';

import * as React from 'react';
import { Clock, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormAlert } from '@/components/ui/form-alert';
import { Spinner } from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import * as metaService from '@/lib/services/meta.service';
import { PRIORITY_LABEL } from '@/lib/labels';
import type { Sla, TicketPriority } from '@/lib/types';

/**
 * Pengaturan SLA per prioritas (ADMIN).
 *
 * Nilai di sini jadi sumber kebenaran `slaDueAt` di backend — mengubahnya
 * tidak mengubah tiket lama, hanya tiket yang dibuat setelahnya.
 */
export function SlaSettingsPanel() {
  const [slas, setSlas] = React.useState<Sla[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, { response: string; resolution: string; isActive: boolean }>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await metaService.listSlas();
      setSlas(data);
      setDrafts(
        Object.fromEntries(
          data.map((sla) => [
            sla.id,
            {
              response: String(sla.responseMinutes),
              resolution: String(sla.resolutionMinutes),
              isActive: sla.isActive,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = (id: string, patch: Partial<{ response: string; resolution: string; isActive: boolean }>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const save = async (sla: Sla) => {
    const draft = drafts[sla.id];
    if (!draft) return;

    const response = Number.parseInt(draft.response, 10);
    const resolution = Number.parseInt(draft.resolution, 10);

    if (!Number.isFinite(response) || response < 1) {
      setError('Waktu respons minimal 1 menit.');
      return;
    }
    if (!Number.isFinite(resolution) || resolution < response) {
      setError('Waktu penyelesaian harus lebih besar atau sama dengan waktu respons.');
      return;
    }

    setSavingId(sla.id);
    setError(null);
    try {
      const updated = await metaService.updateSla(sla.id, {
        responseMinutes: response,
        resolutionMinutes: resolution,
        isActive: draft.isActive,
      });
      setSlas((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4" aria-hidden />
            Target SLA
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Berlaku untuk tiket baru. Tiket yang sudah punya batas waktu tidak
            ikut berubah.
          </p>
        </div>

        <FormAlert message={error} />

        {loading ? (
          <Spinner label="Memuat pengaturan SLA…" />
        ) : slas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada aturan SLA. Jalankan seed database untuk menambahkannya.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-2 py-2 font-medium">Prioritas</th>
                  <th scope="col" className="px-2 py-2 font-medium">Respons (menit)</th>
                  <th scope="col" className="px-2 py-2 font-medium">Penyelesaian (menit)</th>
                  <th scope="col" className="px-2 py-2 font-medium">Aktif</th>
                  <th scope="col" className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {slas.map((sla) => {
                  const draft = drafts[sla.id];
                  if (!draft) return null;
                  const dirty =
                    Number.parseInt(draft.response, 10) !== sla.responseMinutes ||
                    Number.parseInt(draft.resolution, 10) !== sla.resolutionMinutes ||
                    draft.isActive !== sla.isActive;

                  return (
                    <tr key={sla.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          {PRIORITY_LABEL[sla.priority as TicketPriority]}
                          {!sla.isActive ? (
                            <Badge variant="outline">nonaktif</Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Label htmlFor={`sla-response-${sla.id}`} className="sr-only">
                          Waktu respons {PRIORITY_LABEL[sla.priority as TicketPriority]}
                        </Label>
                        <Input
                          id={`sla-response-${sla.id}`}
                          type="number"
                          min={1}
                          value={draft.response}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            update(sla.id, { response: event.target.value })
                          }
                          className="w-28"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Label htmlFor={`sla-resolution-${sla.id}`} className="sr-only">
                          Waktu penyelesaian {PRIORITY_LABEL[sla.priority as TicketPriority]}
                        </Label>
                        <Input
                          id={`sla-resolution-${sla.id}`}
                          type="number"
                          min={1}
                          value={draft.resolution}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            update(sla.id, { resolution: event.target.value })
                          }
                          className="w-28"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            update(sla.id, { isActive: event.target.checked })
                          }
                          aria-label={`SLA ${PRIORITY_LABEL[sla.priority as TicketPriority]} aktif`}
                          className="size-4 rounded border-input"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="sm"
                          variant={dirty ? 'default' : 'outline'}
                          disabled={!dirty}
                          loading={savingId === sla.id}
                          onClick={() => void save(sla)}
                        >
                          {savingId !== sla.id ? <Save aria-hidden /> : null}
                          Simpan
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}