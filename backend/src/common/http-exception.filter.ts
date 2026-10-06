import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Standardized error response format.
 *
 * Semua error yang keluar dari API mengikuti format konsisten:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   path: string,
 *   timestamp: string,
 * }
 *
 * Contoh:
 * - 400: { statusCode: 400, message: "Email tidak valid", error: "Bad Request", ... }
 * - 401: { statusCode: 401, message: "Token tidak valid", error: "Unauthorized", ... }
 * - 404: { statusCode: 404, message: "Tiket tidak ditemukan", error: "Not Found", ... }
 */
export interface StandardErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Terjadi kesalahan internal server';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // HttpException bisa return string atau object { message, error, statusCode }
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;
        message =
          (res.message as string | string[]) ??
          (res.error as string) ??
          exception.message;
        error = (res.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      // Non-HTTP error (bug, DB error, dll) — log detail, tapi jangan expose ke client
      this.logger.error(
        `[${request.method} ${request.url}] ${exception.message}`,
        exception.stack,
      );
      message =
        process.env.NODE_ENV === 'production'
          ? 'Terjadi kesalahan internal server'
          : exception.message;
    } else {
      this.logger.error(
        `[${request.method} ${request.url}] Unknown error`,
        String(exception),
      );
    }

    const body: StandardErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
