import type { ArticleEngagementKind } from "@soc/contracts";
import { ArrowRight, Bookmark, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { stripRichText } from "@/components/ui/rich-text-content";
import { formatCompactDateTime, getCardPeriodText, getDiscoveryBadge, getDiscoveryDateTime, isClosedItem, type UnifiedItem } from "@/lib/events-surveys";
import { resolveAssetUrl } from "@/lib/asset-url";
import "./events-surveys-cards.css";

interface EventsSurveysGridProps {
  isAuthenticated: boolean;
  items: UnifiedItem[];
  lang: string;
  hideDate?: boolean;
  engagementSubmitting?: string | null;
  onEngagementToggle?: (item: UnifiedItem, kind: ArticleEngagementKind, active: boolean) => void;
}

const DEFAULT_IMAGE = "/discovery-placeholder.svg";

function CardImage({ imageUrl }: { imageUrl?: string | null }) {
  const source = imageUrl?.trim() ? resolveAssetUrl(imageUrl.trim()) : DEFAULT_IMAGE;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return <img className="discovery-card-image" src={failed ? DEFAULT_IMAGE : source} onError={() => setFailed(true)} alt="" aria-hidden="true" loading="lazy" />;
}

function audienceText(item: UnifiedItem, lang: string) {
  const ko = lang === "ko";
  if (item.kind === "EVENT" ? item.linkedSurveyFeePayersOnly : item.feePayersOnly) return ko ? "과비 납부자만" : "Fee-paying members";
  if (item.visibilityScope === "STAFF_ONLY") return ko ? "운영진 전용" : "Staff only";
  if (item.kind === "EVENT" ? item.visibilityScope === "MEMBERS" : !item.allowAnonymous) return ko ? "로그인 필요" : "Login required";
  if (item.isKoreanOnly) return ko ? "한국어 전용" : "Korean only";
  return "";
}

export function EventsSurveysGrid({ isAuthenticated, items, lang, hideDate = false, engagementSubmitting, onEngagementToggle }: EventsSurveysGridProps) {
  return <div className="events-surveys-card-grid discovery-grid">
    {items.map(item => {
      const event = item.kind === "EVENT";
      const title = stripRichText(lang === "ko" ? item.titleKo : item.titleEn || item.titleKo);
      const description = stripRichText(lang === "ko" ? item.descriptionKo : item.descriptionEn || item.descriptionKo);
      const href = event ? `/events/${item.id}` : isClosedItem(item) && item.resultVisibility === "PUBLIC" ? `/survey/${item.id}/results` : `/survey/${item.id}`;
      const dateTime = getDiscoveryDateTime(item, lang);
      const badge = getDiscoveryBadge(item, lang);
      const audience = audienceText(item, lang);
      const surveyBadges = [
        !item.allowAnonymous && (lang === "ko" ? "로그인 필요" : "Login required"),
        item.allowAnonymous && (lang === "ko" ? "익명 설문" : "Anonymous survey"),
        item.feePayersOnly && (lang === "ko" ? "과비 납부자만" : "Fee-paying members"),
        item.isKoreanOnly && (lang === "ko" ? "한국어 전용" : "Korean only"),
      ].filter((label): label is string => Boolean(label));
      const cta = isClosedItem(item)
        ? lang === "ko" ? item.resultVisibility === "PUBLIC" ? "결과 보기" : "설문 보기" : item.resultVisibility === "PUBLIC" ? "View results" : "View survey"
        : lang === "ko" ? "설문 참여" : "Take survey";
      const location = (lang === "en" ? item.locationEn || item.location : item.location)?.trim();
      const saved = isAuthenticated && Boolean(item.viewerHasScrapped);
      const submitting = engagementSubmitting === `${item.id}:SCRAP`;
      return <article key={item.id} className={`discovery-card${event ? "" : " is-survey"}${saved ? " is-saved" : ""}${submitting ? " is-saving" : ""}`}>
        <Link to={href} target={event ? undefined : "_blank"} rel={event ? undefined : "noopener noreferrer"} className="discovery-card-link">
          <div className="discovery-card-copy">
            {!hideDate && <p className="discovery-card-date" title={getCardPeriodText(item, lang) || dateTime}>{dateTime}</p>}
            <h3 className="discovery-card-title">{title}</h3>
            <div className="discovery-card-footer">
              <p className="discovery-card-detail">
                {event ? <><MapPin aria-hidden="true" /><span>{location || (lang === "ko" ? "장소 미정" : "Location to be announced")}</span></> : <span>{description || (lang === "ko" ? "설문 내용을 확인하고 참여해 주세요." : "View the survey and take part.")}</span>}
              </p>
              <div className="discovery-card-bottom">
                <div className="discovery-card-badges">
                  {badge.label && (event || !item.isAlwaysOpen || badge.tone === "closed") && <span className={`discovery-badge is-${badge.tone}`} title={badge.deadline ? `${formatCompactDateTime(badge.deadline)} (KST)` : undefined}>{badge.label}</span>}
                  {event ? audience && <span className="discovery-badge is-audience">{audience}</span>
                    : surveyBadges.map(label => <span key={label} className="discovery-badge is-audience">{label}</span>)}
                </div>
                {!event && <span className="discovery-survey-cta">{cta}<ArrowRight aria-hidden="true" /></span>}
              </div>
            </div>
          </div>
          {event && <CardImage imageUrl={item.imageUrl} />}
        </Link>
        {event && onEngagementToggle && <button type="button" className="discovery-card-save" aria-label={lang === "ko" ? saved ? "스크랩 해제" : "스크랩" : saved ? "Remove bookmark" : "Bookmark"} aria-pressed={saved} aria-busy={submitting} disabled={submitting} onClick={() => onEngagementToggle(item, "SCRAP", !saved)}>
          <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} strokeWidth={saved ? 0 : 1.6} />
        </button>}
      </article>;
    })}
  </div>;
}
