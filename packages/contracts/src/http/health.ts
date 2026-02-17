export interface HealthDependency {
  ok: boolean;
  latencyMs: number;
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  postgres: HealthDependency;
  redis: HealthDependency;
  timestamp: string;
}
