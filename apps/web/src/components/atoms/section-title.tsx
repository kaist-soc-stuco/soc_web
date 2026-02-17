import { cn } from '@/lib/utils';

interface SectionTitleProps {
  title: string;
  description?: string;
  className?: string;
}

export function SectionTitle({ title, description, className }: SectionTitleProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}
