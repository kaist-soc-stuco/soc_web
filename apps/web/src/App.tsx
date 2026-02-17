import { createApiClient } from '@soc/api-client';
import type { GreetingResponse, HealthResponse } from '@soc/contracts';
import { APP_TITLE, formatKoreanDateTime } from '@soc/shared';
import { useMemo, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function App() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: apiBaseUrl }), []);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [greeting, setGreeting] = useState<GreetingResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingGreeting, setLoadingGreeting] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setError('');

    try {
      const data = await apiClient.getHealth();
      setHealth(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'health 요청 실패');
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchGreeting = async () => {
    setLoadingGreeting(true);
    setError('');

    try {
      const data = await apiClient.getGreeting();
      setGreeting(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'greeting 요청 실패');
    } finally {
      setLoadingGreeting(false);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1>{APP_TITLE}</h1>
        <p className="description">Vanilla React + NestJS + Postgres/Redis mock workspace</p>
        <p className="base-url">API Base URL: {apiBaseUrl}</p>

        <div className="actions">
          <button onClick={fetchHealth} disabled={loadingHealth}>
            {loadingHealth ? 'Checking...' : 'Check Health'}
          </button>
          <button onClick={fetchGreeting} disabled={loadingGreeting}>
            {loadingGreeting ? 'Loading...' : 'Get Greeting'}
          </button>
        </div>

        {error && <p className="error">Error: {error}</p>}

        {health && (
          <div className="panel">
            <h2>Health</h2>
            <p>Status: {health.status}</p>
            <p>Postgres: {health.postgres.ok ? 'ok' : `down (${health.postgres.message ?? 'error'})`}</p>
            <p>Redis: {health.redis.ok ? 'ok' : `down (${health.redis.message ?? 'error'})`}</p>
            <p>Checked: {formatKoreanDateTime(health.timestamp)}</p>
          </div>
        )}

        {greeting && (
          <div className="panel">
            <h2>Greeting</h2>
            <p>{greeting.message}</p>
            <p>Visits (Redis): {greeting.visits}</p>
            <p>DB Time: {formatKoreanDateTime(greeting.dbTime)}</p>
          </div>
        )}
      </section>
    </main>
  );
}
