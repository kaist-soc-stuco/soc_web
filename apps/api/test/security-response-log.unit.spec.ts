import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { securityResponseLogMiddleware } from '../src/shared/middleware/security-response-log.middleware';

describe('securityResponseLogMiddleware', () => {
  it.each([
    [200, 'success'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [500, 'error'],
  ] as const)('emits one metadata-only aggregate event for status %s', (statusCode, outcome) => {
    const response = new EventEmitter() as EventEmitter & { statusCode: number; once: EventEmitter['once'] };
    response.statusCode = statusCode;
    const request = {
      path: '/api/admin/surveys/10000000-0000-4000-8000-000000000002/aggregate/v2',
      requestId: 'request-1',
      user: { id: '10000000-0000-4000-8000-000000000001' },
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const next = vi.fn();

    securityResponseLogMiddleware(request as never, response as never, next);
    response.emit('finish');
    response.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(String(log.mock.calls[0]![0]))).toEqual({
      actorId: request.user.id,
      surveyId: '10000000-0000-4000-8000-000000000002',
      routeVersion: 'V2',
      outcome,
      requestId: 'request-1',
    });
    expect(log.mock.calls[0]![0]).not.toContain('count');
    log.mockRestore();
  });

  it('does not let stdout failures affect the response path', () => {
    const response = new EventEmitter() as EventEmitter & { statusCode: number; once: EventEmitter['once'] };
    response.statusCode = 200;
    const log = vi.spyOn(console, 'log').mockImplementation(() => { throw new Error('collector unavailable'); });
    const next = vi.fn();

    securityResponseLogMiddleware({ path: '/api/admin/surveys/not-sensitive' } as never, response as never, next);

    expect(() => response.emit('finish')).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
