import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { clearStoredAuthState, writeStoredAuthState } from "@/lib/auth-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

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
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const consumedResultTokenRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          throw new Error("SSO 로그인 정보를 불러오지 못했습니다.");
        }

        submitAuthorizeForm(payload);
      } catch (error) {
        setStatus("failed");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "로그인을 시작하지 못했습니다.",
        );
      }
    };

    if (loginStatus === "consent-required" && pendingLoginToken) {
      writeStoredAuthState({ pendingLoginToken });
      navigate("/login/consent", { replace: true });
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
          consumedResultTokenRef.current.delete(resultToken);
          window.sessionStorage.removeItem(LAST_CONSUMED_RESULT_TOKEN_KEY);
          setStatus("failed");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "로그인 결과를 처리하지 못했습니다.",
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

    if (loginStatus === "error") {
      setStatus("failed");
      setErrorMessage("로그인 중 오류가 발생했습니다.");
      return;
    }

    void startLogin();
  }, [apiClient, location.search, navigate, queryClient]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-kaist-black">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-extrabold text-kaist-darkgreen">
          {status === "failed" ? "로그인 실패" : "로그인 처리 중"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {status === "failed"
            ? (errorMessage ?? "잠시 후 다시 시도해 주세요.")
            : "SSO 로그인 화면으로 이동하거나 로그인 결과를 확인하고 있습니다."}
        </p>
        {status === "failed" ? (
          <button
            type="button"
            onClick={() => window.location.assign("/login")}
            className="mt-5 rounded-lg bg-kaist-darkgreen px-4 py-2 text-xs font-extrabold text-white"
          >
            다시 로그인
          </button>
        ) : null}
      </section>
    </main>
  );
}
