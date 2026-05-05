import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { nowMs } from '@soc/shared';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = nowMs();
    return next.handle().pipe(
      tap(() => {
        const duration = nowMs() - start;
        // eslint-disable-next-line no-console
        console.log(`Request handled in ${duration}ms`);
      }),
    );
  }
}
