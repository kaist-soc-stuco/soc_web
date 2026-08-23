import type { ArticleEngagementKind } from '@soc/contracts';
import { Bookmark, Heart, Loader2 } from 'lucide-react';
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
          onClick={() => onToggle('LIKE', !viewerHasLiked)}
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
        onClick={() => onToggle('SCRAP', !viewerHasScrapped)}
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
}) {
  const resolvedShowLoadingIndicator = showLoadingIndicator ?? true;
  const activeClass =
    tone === 'like'
      ? 'border-slate-200 text-rose-600 hover:border-slate-200 hover:text-rose-600'
      : 'text-amber-400 hover:text-amber-400';
  const inactiveClass =
    tone === 'like'
      ? 'border-slate-200 text-slate-400 hover:border-slate-200 hover:text-slate-400'
      : 'text-slate-400 hover:text-slate-400';
  const borderClass = tone === 'like' ? 'border' : 'border-0';

  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={loading}
      onClick={onClick}
      className={`interaction-action inline-flex items-center justify-center gap-1 ${borderClass} bg-transparent font-bold transition-colors disabled:cursor-wait disabled:opacity-60 hover:bg-slate-100 ${className} ${
        active ? activeClass : inactiveClass
      }`}
    >
      {loading && resolvedShowLoadingIndicator ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {count !== null ? <span className="tabular-nums">{count}</span> : null}
    </Button>
  );
}
