import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export const CONTAINER_STARTUP_TIMEOUT_MS = 60_000;
export const CONTAINER_STOP_TIMEOUT_MS = 30_000;

export interface TestInfrastructure {
  databaseUrl: string;
  redisUrl: string;
  stop(): Promise<void>;
}

export async function startTestInfrastructure(): Promise<TestInfrastructure> {
  let postgres: StartedPostgreSqlContainer | undefined;
  let redis: StartedTestContainer | undefined;

  try {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('soc_test')
      .withUsername('soc')
      .withPassword('soc')
      .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
      .start();

    redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
      .start();

    const startedPostgres = postgres;
    const startedRedis = redis;

    return {
      databaseUrl: startedPostgres.getConnectionUri(),
      redisUrl: `redis://${startedRedis.getHost()}:${startedRedis.getMappedPort(6379)}`,
      stop: async (): Promise<void> => {
        const stopped = await Promise.allSettled([
          startedRedis.stop({ timeout: CONTAINER_STOP_TIMEOUT_MS }),
          startedPostgres.stop({ timeout: CONTAINER_STOP_TIMEOUT_MS }),
        ]);
        const failures = stopped.filter(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );

        if (failures.length > 0) {
          throw new AggregateError(
            failures.map((failure) => failure.reason),
            'Failed to stop test containers',
          );
        }
      },
    };
  } catch (error) {
    const stopped = await Promise.allSettled([
      redis?.stop({ timeout: CONTAINER_STOP_TIMEOUT_MS }),
      postgres?.stop({ timeout: CONTAINER_STOP_TIMEOUT_MS }),
    ]);
    const cleanupFailures = stopped.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        [error, ...cleanupFailures.map((failure) => failure.reason)],
        'Test infrastructure startup failed and cleanup was incomplete',
      );
    }

    throw new Error('Test infrastructure startup failed', { cause: error });
  }
}
