import { createApiClient } from '@soc/api-client';
import type { GreetingResponse, HealthResponse } from '@soc/contracts';
import { APP_TITLE, formatKoreanDateTime } from '@soc/shared';
import { useMemo, useState } from 'react';

import { MetricRow } from '@/components/molecules/metric-row';
import { ApiStatusCard } from '@/components/organisms/api-status-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_0%,oklch(0.97_0.05_220),transparent_35%),radial-gradient(circle_at_100%_100%,oklch(0.93_0.05_200),transparent_45%)] px-4 py-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="border-border/80 bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{APP_TITLE}</CardTitle>
            <CardDescription>shadcn/ui + Atomic Component Design example (React + NestJS mock workspace)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow
              label="API Base URL"
              value={
                <code className="text-muted-foreground rounded bg-muted px-2 py-0.5 text-xs">{apiBaseUrl}</code>
              }
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchHealth} disabled={loadingHealth}>
                {loadingHealth ? 'Checking...' : 'Check Health'}
              </Button>
              <Button variant="secondary" onClick={fetchGreeting} disabled={loadingGreeting}>
                {loadingGreeting ? 'Loading...' : 'Get Greeting'}
              </Button>
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Error: {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {health ? (
          <ApiStatusCard
            title={`Health: ${health.status}`}
            checkedAt={formatKoreanDateTime(health.timestamp)}
            dependencies={[
              {
                name: 'Postgres',
                ok: health.postgres.ok,
                message: health.postgres.ok ? undefined : (health.postgres.message ?? 'connection failed'),
              },
              {
                name: 'Redis',
                ok: health.redis.ok,
                message: health.redis.ok ? undefined : (health.redis.message ?? 'connection failed'),
              },
            ]}
          />
        ) : null}

        {greeting ? (
          <Card className="border-border/80 bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Greeting</CardTitle>
              <CardDescription>Mock endpoint response rendered with reusable molecules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <MetricRow label="Message" value={greeting.message} />
              <MetricRow label="Visits (Redis)" value={greeting.visits.toLocaleString()} />
              <MetricRow label="DB Time" value={formatKoreanDateTime(greeting.dbTime)} />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
