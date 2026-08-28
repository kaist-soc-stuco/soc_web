import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { SurveyDetailResponse, SurveyQuestionRecord } from "@soc/contracts";
import { msToIso, nowMs } from "@soc/shared";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  answerContentToValue,
  emptyAnswerValue,
  isAnswerFilled,
  toAnswerContent,
  type AnswerValue,
} from "./survey-answer-utils";
import { getVisibleSurveySectionIds } from "./survey-branching";

const SURVEY_RESPONSE_DRAFT_VERSION = 1;

function getSurveyResponseDraftKey(surveyId: string, userId?: string) {
  return `soc:survey-response-draft:${surveyId}:${userId ?? "anonymous"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSurveyResponseDraft(
  storageKey: string,
): Record<string, AnswerValue> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== SURVEY_RESPONSE_DRAFT_VERSION ||
      !isRecord(parsed.answers)
    ) {
      return null;
    }

    return parsed.answers as Record<string, AnswerValue>;
  } catch {
    return null;
  }
}

export function useSurveyPageController(surveyId: string | undefined) {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [responseSubmittedAt, setResponseSubmittedAt] = useState<string | null>(
    null,
  );
  const [draftRestored, setDraftRestored] = useState(false);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);

  const allSurveyQuestions = useMemo(
    () => survey?.sections.flatMap((section) => section.questions) ?? [],
    [survey],
  );

  const visibleSectionIds = useMemo(
    () => (survey ? getVisibleSurveySectionIds(survey, answers) : new Set<string>()),
    [answers, survey],
  );

  const allQuestions = useMemo(
    () =>
      survey?.sections
        .filter((section) => visibleSectionIds.has(section.id))
        .flatMap((section) => section.questions) ?? [],
    [survey, visibleSectionIds],
  );

  const requiredQuestions = useMemo(
    () => allQuestions.filter((question) => question.isRequired),
    [allQuestions],
  );

  useEffect(() => {
    if (!surveyId) return;

    const storageKey = getSurveyResponseDraftKey(surveyId, session?.userId);
    let active = true;

    setLoadError(null);
    setSubmitted(false);
    setDraftRestored(false);
    setHydratedDraftKey(null);

    apiClient
      .getSurveyDetail(surveyId)
      .then((data) => {
        if (!active) return;

        setSurvey(data);
        setResponseSubmittedAt(data.currentResponse?.submittedAt ?? null);
        const answerByQuestionId = new Map(
          data.currentResponse?.answers.map((answer) => [
            answer.questionId,
            answer,
          ]) ?? [],
        );
        const init: Record<string, AnswerValue> = {};
        for (const section of data.sections) {
          for (const question of section.questions) {
            init[question.id] = answerContentToValue(
              question.questionType,
              answerByQuestionId.get(question.id),
            );
          }
        }
        const savedAnswers = readSurveyResponseDraft(storageKey);
        setAnswers(savedAnswers ? { ...init, ...savedAnswers } : init);
        setDraftRestored(Boolean(savedAnswers && Object.keys(savedAnswers).length > 0));
        setHydratedDraftKey(storageKey);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(
          lang === "ko"
            ? "설문을 불러오지 못했습니다."
            : "Failed to load survey.",
        );
      });

    return () => {
      active = false;
    };
  }, [surveyId, apiClient, lang, session?.userId]);

  const draftStorageKey = surveyId
    ? getSurveyResponseDraftKey(surveyId, session?.userId)
    : null;

  useEffect(() => {
    if (
      !survey ||
      !surveyId ||
      !draftStorageKey ||
      hydratedDraftKey !== draftStorageKey ||
      submitted ||
      survey.isPreview ||
      !survey.isPublished
    ) {
      return;
    }

    if (typeof window === "undefined") return;

    try {
      const hasAnswer = allSurveyQuestions.some((question) =>
        isAnswerFilled(question.questionType, answers[question.id]),
      );

      if (!hasAnswer) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }

      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          answers,
          savedAt: msToIso(nowMs()),
          version: SURVEY_RESPONSE_DRAFT_VERSION,
        }),
      );
    } catch {
      // Draft persistence is best effort and must not block answering.
    }
  }, [
    allSurveyQuestions,
    answers,
    draftStorageKey,
    hydratedDraftKey,
    submitted,
    survey,
    surveyId,
  ]);

  const handleAnswerChange = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setQuestionErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const validateRequiredQuestions = (questions: SurveyQuestionRecord[]) => {
    const missingRequired = questions.filter(
      (question) =>
        question.isRequired &&
        !isAnswerFilled(question.questionType, answers[question.id]),
    );

    setQuestionErrors((previous) => {
      const next = { ...previous };
      for (const question of questions) {
        delete next[question.id];
      }
      for (const question of missingRequired) {
        next[question.id] =
          lang === "ko" ? "필수 문항입니다." : "This question is required.";
      }
      return next;
    });

    if (missingRequired.length === 0) return true;

    const firstMissingQuestion = missingRequired[0];
    window.requestAnimationFrame(() => {
      document
        .getElementById(`survey-question-${firstMissingQuestion.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return false;
  };

  const handleNextSection = (sectionId: string) => {
    if (!survey || survey.isPreview || !survey.isPublished) return true;
    const section = survey.sections.find((candidate) => candidate.id === sectionId);
    return section ? validateRequiredQuestions(section.questions) : true;
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!survey || !surveyId) return;
    setSubmitting(true);
    setSubmitError(null);
    setQuestionErrors({});

    if (survey.isPreview || !survey.isPublished) {
      setSubmitError(
        lang === "ko"
          ? "공개되지 않은 설문은 제출할 수 없습니다."
          : "Unpublished surveys cannot be submitted.",
      );
      setSubmitting(false);
      return;
    }

    setQuestionErrors({});
    if (!validateRequiredQuestions(requiredQuestions)) {
      setSubmitting(false);
      return;
    }

    const answerInputs = allQuestions.map((question) => ({
      questionId: question.id,
      content: toAnswerContent(
        question.questionType,
        answers[question.id] ?? emptyAnswerValue(question.questionType),
      ),
    }));

    try {
      const shouldUpdateExistingResponse =
        Boolean(survey.currentResponse) &&
        survey.allowResponseEdit &&
        !survey.allowMultipleResponses;
      let submittedAt: string | null = null;

      if (shouldUpdateExistingResponse) {
        const response = await apiClient.updateMySurveyResponse(surveyId, {
          answers: answerInputs,
        });
        submittedAt = response.submittedAt;
      } else {
        const response = await apiClient.submitSurveyResponse(surveyId, {
          answers: answerInputs,
        });
        submittedAt = response.submittedAt;
      }
      setResponseSubmittedAt(submittedAt);
      setSubmitted(true);
      setDraftRestored(false);
      if (typeof window !== "undefined" && draftStorageKey) {
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch {
          // Draft cleanup is best effort.
        }
      }
    } catch (error) {
      if (error instanceof ApiClientHttpError && error.status === 403) {
        const requirementMessages: Record<string, { ko: string; en: string }> = {
          login_required: {
            ko: "로그인한 사용자만 참여할 수 있습니다.",
            en: "You must sign in to participate.",
          },
          soc_affiliation_required: {
            ko: "전산학부 주전공 조건을 충족하지 못했습니다.",
            en: "This survey is limited to eligible School of Computing students.",
          },
          academic_status_required: {
            ko: "이 설문에서 요구하는 학적 상태를 충족하지 못했습니다.",
            en: "Your academic status does not meet this survey's requirements.",
          },
          fee_payer_only: {
            ko: "과비 납부가 확인된 사용자만 참여할 수 있습니다.",
            en: "This survey is limited to verified fee-paying members.",
          },
          login_required_for_file_upload: {
            ko: "파일을 제출하려면 로그인해야 합니다.",
            en: "You must sign in to upload files.",
          },
        };
        const message = error.code ? requirementMessages[error.code] : undefined;
        setSubmitError(message?.[lang === "ko" ? "ko" : "en"] ?? (
          lang === "ko"
            ? "응답 참여 조건을 충족하지 못했습니다."
            : "You do not meet the response requirements."
        ));
      } else if (error instanceof ApiClientHttpError && error.status === 409) {
        setSubmitError(
          lang === "ko"
            ? "이미 마감되었거나 응답할 수 없는 설문입니다."
            : "This survey is closed or cannot accept responses.",
        );
      } else {
        setSubmitError(
          lang === "ko"
            ? "제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
            : "An error occurred during submission. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    allQuestions,
    allSurveyQuestions,
    answers,
    draftRestored,
    handleAnswerChange,
    handleNextSection,
    handleSubmit,
    lang,
    loadError,
    session,
    sessionLoading,
    responseSubmittedAt,
    questionErrors,
    submitError,
    submitted,
    submitting,
    survey,
    visibleSectionIds,
  };
}
