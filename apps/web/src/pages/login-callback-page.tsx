import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert } from "lucide-react";

import {
  clearStoredAuthState,
  consumeAuthReturnPath,
  writeStoredAuthState,
} from "@/lib/auth-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { ResponseStateCard, responseStateActionClassName } from "@/features/survey/response-state-card";

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
  const consumedLoginResultRef = useRef(false);
  const loginStartingRef = useRef(false);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConsentToken, setPendingConsentToken] = useState<string | null>(
    null,
  );
  const [consentSubmitting, setConsentSubmitting] = useState<
    null | "persisted" | "temporary"
  >(null);

  const returnToPreviousPage = useCallback(
    (message: string) => {
      clearStoredAuthState();
      toast({ type: "error", message });
      const returnPath = consumeAuthReturnPath();
      if (returnPath) {
        navigate(returnPath, { replace: true });
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

    // Inspect the otherwise unused failure UI without starting an SSO transaction.
    if (import.meta.env.DEV && searchParams.get("preview") === "failed") {
      setStatus("failed");
      setErrorMessage(lang === "ko" ? "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." : "An error occurred while signing in. Please try again shortly.");
      return;
    }

    const startLogin = async () => {
      if (loginStartingRef.current) return;
      loginStartingRef.current = true;
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
        loginStartingRef.current = false;
        console.error(error);
        returnToPreviousPage(
          lang === "ko"
            ? "로그인을 시작하지 못했습니다."
            : "Failed to start sign-in.",
        );
      }
    };

    if (loginStatus === "consent-required") {
      // The pending SSO transaction is identified by an HttpOnly cookie. No
      // bearer value is copied into the URL or sessionStorage.
      setPendingConsentToken("server-transaction");
      setStatus("processing");
      return;
    }

    if (loginStatus === "success") {
      if (consumedLoginResultRef.current) return;
      consumedLoginResultRef.current = true;
      setStatus("processing");
      setErrorMessage(null);

      void apiClient
        .consumeLoginResult()
        .then(async () => {
          clearStoredAuthState();
          await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
          navigate(consumeAuthReturnPath() ?? "/", { replace: true });
        })
        .catch((error) => {
          console.error(error);
          consumedLoginResultRef.current = false;
          returnToPreviousPage(
            lang === "ko"
              ? "로그인 결과를 처리하지 못했습니다."
              : "Failed to process the sign-in result.",
          );
        });
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
      toast({ type: "error", message: lang === "ko" ? "로그인 동의 세션이 없습니다. 다시 로그인해 주세요." : "Please sign in again." });
      return;
    }

    setConsentSubmitting(consent ? "persisted" : "temporary");

    try {
      const payload = await apiClient.submitConsentDecision({
        consent,
      });

      if (payload.storageMode === "temporary") {
        writeStoredAuthState({
          temporarySession: payload.temporarySession,
        });
      } else {
        clearStoredAuthState();
      }

      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      navigate(consumeAuthReturnPath() ?? "/", { replace: true });
    } catch (error) {
      console.error(error);
      toast({ type: "error", message: lang === "ko" ? "동의 처리에 실패했습니다. 다시 시도해 주세요." : "Could not save your choice. Please try again." });
    } finally {
      setConsentSubmitting(null);
    }
  };

  const isProcessing = status !== "failed" && !pendingConsentToken;
  const leaveFailurePage = () => {
    const returnPath = consumeAuthReturnPath();
    if (returnPath && !returnPath.startsWith("//") && !returnPath.startsWith("/login")) {
      navigate(returnPath, { replace: true });
    } else if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <main className={`relative flex min-h-svh items-center justify-center bg-white px-4 py-20 text-kaist-black sm:px-6 md:min-h-screen ${status === "failed" ? "md:bg-[var(--ui-surface-canvas)]" : ""}`}>
      {status === "failed" ? <header className="absolute inset-x-0 top-0 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
        <IconButton tone="navigation" aria-label={lang === "ko" ? "뒤로가기" : "Go back"} onClick={leaveFailurePage} className="!size-11 !rounded-full">
          <ArrowLeft aria-hidden="true" className="size-6" />
        </IconButton>
      </header> : null}
      {isProcessing ? (
        <span
          className="login-processing-spinner"
          role="status"
          aria-label={lang === "ko" ? "로그인 처리 중" : "Signing you in"}
        />
      ) : status === "failed" ? (
        <ResponseStateCard icon={CircleAlert} headingAs="h1" role="alert"
          className="mobile-login-state max-md:min-h-0 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0"
          title={lang === "ko" ? "로그인 실패" : "Sign-in failed"}
          description={errorMessage ?? (lang === "ko" ? "잠시 후 다시 시도해 주세요." : "Please try again shortly.")}
          actions={<Button
            type="button"
            onClick={() => window.location.assign("/login")}
            className={`${responseStateActionClassName} max-md:!h-12 max-md:!min-h-12 max-md:!w-full`}
          >
            {lang === "ko" ? "다시 로그인" : "Try again"}
          </Button>}
        />
      ) : null}

      {pendingConsentToken ? (
        <Modal
          open
          onClose={() =>
            returnToPreviousPage(
              lang === "ko"
                ? "로그인을 취소했습니다."
                : "Sign-in was canceled.",
            )
          }
          title={lang === "ko" ? "개인정보 수집 및 이용 동의" : "Consent to Collection and Use of Personal Information"}
          showClose={false}
          size="standard"
          bodyClassName="space-y-3"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
              <Button loading={consentSubmitting === "temporary"}
                variant="outline"
                type="button"
                disabled={consentSubmitting !== null}
                onClick={() => void submitConsentDecision(false)}
                className="text-sm font-medium"
              >
                {lang === "ko" ? "임시로 이용" : "Use temporarily"}
              </Button>
              <Button loading={consentSubmitting === "persisted"}
                variant="default"
                type="button"
                disabled={consentSubmitting !== null}
                onClick={() => void submitConsentDecision(true)}
                className="text-sm font-semibold shadow-sm"
              >
                {lang === "ko" ? "동의하고 계속" : "Agree and continue"}
              </Button>
            </div>
          }
        >
          <dl className="space-y-3 text-sm font-medium leading-6 text-slate-600">
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "수집·이용 목적" : "Purpose"}</dt>
              <dd>{lang === "ko" ? "KAIST 구성원 확인, 회원 계정 생성, 홈페이지 서비스 제공·운영 및 보안" : "KAIST identity verification, account creation, service operation, and security"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "수집 항목" : "Information collected"}</dt>
              <dd>{lang === "ko" ? "KAIST UID, 성명(한글·영문), 학번, 이메일, 소속, 주전공, 신분코드, 동의·로그인·접속기록" : "KAIST UID, Korean and English names, student number, email, department, primary major, member code, consent, login, and access records"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "보유·이용 기간" : "Retention period"}</dt>
              <dd>{lang === "ko" ? "회원 탈퇴 또는 처리 목적 달성 시까지. 법령과 내부 보존 기준에 따른 기록은 정해진 기간 동안 별도 보관" : "Until account withdrawal or the processing purpose is achieved. Records required by law or internal retention rules are kept separately for the applicable period."}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "동의 거부권 및 불이익" : "Right to refuse and consequences"}</dt>
              <dd>{lang === "ko" ? "동의를 거부할 수 있습니다. 거부하면 회원 정보를 저장하지 않는 임시 세션만 제공되며 마이페이지 등 계정 저장이 필요한 기능은 이용할 수 없습니다. 임시 정보는 세션 종료 시 파기합니다." : "You may refuse consent. If you refuse, only a temporary session without a stored account is provided, and account-based features such as My Page are unavailable. Temporary information is deleted when the session ends."}</dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-slate-600">
            {lang === "ko" ? "개인정보 처리에 관한 자세한 내용은 " : "For details about how we handle personal information, see our "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-primary underline underline-offset-4">
              {lang === "ko" ? "개인정보처리방침" : "Privacy Policy"}
              <span className="sr-only">{lang === "ko" ? " (새 탭에서 열림)" : " (opens in a new tab)"}</span>
            </a>
            {lang === "ko" ? "을 확인해 주세요." : "."}
          </p>
        </Modal>
      ) : null}
    </main>
  );
}
