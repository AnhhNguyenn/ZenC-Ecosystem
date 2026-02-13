import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global Exception Filter – Catches ALL unhandled exceptions and returns
 * a standardized JSON error response.
 *
 * Why a global filter:
 * - Guarantees consistent error shape for the mobile client, preventing
 *   accidental exposure of stack traces or internal error details.
 * - Centralizes error logging for the observability stack (Loki/Grafana).
 * - Differentiates known HttpExceptions (with proper status codes) from
 *   unexpected errors (which always return 500).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj['message'] as string) || message;
        errorCode = (responseObj['error'] as string) || errorCode;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    /** Structured error log for metrics/alerting pipelines */
    this.logger.warn(
      JSON.stringify({
        statusCode: status,
        path: request?.url,
        method: request?.method,
        errorCode,
        message,
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
