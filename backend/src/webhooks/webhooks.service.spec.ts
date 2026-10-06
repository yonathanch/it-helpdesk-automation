import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';

/**
 * Mock antrean BullMQ supaya test tidak menyentuh Redis sungguhan.
 */
const queueAdd = jest.fn<Promise<{ id: string }>, unknown[]>();
const queueClose = jest.fn<Promise<void>, []>();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    // PENTING: return promise-nya apa adanya. Kalau errornya dibuang (void),
    // rejection akan jadi unhandled dan menjatuhkan jest worker.
    add: (
      name: string,
      payload: unknown,
      opts: unknown,
    ): Promise<{ id: string }> => queueAdd(name, payload, opts),
    close: (): Promise<void> => queueClose(),
  })),
}));

const makeConfig = (env: Record<string, string>) =>
  ({
    get: jest.fn((key: string) => env[key]),
  }) as unknown as ConfigService;

const ticket = {
  code: 'HD-0001',
  title: 'Printer tidak terdeteksi',
  priority: 'HIGH',
  status: 'OPEN',
} as never;

describe('M4-2: WebhooksService', () => {
  beforeEach(() => {
    queueAdd.mockClear();
    queueClose.mockClear();
    queueAdd.mockResolvedValue({ id: 'job-1' });
  });

  it('tidak mengantrekan apa pun saat tidak ada webhook yang dikonfigurasi', async () => {
    const service = new WebhooksService(makeConfig({}));
    expect(service.enabled).toBe(false);

    await service.ticketCreated(ticket);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('memasukkan job ke antrean saat Slack URL diset', async () => {
    const service = new WebhooksService(
      makeConfig({ WEBHOOK_SLACK_URL: 'https://hooks.slack.com/xxx' }),
    );
    expect(service.enabled).toBe(true);

    await service.ticketCreated(ticket);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = queueAdd.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(name).toBe('ticket_created');
    expect(payload.ticketCode).toBe('HD-0001');
    expect(String(payload.text)).toContain('HD-0001');
    // Retry dengan backoff exponential
    expect(opts.attempts).toBe(3);
  });

  it('menyertakan nama agen pada event ticket_assigned', async () => {
    const service = new WebhooksService(
      makeConfig({ WEBHOOK_TEAMS_URL: 'https://outlook.office.com/xxx' }),
    );

    await service.ticketAssigned(ticket, 'Budi');

    const payload = queueAdd.mock.calls[0][1] as Record<string, string>;
    expect(payload.text).toContain('Budi');
  });

  it('tidak melempar error meski antrean gagal (gagalnya tidak boleh mengganggu bisnis)', async () => {
    queueAdd.mockRejectedValueOnce(new Error('redis down'));
    const service = new WebhooksService(
      makeConfig({ WEBHOOK_SLACK_URL: 'https://hooks.slack.com/xxx' }),
    );

    await expect(service.ticketCreated(ticket)).resolves.toBeUndefined();
  });

  it('slaBreached memuat batas SLA pada pesan', async () => {
    const service = new WebhooksService(
      makeConfig({ WEBHOOK_SLACK_URL: 'https://hooks.slack.com/xxx' }),
    );

    await service.slaBreached({
      code: 'HD-0009',
      title: 'Server lambat',
      priority: 'URGENT',
      slaDueAt: new Date('2026-10-01T00:00:00.000Z'),
    } as never);

    const payload = queueAdd.mock.calls[0][1] as Record<string, string>;
    expect(payload.text).toContain('2026-10-01T00:00:00.000Z');
  });
});
