import type { ArticleEngagementKind } from '@soc/contracts';
import { Bookmark, Heart, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";

interface ArticleEngagementActionsProps {
  isAuthenticated: boolean;
  lang: string;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
  submitting: ArticleEngagementKind | null;
  onToggle: (kind: ArticleEngagementKind, active: boolean) => void;
  compact?: boolean;
  allowLike?: boolean;
  allowScrap?: boolean;
  scrapIconOnly?: boolean;
}

export function ArticleEngagementActions({
  allowLike = true,
  allowScrap = true,
  compact = false,
  isAuthenticated,
  lang,
  likeCount,
  onToggle,
  scrapCount,
  scrapIconOnly = false,
  submitting,
  viewerHasLiked,
  viewerHasScrapped,
}: ArticleEngagementActionsProps) {
  const likeActive = isAuthenticated && viewerHasLiked;
  const scrapActive = isAuthenticated && viewerHasScrapped;
  const buttonClass = compact
    ? 'min-h-8 rounded-md px-2 text-[length:var(--ui-text-caption-size)]'
    : 'min-h-9 rounded-lg px-3 text-xs';

  if (!allowLike && !allowScrap) return null;

  return (
    <div className="select-none flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {allowLike ? (
        <EngagementActionButton
          active={likeActive}
          count={likeCount}
          icon={
            <Heart
              className={`h-3.5 w-3.5 ${likeActive ? 'text-rose-600' : 'text-slate-400'}`}
              fill={likeActive ? 'currentColor' : 'none'}
            />
          }
          label={lang === 'ko' ? '좋아요' : 'Like'}
          loading={submitting === 'LIKE'}
          onClick={() => onToggle('LIKE', !likeActive)}
          className={buttonClass}
          tone="like"
        />
      ) : null}
      {allowScrap ? (
        <EngagementActionButton
          active={scrapActive}
          count={scrapIconOnly ? null : scrapCount}
          icon={
            <Bookmark
              className={`h-3.5 w-3.5 ${scrapActive ? 'text-amber-400' : 'text-slate-400'}`}
              fill={scrapActive ? 'currentColor' : 'none'}
            />
          }
          label={lang === 'ko' ? '스크랩' : 'Scrap'}
          loading={submitting === 'SCRAP'}
          showLoadingIndicator={!scrapIconOnly}
          onClick={() => onToggle('SCRAP', !scrapActive)}
          className={scrapIconOnly ? 'size-8 rounded-md p-0' : buttonClass}
          tone="scrap"
        />
      ) : null}
    </div>
  );
}

export function EngagementActionButton({
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
  const [isBouncing, setIsBouncing] = useState(false);
  const resolvedShowLoadingIndicator = showLoadingIndicator ?? true;
  const activeClass =
    tone === 'like'
      ? 'text-rose-600'
      : 'text-amber-400';
  const inactiveClass = 'text-slate-400';

  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={loading}
      onClick={() => {
        setIsBouncing(false);
        window.requestAnimationFrame(() => setIsBouncing(true));
        window.setTimeout(() => setIsBouncing(false), 220);
        onClick();
      }}
      className={`interaction-action inline-flex items-center justify-center gap-1 border-0 bg-transparent font-bold transition-[background-color,opacity] duration-200 ease-out disabled:cursor-wait disabled:opacity-60 hover:bg-slate-100 hover:text-current ${className} ${
        active ? activeClass : inactiveClass
      }`}
    >
      {loading && resolvedShowLoadingIndicator ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isBouncing ? (
        <span className="engagement-icon-bounce">{icon}</span>
      ) : (
        icon
      )}
      {count !== null ? <span className="tabular-nums text-black">{count}</span> : null}
    </Button>
  );
}
