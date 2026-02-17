import { SectionTitle } from '@/components/atoms/section-title';
import { StatusChip } from '@/components/atoms/status-chip';
import { MetricRow } from '@/components/molecules/metric-row';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface DependencyStatus {
  name: string;
  ok: boolean;
  message?: string;
}

interface ApiStatusCardProps {
  title: string;
  checkedAt: string;
  dependencies: DependencyStatus[];
}

export function ApiStatusCard({ title, checkedAt, dependencies }: ApiStatusCardProps) {
  const allHealthy = dependencies.every((dependency) => dependency.ok);

  return (
    <Card className="border-border/80 bg-card/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <SectionTitle title={title} description={`Checked at: ${checkedAt}`} />
        <StatusChip tone={allHealthy ? 'healthy' : 'degraded'}>{allHealthy ? 'Healthy' : 'Issue'}</StatusChip>
      </CardHeader>
      <CardContent className="space-y-2">
        {dependencies.map((dependency) => (
          <MetricRow
            key={dependency.name}
            label={dependency.name}
            value={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusChip tone={dependency.ok ? 'healthy' : 'degraded'}>{dependency.ok ? 'OK' : 'Down'}</StatusChip>
                {dependency.message ? <span className="text-muted-foreground text-xs">{dependency.message}</span> : null}
              </div>
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
