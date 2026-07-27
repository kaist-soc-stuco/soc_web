export interface HealthDependency {
  ok: boolean;
  latencyMs: number;
}

export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessResponse extends LivenessResponse {
  postgres: HealthDependency;
  redis: HealthDependency;
}

export type HealthResponse = ReadinessResponse;
