import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { SurveyAnalyticsResponse } from "@soc/contracts";

import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export type SurveyResultsError = "failed" | "forbidden" | null;

export function useSurveyResultsPageController() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const [analytics, setAnalytics] = useState<SurveyAnalyticsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SurveyResultsError>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .getSurveyAnalytics(id)
      .then((data) => {
        setAnalytics(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientHttpError && err.status === 403) {
          setError("forbidden");
        } else {
          setError("failed");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, apiClient]);

  return {
    analytics,
    error,
    lang,
    loading,
    navigateBack: () => navigate(-1),
  };
}
