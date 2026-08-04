import type { SurveyDto } from '@soc/contracts';

import { uiText } from '@/lib/i18n/surface-catalog';

const valueOf = (value: { value: string | null } | null | undefined) => value?.value ?? '';
const typeLabels = {
  SHORT_TEXT: 'survey.type.SHORT_TEXT',
  LONG_TEXT: 'survey.type.LONG_TEXT',
  SINGLE_CHOICE: 'survey.type.SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'survey.type.MULTIPLE_CHOICE',
  NUMBER: 'survey.type.NUMBER',
  DATE: 'survey.type.DATE',
} as const;

export function SurveyDefinitionPreview({ survey, className = '' }: { survey: SurveyDto; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} aria-labelledby="survey-definition-preview-heading" data-testid="survey-definition-preview">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="survey-definition-preview-heading" className="text-lg font-bold">설문 미리보기</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">읽기 전용</span></div>
    <h3 className="mt-4 text-xl font-bold">{valueOf(survey.title)}</h3>
    {survey.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{valueOf(survey.description)}</p>}
    <div className="mt-5 space-y-5">
      {survey.sections.map((section, sectionIndex) => <section key={section.id || sectionIndex} aria-labelledby={`preview-section-${sectionIndex}`}>
        <h3 id={`preview-section-${sectionIndex}`} className="font-semibold">{valueOf(section.title)}</h3>
        <ol className="mt-3 space-y-3">
          {section.items.map((item, itemIndex) => item.kind === 'DESCRIPTION' ? <li key={item.id || itemIndex} className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">{valueOf(item.body)}</li> : item.kind === 'IMAGE_BLOCK' ? <li key={item.id || itemIndex} className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">이미지 블록 ({item.mode}, {item.membershipCounts.shared + item.membershipCounts.ko + item.membershipCounts.en})</li> : <li key={item.id || itemIndex} className="rounded-md border border-slate-200 p-3">
            <p className="font-medium">{valueOf(item.question.prompt)}{item.question.required && <span aria-label="필수" className="ml-1 text-red-700">*</span>}</p>
            {item.question.helpText && <p className="mt-1 text-sm text-slate-600">{valueOf(item.question.helpText)}</p>}
            <p className="mt-2 text-sm text-slate-500">{uiText(typeLabels[item.question.type])}</p>
            {(item.question.type === 'SINGLE_CHOICE' || item.question.type === 'MULTIPLE_CHOICE') && <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{item.question.choices.map((choice, choiceIndex) => <li key={choice.id || choiceIndex}>{valueOf(choice.value)}</li>)}</ul>}
          </li>)}
        </ol>
      </section>)}
    </div>
  </section>;
}
