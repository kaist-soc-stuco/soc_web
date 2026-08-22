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
}

export function ArticleEngagementActions({
  allowLike = true,
  compact = false,
  lang,
  likeCount,
  onToggle,
  scrapCount,
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
          icon={<Heart className="h-3.5 w-3.5" fill={viewerHasLiked ? 'currentColor' : 'none'} />}
          label={lang === 'ko' ? '좋아요' : 'Like'}
          loading={submitting === 'LIKE'}
          onClick={() => onToggle('LIKE', !viewerHasLiked)}
          className={buttonClass}
          tone="like"
        />
      ) : null}
      <EngagementButton
        active={viewerHasScrapped}
        count={scrapCount}
        icon={<Bookmark className="h-3.5 w-3.5" fill={viewerHasScrapped ? 'currentColor' : 'none'} />}
        label={lang === 'ko' ? '스크랩' : 'Scrap'}
        loading={submitting === 'SCRAP'}
        onClick={() => onToggle('SCRAP', !viewerHasScrapped)}
        className={buttonClass}
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
  tone,
}: {
  active: boolean;
  className: string;
  count: number;
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  tone: 'like' | 'scrap';
}) {
  const activeClass =
    tone === 'like'
      ? 'border-rose-200 bg-rose-50 text-rose-600'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <Button variant="ghost"
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={loading}
      onClick={onClick}
      className={`interaction-action inline-flex items-center gap-1 border font-bold transition disabled:cursor-wait disabled:opacity-60 ${className} ${
        active ? activeClass : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span className="tabular-nums">{count}</span>
    </Button>
  );
}
