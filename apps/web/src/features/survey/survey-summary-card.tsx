import type { ReactNode } from "react";
import type { SurveyDetailResponse } from "@soc/contracts";
import {
  Calendar,
  ClipboardList,
  Languages,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  formatSurveyDateTime,
  getAudienceLabel,
  getLocalizedText,
  getResponsePolicyLabel,
  getScheduleLabel,
  getSurveyKindLabel,
} from "./survey-answer-utils";
import { RichTextContent } from "@/components/ui/rich-text-content";

interface SurveySummaryCardProps {
  children?: ReactNode;
  lang: string;
  survey: SurveyDetailResponse;
}

export function SurveySummaryCard({ children, lang, survey }: SurveySummaryCardProps) {
  const description = getLocalizedText(
    lang,
    survey.descriptionKo,
    survey.descriptionEn,
  );

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_6px_20px_rgba(15,23,42,0.04)] animate-in fade-in slide-in-from-top-4 duration-300 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-kaist-darkgreen/15 bg-kaist-lightgreen/20 px-3 py-1.5 text-xs font-semibold text-kaist-darkgreen">
          <ClipboardList className="h-3.5 w-3.5" />
          {getSurveyKindLabel(survey.kind, lang)}
        </span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
        {getLocalizedText(lang, survey.titleKo, survey.titleEn)}
      </h1>
      {description && (
        <RichTextContent
          content={description}
          className="mt-4 border-t border-slate-100 pt-4 text-[15px] font-medium leading-relaxed text-slate-600"
        />
      )}

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
            {lang === "ko" ? "한국어 사용자만" : "Korean Speakers Only"}
          </span>
        )}
      </div>

      {children ? (
        <div className="mt-6 border-t border-slate-100 pt-6">{children}</div>
      ) : null}
    </section>
  );
}
