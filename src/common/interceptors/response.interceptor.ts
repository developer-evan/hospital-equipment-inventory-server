import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationMeta } from '../dto/pagination-query.dto';

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SuccessResponse<T> {
  data: T;
  meta: PaginationMeta | Record<string, never>;
}

function isPaginatedResult<T>(value: unknown): value is PaginatedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value
  );
}

/**
 * Wraps every successful controller response in a consistent
 * `{ data, meta }` envelope. Services/controllers that need pagination
 * metadata return `{ items, meta }`, which this interceptor unwraps
 * into `{ data: items, meta }`; everything else becomes `{ data, meta: {} }`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedResult<T>(result)) {
          return { data: result.items as unknown as T, meta: result.meta };
        }
        return { data: result, meta: {} };
      }),
    );
  }
}
