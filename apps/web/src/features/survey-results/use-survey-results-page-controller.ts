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
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnalytics(null);
    apiClient
      .getSurveyAnalytics(id)
      .then((data) => {
        if (cancelled) return;
        setAnalytics(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientHttpError && err.status === 403) {
          setError("forbidden");
        } else {
          setError("failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, apiClient, retryKey]);

  return {
    analytics,
    error,
    lang,
    loading,
    retry: () => setRetryKey(value => value + 1),
    navigateBack: () => navigate(-1),
  };
}
