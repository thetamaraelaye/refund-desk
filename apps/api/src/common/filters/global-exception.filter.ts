import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

const ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

interface ErrorDescription {
  status: number;
  message: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { status, message, details } = this.describe(exception);

    if (status >= 500) {
      const trace = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.originalUrl} -> ${status}`, trace);
    } else {
      this.logger.warn(`${request.method} ${request.originalUrl} -> ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      status,
      message,
      code: ERROR_CODES[status] ?? 'ERROR',
      ...(details !== undefined && { details }),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private describe(exception: unknown): ErrorDescription {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') return { status, message: body };

      const { message, error } = body as { message?: string | string[]; error?: string };
      // class-validator reports every failed field; keep them as details, not the headline.
      if (Array.isArray(message)) {
        return { status, message: 'Request validation failed', details: message };
      }
      return { status, message: message ?? error ?? exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, message: 'Record already exists' };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      }
    }

    const showDetail = process.env.NODE_ENV !== 'production' && exception instanceof Error;
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: showDetail ? exception.message : 'Internal server error',
    };
  }
}
