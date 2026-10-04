/**
 * Error API yang sudah dinormalisasi.
 * Pesan diambil dari body NestJS (field `message`) supaya UI menampilkan
 * pesan yang sama dengan yang dikirim backend.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Field yang gagal divalidasi, jika backend mengirim array pesan class-validator */
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** 401 = token hilang/kedaluwarsa, 403 = role tidak berhak */
  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isValidation() {
    return this.status === 400 || this.status === 422;
  }
}

/**
 * Ubah Response error dari NestJS menjadi ApiError.
 * NestJS mengirim: { statusCode, message: string | string[], error }.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let message = `Permintaan gagal (${response.status})`;
  let details: string[] = [];

  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const raw = record.message;
      if (typeof raw === 'string' && raw.length > 0) {
        message = raw;
      } else if (Array.isArray(raw) && raw.length > 0) {
        details = raw.filter((m): m is string => typeof m === 'string');
        message = details[0] ?? message;
      } else if (typeof record.error === 'string' && record.error) {
        message = record.error;
      }
    }
  } catch {
    // Body bukan JSON (mis. proxy error) — pakai pesan default.
  }

  return new ApiError(response.status, message, details);
}

/** Pesan yang aman ditampilkan ke pengguna untuk error tak terduga. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan yang tidak terduga';
}
