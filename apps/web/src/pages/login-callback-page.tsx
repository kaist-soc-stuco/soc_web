import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  clearStoredAuthState,
  consumeAuthReturnPath,
  writeStoredAuthState,
} from "@/lib/auth-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const LAST_CONSUMED_RESULT_TOKEN_KEY = "soc.auth.last-consumed-result-token";

type LoginStatus = "idle" | "starting" | "processing" | "failed";

const submitAuthorizeForm = (payload: {
  loginUrl: string;
  clientId: string;
  nonce: string;
  redirectUri: string;
  state: string;
}) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payload.loginUrl;
  form.style.display = "none";

  Object.entries({
    client_id: payload.clientId,
    nonce: payload.nonce,
    redirect_uri: payload.redirectUri,
    state: payload.state,
  }).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};

export function LoginCallbackPage() {
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const consumedResultTokenRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConsentToken, setPendingConsentToken] = useState<string | null>(
    null,
  );
  const [consentSubmitting, setConsentSubmitting] = useState<
    null | "persisted" | "temporary"
  >(null);
  const [consentErrorMessage, setConsentErrorMessage] = useState<string | null>(
    null,
  );
  const returnToPreviousPage = useCallback(
    (message: string) => {
      clearStoredAuthState();
      toast({ type: "error", message });
      const returnPath = consumeAuthReturnPath();
      if (returnPath) {
        navigate(returnPath, { replace: true });
        return;
      }
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/", { replace: true });
    },
    [navigate, toast],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(location.search);
    const loginStatus = searchParams.get("status");
    const resultToken = searchParams.get("resultToken");
    const pendingLoginToken = searchParams.get("pendingLoginToken");

    const startLogin = async () => {
      setStatus("starting");
      setErrorMessage(null);

      try {
        const payload = await apiClient.getLoginStartPayload();
        if (
          !payload.loginUrl ||
          !payload.clientId ||
          !payload.nonce ||
          !payload.redirectUri ||
          !payload.state
        ) {
          throw new Error(
            lang === "ko"
              ? "SSO 로그인 정보를 불러오지 못했습니다."
              : "Failed to load SSO login information.",
          );
        }

        submitAuthorizeForm(payload);
      } catch (error) {
        console.error(error);
        returnToPreviousPage(
          lang === "ko"
            ? "로그인을 시작하지 못했습니다."
            : "Failed to start sign-in.",
        );
      }
    };

    if (loginStatus === "consent-required" && pendingLoginToken) {
      writeStoredAuthState({ pendingLoginToken });
      setPendingConsentToken(pendingLoginToken);
      setStatus("processing");
      return;
    }

    if (loginStatus === "success" && resultToken) {
      const consumedByRef = consumedResultTokenRef.current.has(resultToken);
      const consumedBySessionStorage =
        window.sessionStorage.getItem(LAST_CONSUMED_RESULT_TOKEN_KEY) ===
        resultToken;

      if (consumedByRef || consumedBySessionStorage) return;

      consumedResultTokenRef.current.add(resultToken);
      window.sessionStorage.setItem(LAST_CONSUMED_RESULT_TOKEN_KEY, resultToken);
      setStatus("processing");
      setErrorMessage(null);

      void apiClient
        .consumeLoginResult(resultToken)
        .then(async () => {
          clearStoredAuthState();
          await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
          navigate("/", { replace: true });
        })
        .catch((error) => {
          console.error(error);
          consumedResultTokenRef.current.delete(resultToken);
          window.sessionStorage.removeItem(LAST_CONSUMED_RESULT_TOKEN_KEY);
          returnToPreviousPage(
            lang === "ko"
              ? "로그인 결과를 처리하지 못했습니다."
              : "Failed to process the sign-in result.",
          );
        });
      return;
    }

    if (loginStatus === "success") {
      void queryClient
        .invalidateQueries({ queryKey: ["auth", "session"] })
        .finally(() => navigate("/", { replace: true }));
      return;
    }

    if (
      loginStatus === "error" &&
      searchParams.get("reason") === "session_expired"
    ) {
      // 세션 만료로 진입한 경우에는 오류 화면으로 되돌아가지 않고
      // 새 SSO authorize 요청을 시작해야 보호된 페이지와의 리다이렉트 루프를 피할 수 있습니다.
      void startLogin();
      return;
    }

    if (loginStatus === "error") {
      const reason = searchParams.get("reason");
      const message = reason === "account_expired"
        ? lang === "ko"
          ? "관리자에 의해 비활성화된 계정입니다. 복구가 필요하면 화면 하단의 채널톡으로 문의해 주세요."
          : "This account has been deactivated. Contact us through Channel Talk at the bottom of the page to request recovery."
        : reason === "department_not_eligible"
          ? lang === "ko"
            ? "현재 전산학부 소속 정보로 확인되지 않아 로그인할 수 없습니다. 소속 정보가 잘못되었다면 채널톡으로 문의해 주세요."
            : "Your current affiliation is not eligible for this service. Contact us through Channel Talk if this appears incorrect."
          : lang === "ko"
            ? "로그인 중 오류가 발생했습니다."
            : "An error occurred while signing in.";
      returnToPreviousPage(
        message,
      );
      return;
    }

    void startLogin();
  }, [apiClient, lang, location.search, navigate, queryClient, returnToPreviousPage]);

  const submitConsentDecision = async (consent: boolean) => {
    if (!pendingConsentToken) {
      setConsentErrorMessage(
        lang === "ko"
          ? "로그인 동의 토큰이 없습니다. 로그인을 다시 시도해 주세요."
          : "The login consent token is missing. Please sign in again.",
      );
      return;
    }

    setConsentSubmitting(consent ? "persisted" : "temporary");
    setConsentErrorMessage(null);

    try {
      const payload = await apiClient.submitConsentDecision({
        consent,
        pendingLoginToken: pendingConsentToken,
      });

      if (payload.storageMode === "temporary") {
        writeStoredAuthState({
          temporarySession: payload.temporarySession,
        });
      } else {
        clearStoredAuthState();
      }

      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      navigate("/", { replace: true });
    } catch (error) {
      console.error(error);
      returnToPreviousPage(
        lang === "ko"
          ? "동의 처리 중 오류가 발생했습니다."
          : "An error occurred while saving your consent choice.",
      );
    } finally {
      setConsentSubmitting(null);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-kaist-black">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-kaist-darkgreen">
          {status === "failed"
            ? lang === "ko"
              ? "로그인 실패"
              : "Sign-in failed"
            : lang === "ko"
              ? "로그인 처리 중"
              : "Signing you in"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {status === "failed"
            ? (errorMessage ??
              (lang === "ko"
                ? "잠시 후 다시 시도해 주세요."
                : "Please try again shortly."))
            : lang === "ko"
              ? "SSO 로그인 화면으로 이동하거나 로그인 결과를 확인하고 있습니다."
              : "Opening the SSO sign-in page or verifying your sign-in result."}
        </p>
        {status === "failed" ? (
          <Button variant="ghost"
            type="button"
            onClick={() => window.location.assign("/login")}
            className="mt-5 rounded-lg bg-kaist-darkgreen px-4 py-2 text-xs font-semibold text-white"
          >
            {lang === "ko" ? "다시 로그인" : "Try again"}
          </Button>
        ) : null}
      </section>

      {pendingConsentToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h1 className="text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-kaist-black">
              {lang === "ko" ? "개인정보 제공 동의" : "Personal Data Consent"}
            </h1>
            <div className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-600">
              <p>
                {lang === "ko"
                  ? "SSO 로그인으로 받은 이름, 이메일, 학번 정보를 서비스 이용에 사용합니다."
                  : "We use your name, email address, and student number received through SSO to provide this service."}
              </p>
              <p>
                {lang === "ko"
                  ? (
                    <>
                      동의하면 다음 로그인부터 필요한 기능을 바로 사용할 수 있습니다.
                      <br />
                      동의하지 않아도 이번 세션에서는 임시 로그인으로 계속 이용할 수 있습니다.
                    </>
                  )
                  : "If you consent, account features will remain available on future visits. If you decline, you can continue with a temporary session for this visit."}
              </p>
            </div>

            {consentErrorMessage ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {consentErrorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                disabled={consentSubmitting !== null}
                onClick={() => void submitConsentDecision(false)}
                className="border-kaist-darkgreen/30 text-sm font-semibold text-kaist-darkgreen hover:border-kaist-darkgreen/50 hover:bg-kaist-darkgreen/5 hover:text-kaist-darkgreen"
              >
                {consentSubmitting === "temporary"
                  ? lang === "ko"
                    ? "처리 중..."
                    : "Processing..."
                  : lang === "ko"
                    ? "저장하지 않고 계속"
                    : "Continue without saving"}
              </Button>
              <Button
                variant="default"
                type="button"
                disabled={consentSubmitting !== null}
                onClick={() => void submitConsentDecision(true)}
                className="text-sm font-semibold shadow-sm"
              >
                {consentSubmitting === "persisted"
                  ? lang === "ko"
                    ? "처리 중..."
                    : "Processing..."
                  : lang === "ko"
                    ? "동의하고 저장"
                    : "Consent and save"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
