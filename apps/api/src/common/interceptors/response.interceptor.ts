import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import { ApiMessage } from '../api-message';

export interface ApiEnvelope<T> {
  success: true;
  status: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body: unknown) => {
        // Files (CSV exports) stream as-is; everything else gets the envelope.
        if (body instanceof StreamableFile) return body;

        const status = response.statusCode;
        if (body instanceof ApiMessage) {
          return { success: true, status, message: body.message, data: body.data as unknown };
        }
        return { success: true, status, message: 'OK', data: body };
      }),
    );
  }
}
