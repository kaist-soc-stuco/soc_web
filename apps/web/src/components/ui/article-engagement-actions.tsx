import type { ArticleEngagementKind } from '@soc/contracts';
import { Bookmark, Heart, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

interface ArticleEngagementActionsProps {
  lang: string;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
  submitting: ArticleEngagementKind | null;
  onToggle: (kind: ArticleEngagementKind, active: boolean) => void;
  compact?: boolean;
  allowLike?: boolean;
  scrapIconOnly?: boolean;
}

export function ArticleEngagementActions({
  allowLike = true,
  compact = false,
  lang,
  likeCount,
  onToggle,
  scrapCount,
  scrapIconOnly = false,
  submitting,
  viewerHasLiked,
  viewerHasScrapped,
}: ArticleEngagementActionsProps) {
  const [bouncingKind, setBouncingKind] = useState<ArticleEngagementKind | null>(null);

  const handleToggle = (kind: ArticleEngagementKind, active: boolean) => {
    setBouncingKind(null);
    window.requestAnimationFrame(() => setBouncingKind(kind));
    window.setTimeout(() => setBouncingKind(null), 150);
    onToggle(kind, active);
  };

  const buttonClass = compact
    ? 'min-h-8 rounded-md px-2 text-[11px]'
    : 'min-h-9 rounded-lg px-3 text-xs';

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {allowLike ? (
        <EngagementButton
          active={viewerHasLiked}
          count={likeCount}
          icon={
            <Heart
              className={`h-3.5 w-3.5 ${viewerHasLiked ? 'text-rose-600' : 'text-slate-400'}`}
              fill={viewerHasLiked ? 'currentColor' : 'none'}
            />
          }
          label={lang === 'ko' ? '좋아요' : 'Like'}
          loading={submitting === 'LIKE'}
          onClick={() => handleToggle('LIKE', !viewerHasLiked)}
          iconClassName={bouncingKind === 'LIKE' ? 'engagement-icon-bounce' : undefined}
          className={buttonClass}
          tone="like"
        />
      ) : null}
      <EngagementButton
        active={viewerHasScrapped}
        count={scrapIconOnly ? null : scrapCount}
        icon={<Bookmark className="h-3.5 w-3.5" fill={viewerHasScrapped ? 'currentColor' : 'none'} />}
        label={lang === 'ko' ? '스크랩' : 'Scrap'}
        loading={submitting === 'SCRAP'}
        showLoadingIndicator={!scrapIconOnly}
        onClick={() => handleToggle('SCRAP', !viewerHasScrapped)}
        iconClassName={bouncingKind === 'SCRAP' ? 'engagement-icon-bounce' : undefined}
        className={scrapIconOnly ? 'size-8 rounded-md p-0' : buttonClass}
        tone="scrap"
      />
    </div>
  );
}

function EngagementButton({
  active,
  className,
  count,
  icon,
  label,
  loading,
  onClick,
  showLoadingIndicator,
  tone,
  iconClassName,
}: {
  active: boolean;
  className: string;
  count: number | null;
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  showLoadingIndicator?: boolean;
  tone: 'like' | 'scrap';
  iconClassName?: string;
}) {
  const resolvedShowLoadingIndicator = showLoadingIndicator ?? true;
  const activeClass =
    tone === 'like'
      ? 'text-rose-600 hover:text-rose-600'
      : 'text-amber-400 hover:text-amber-400';
  const inactiveClass =
    tone === 'like'
      ? 'text-slate-400 hover:text-slate-400'
      : 'text-slate-400 hover:text-slate-400';

  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={loading}
      onClick={onClick}
      className={`interaction-action inline-flex items-center justify-center gap-1 border-0 bg-transparent font-bold transition-colors disabled:cursor-wait disabled:opacity-60 hover:bg-slate-100 ${className} ${
        active ? activeClass : inactiveClass
      }`}
    >
      {loading && resolvedShowLoadingIndicator ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : iconClassName ? <span className={iconClassName}>{icon}</span> : icon}
      {count !== null ? <span className="tabular-nums">{count}</span> : null}
    </Button>
  );
}
