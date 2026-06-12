import type { SurveyDetailResponse } from "@soc/contracts";
import {
  Calendar,
  ClipboardList,
  Clock,
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

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-top-4 duration-300 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-kaist-darkgreen/15 bg-kaist-lightgreen/20 px-3 py-1.5 text-xs font-extrabold text-kaist-darkgreen">
          <ClipboardList className="h-3.5 w-3.5" />
          {getSurveyKindLabel(survey.kind, lang)}
        </span>
        {survey.closesAt && survey.computedState === "open" && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            {lang === "ko"
              ? `진행 중 (~${formatSurveyDateTime(survey.closesAt)})`
              : `Open (closes: ${formatSurveyDateTime(survey.closesAt)})`}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
        {getLocalizedText(lang, survey.titleKo, survey.titleEn)}
      </h1>
      {description && (
        <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
          {description}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-kaist-darkgreen" />
          {lang === "ko" ? "대상" : "Audience"}:{" "}
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
      </div>
    </section>
  );
}
