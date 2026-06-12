import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { SurveyDetailResponse } from "@soc/contracts";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  answerContentToValue,
  isAnswerFilled,
  toAnswerContent,
  type AnswerValue,
} from "./survey-answer-utils";

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
  const [submitted, setSubmitted] = useState(false);

  const allQuestions = useMemo(
    () => survey?.sections.flatMap((section) => section.questions) ?? [],
    [survey],
  );

  const requiredQuestions = useMemo(
    () => allQuestions.filter((question) => question.isRequired),
    [allQuestions],
  );

  useEffect(() => {
    if (!surveyId) return;

    apiClient
      .getSurveyDetail(surveyId)
      .then((data) => {
        setSurvey(data);
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
        setAnswers(init);
      })
      .catch(() =>
        setLoadError(
          lang === "ko"
            ? "설문을 불러오지 못했습니다."
            : "Failed to load survey.",
        ),
      );
  }, [surveyId, apiClient, lang]);

  const handleAnswerChange = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!survey || !surveyId) return;
    setSubmitting(true);
    setSubmitError(null);

    if (survey.isPreview || !survey.isPublished) {
      setSubmitError(
        lang === "ko"
          ? "공개되지 않은 설문은 제출할 수 없습니다."
          : "Unpublished surveys cannot be submitted.",
      );
      setSubmitting(false);
      return;
    }

    const missingRequired = requiredQuestions.filter(
      (question) =>
        !isAnswerFilled(question.questionType, answers[question.id]),
    );
    if (missingRequired.length > 0) {
      setSubmitError(
        lang === "ko"
          ? "필수 문항에 모두 응답한 뒤 제출해 주세요."
          : "Please answer all required questions before submitting.",
      );
      setSubmitting(false);
      return;
    }

    const answerInputs = allQuestions.map((question) => ({
      questionId: question.id,
      content: toAnswerContent(
        question.questionType,
        answers[question.id] ?? "",
      ),
    }));

    try {
      const shouldUpdateExistingResponse =
        Boolean(survey.currentResponse) &&
        survey.allowResponseEdit &&
        !survey.allowMultipleResponses;

      if (shouldUpdateExistingResponse) {
        await apiClient.updateMySurveyResponse(surveyId, {
          answers: answerInputs,
        });
      } else {
        await apiClient.submitSurveyResponse(surveyId, {
          answers: answerInputs,
        });
      }
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiClientHttpError && error.status === 403) {
        setSubmitError(
          lang === "ko"
            ? "응답 권한 또는 참여 조건을 충족하지 못했습니다."
            : "You do not meet the response requirements.",
        );
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
    answers,
    handleAnswerChange,
    handleSubmit,
    lang,
    loadError,
    session,
    sessionLoading,
    submitError,
    submitted,
    submitting,
    survey,
  };
}
