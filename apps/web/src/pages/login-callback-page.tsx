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
import { UiInput } from "@/components/ui/form-control";
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
  const [termsAccepted, setTermsAccepted] = useState(false);

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
    if (!termsAccepted) {
      toast({ type: "error", message: lang === "ko" ? "서비스 이용약관에 동의해 주세요." : "Please agree to the Terms of Service." });
      return;
    }

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
          title={lang === "ko" ? "서비스 이용 동의" : "Service agreements"}
          size="standard"
          bodyClassName="space-y-3"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
              <Button loading={consentSubmitting === "temporary"}
                variant="outline"
                type="button"
                disabled={consentSubmitting !== null || !termsAccepted}
                onClick={() => void submitConsentDecision(false)}
                className="text-sm font-medium"
              >
                {lang === "ko" ? "개인정보 동의 없이 임시 이용" : "Use without privacy consent"}
              </Button>
              <Button loading={consentSubmitting === "persisted"}
                variant="default"
                type="button"
                disabled={consentSubmitting !== null || !termsAccepted}
                onClick={() => void submitConsentDecision(true)}
                className="text-sm font-semibold shadow-sm"
              >
                {lang === "ko" ? "개인정보 동의 후 가입" : "Consent to data use and join"}
              </Button>
            </div>
          }
        >
          <div className="space-y-2 border-b border-slate-200 pb-3">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-primary underline underline-offset-4">
              {lang === "ko" ? "서비스 이용약관 전문 보기" : "Read the Terms of Service"}
              <span className="sr-only">{lang === "ko" ? " (새 탭에서 열림)" : " (opens in a new tab)"}</span>
            </a>
            <p className="text-sm leading-6 text-slate-600">
              {lang === "ko"
                ? "이용약관에는 게시물의 서비스 내 이용허락(제9조), 게시물 관리·이용 제한 및 이의 제기(제11·12조), 회원 탈퇴(제17조)에 관한 사항이 포함되어 있습니다. 임시 이용 시에도 이용약관 동의가 필요합니다."
                : "The Terms cover the license to Posts within the Service (Section 9), moderation, restrictions and objections (Sections 11–12), and account closure (Section 17). Agreement is also required for temporary access."}
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm leading-6 text-slate-800">
              <UiInput
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                disabled={consentSubmitting !== null}
                required
                className="mt-1 shrink-0"
              />
              <span>{lang === "ko" ? "[필수] 서비스 이용약관에 동의합니다." : "[Required] I agree to the Terms of Service."}</span>
            </label>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {lang === "ko" ? "개인정보 수집 및 이용 동의" : "Consent to collection and use of personal information"}
          </h3>
          <dl className="space-y-3 text-sm font-medium leading-6 text-slate-600">
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "수집·이용 목적" : "Purpose"}</dt>
              <dd>{lang === "ko" ? "KAIST 구성원 확인, 회원 계정의 생성·관리 및 서비스 운영·보안을 위하여 수집·이용합니다." : "Information is collected and used to verify KAIST membership, create and manage accounts, operate the service, and maintain security."}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "수집 항목" : "Information collected"}</dt>
              <dd>{lang === "ko" ? "KAIST UID, 성명(한글·영문), 학번, 이메일 주소, 소속 학과, 주전공, 신분코드(KAIST 구성원 구분 코드), 동의·로그인·접속기록을 수집합니다." : "Information collected includes KAIST UID, Korean and English names, student number, email address, department, primary major, member code (KAIST membership classification code), and consent, sign-in, and access records."}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "보유·이용 기간" : "Retention period"}</dt>
              <dd>{lang === "ko" ? "회원·SSO·동의 정보는 회원 탈퇴, 동의 철회 또는 서비스 종료 시까지 보유합니다. 운영·보안 기록은 2년간, 개인정보취급자의 접근 권한 변경 기록은 3년간 보유합니다. 로그인 대기·세션 정보의 유효기간과 파기 시점은 개인정보처리방침 제4조에 따릅니다." : "Account, SSO, and consent information is retained until account closure, withdrawal of consent, or termination of the service. Operational and security records are retained for two years, and administrator access-permission records for three years. Section 4 of the Privacy Policy sets out the validity and destruction of pending sign-in and session information."}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">{lang === "ko" ? "동의 거부권 및 불이익" : "Right to refuse and consequences"}</dt>
              <dd>{lang === "ko" ? "동의를 거부할 수 있으며, 이 경우 회원 계정을 저장하지 않는 임시 세션을 제공합니다. 임시 접근토큰의 유효기간은 최대 10분이며, 마이페이지 등 회원 계정이 필요한 기능은 이용할 수 없습니다. 브라우저에 저장되는 초안의 보유기간과 삭제 방법은 개인정보처리방침 제13조에 따릅니다." : "You may refuse consent. In that case, a temporary session is provided without storing a member account. The temporary access token is valid for at most ten minutes, and features requiring a member account, such as My Page, are unavailable. Section 13 of the Privacy Policy describes retention and deletion of browser-stored drafts."}</dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-slate-600">
            {lang === "ko" ? "개인정보 처리에 관한 자세한 내용은 " : "For details about how we handle personal information, see our "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-primary underline underline-offset-4">
              {lang === "ko" ? "개인정보처리방침" : "Privacy Policy"}
              <span className="sr-only">{lang === "ko" ? " (새 탭에서 열림)" : " (opens in a new tab)"}</span>
            </a>
            {lang === "ko" ? "을 확인할 수 있습니다." : "."}
          </p>
        </Modal>
      ) : null}
    </main>
  );
}
