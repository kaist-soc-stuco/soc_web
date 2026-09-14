import { ResponseHeaderCard } from "./response-layout";
import type { SurveyDetailResponse } from "@soc/contracts";
import {
  Calendar,
  Languages,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  getAudienceLabel,
  getLocalizedText,
  getResponsePolicyLabel,
  getScheduleLabel,
} from "./survey-answer-utils";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";

interface SurveySummaryCardProps {
  lang: string;
  survey: SurveyDetailResponse;
}

export function SurveySummaryCard({ lang, survey }: SurveySummaryCardProps) {
  const description = getLocalizedText(
    lang,
    survey.descriptionKo,
    survey.descriptionEn,
  );
  const descriptionImage = lang === "ko"
    ? survey.descriptionImageUrlKo
    : survey.descriptionImageUrlEn || survey.descriptionImageUrlKo;
  const hasInlineDescriptionImage = /<img\b/i.test(description);

  return (
    <ResponseHeaderCard title={getLocalizedText(lang, survey.titleKo, survey.titleEn)}>
      {description && (
        <RichTextContent
          content={description}
          className="mt-4 border-t border-slate-100 pt-4 text-[length:var(--ui-text-section-size)] font-medium leading-relaxed text-slate-600"
        />
      )}

      {descriptionImage && !hasInlineDescriptionImage ? (
        <img
          src={resolveAssetUrl(descriptionImage)}
          alt=""
          className="mt-4 max-h-[32rem] w-full rounded-xl border border-slate-200 object-contain"
        />
      ) : null}

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-normal text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-kaist-darkgreen" />
          {getAudienceLabel(survey, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-kaist-darkgreen" />
          {getResponsePolicyLabel(survey, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-kaist-darkgreen" />
          {getScheduleLabel(survey, lang)}
        </span>
        {survey.isKoreanOnly && (
          <span className="inline-flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5 text-kaist-darkgreen" />
            {lang === "ko" ? "한국어 전용" : "Korean only"}
          </span>
        )}
      </div>
    </ResponseHeaderCard>
  );
}
