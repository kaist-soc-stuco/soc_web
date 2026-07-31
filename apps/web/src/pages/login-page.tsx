import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';

import { beginAuthSessionTransition, createEmptyAuthSession, getAuthSessionSnapshot, getAuthSessionSummary, setAuthSession } from '@/lib/auth-session';
import { invalidateAdminGrants, refetchAdminGrants } from '@/lib/admin-grants';
import { loadBoardCatalog } from '@/lib/board-catalog';

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

interface SsoStartPayload {
  action: string;
  clientId: string;
  nonce: string;
  redirectUri: string;
  state: string;
}


const deriveStartUrl = (redirectUri: string): string | null => {
  if (!redirectUri) {
    return null;
  }

  try {
    const url = new URL(redirectUri);
    url.pathname = `${stripTrailingSlashes(url.pathname)}/start`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const resolveStartUrl = (startUrl: string, redirectUri: string): string | null => {
  const explicitStartUrl = startUrl.trim();
  if (explicitStartUrl.length > 0) {
    try {
      return new URL(explicitStartUrl).toString();
    } catch {
      return deriveStartUrl(redirectUri);
    }
  }

  return deriveStartUrl(redirectUri);
};

const withNoTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveApiBaseUrl = (): string => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (apiBaseUrl) {
    return withNoTrailingSlash(apiBaseUrl);
  }

  const startUrl = (import.meta.env.VITE_SSO_START_URL as string | undefined)?.trim();
  if (startUrl) {
    try {
      const parsed = new URL(startUrl);
      const path = parsed.pathname.replace(/\/auth\/login\/start$/, '');
      return `${parsed.origin}${path}`;
    } catch {
      return '/api';
    }
  }

  return '/api';
};

const submitAuthorizeForm = (payload: SsoStartPayload): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payload.action;
  form.style.display = 'none';

  const fields: Record<string, string> = {
    client_id: payload.clientId,
    nonce: payload.nonce,
    redirect_uri: payload.redirectUri,
    state: payload.state,
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};

const LOGIN_RESULT_MESSAGES: Record<string, string> = {
  success: '로그인이 완료되었습니다.',
  'consent-required': '개인정보 저장 동의가 필요합니다.',
  error: '로그인 중 오류가 발생했습니다.',
  logged_out: '로그아웃되었습니다.',
  session_expired: '세션이 만료되었습니다. 다시 로그인해 주세요.',
  sso_authorize_failed: 'SSO 인증에 실패했습니다. 다시 시도해 주세요.',
  origin_required_or_mismatch: '요청을 처리할 수 없습니다. 다시 시도해 주세요.',
};

const getResultMessage = (searchParams: URLSearchParams): string => {
  for (const code of [
    searchParams.get('errorCode'),
    searchParams.get('reason'),
    searchParams.get('status'),
  ]) {
    if (code && LOGIN_RESULT_MESSAGES[code]) {
      return LOGIN_RESULT_MESSAGES[code];
    }
  }

  return '로그인 결과를 확인할 수 없습니다.';
};

export function TreeLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [developmentLoginLoading, setDevelopmentLoginLoading] = useState(false);
  const [refreshTestLoading, setRefreshTestLoading] = useState(false);
  const [refreshTestMessage, setRefreshTestMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<
    | {
        authenticated: boolean;
        canUsePersistentFeatures: boolean;
        requiresConsent: boolean;
        storageMode: 'persisted' | 'temporary' | null;
        userId?: string;
      }
    | null
  >(null);

  const startUrlEnv = import.meta.env.VITE_SSO_START_URL ?? '';
  const redirectUri = import.meta.env.VITE_SSO_REDIRECT_URI ?? '';
  const startUrl = resolveStartUrl(startUrlEnv, redirectUri);
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const resultMessage = getResultMessage(searchParams);


  useEffect(() => {
    let cancelled = false;
    if (searchParams.get('status') === 'success' && searchParams.get('reason') !== 'consent_processed') beginAuthSessionTransition();
    const priorEpoch = getAuthSessionSnapshot().epoch;

    void getAuthSessionSummary(apiClient)
      .then((summary) => {
        if (!cancelled) {
          setSessionSummary(summary);
          if (getAuthSessionSnapshot().epoch !== priorEpoch) {
            void loadBoardCatalog().catch(() => undefined);
            if (summary.authenticated) void refetchAdminGrants().catch(() => undefined);
            else invalidateAdminGrants();
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const handleLogin = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    setLoading(true);
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
        throw new Error('SSO 시작 payload가 불완전합니다.');
      }

      submitAuthorizeForm({
        action: payload.loginUrl,
        clientId: payload.clientId,
        nonce: payload.nonce,
        redirectUri: payload.redirectUri,
        state: payload.state,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인 시작 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };
  const handleDevelopmentLogin = async () => {
    setDevelopmentLoginLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.loginWithDevelopmentAccount();
      beginAuthSessionTransition();
      setSessionSummary(await getAuthSessionSummary(apiClient));
      void loadBoardCatalog().catch(() => undefined);
      void refetchAdminGrants().catch(() => undefined);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '개발용 로그인에 실패했습니다.');
    } finally {
      setDevelopmentLoginLoading(false);
    }
  };


  const handleLogout = async () => {
    setLogoutLoading(true);
    setErrorMessage(null);

    try {
      await apiClient.logout();
      beginAuthSessionTransition();
      setAuthSession(createEmptyAuthSession());
      invalidateAdminGrants();
      void loadBoardCatalog().catch(() => undefined);

      setSessionSummary({
        ...createEmptyAuthSession(),
      });

      navigate('/login?status=success&reason=logged_out', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleRefreshFlowTest = async () => {
    setRefreshTestLoading(true);
    setErrorMessage(null);
    setRefreshTestMessage(null);

    try {
      await apiClient.refreshSession();
      const summary = await getAuthSessionSummary(apiClient);
      setSessionSummary(summary);
      setRefreshTestMessage(`성공: 세션 갱신 완료 (mode=${summary.storageMode ?? 'none'})`);
    } catch (error) {
      setRefreshTestMessage(
        error instanceof Error
          ? `실패: ${error.message}`
          : '실패: refresh 테스트 중 오류가 발생했습니다.',
      );
    } finally {
      setRefreshTestLoading(false);
    }
  };

  const hasResult = [
    'status',
    'message',
    'reason',
    'error',
    'detail',
    'description',
    'errorCode',
  ].some((name) => searchParams.has(name));

  return (
    <main className="min-h-screen bg-kaist-white px-6 py-12 text-kaist-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3">
          <Link to="/" className="text-sm font-semibold text-kaist-darkgreen hover:underline">
            홈으로 돌아가기
          </Link>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
              KAIST PassNi SSO
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">통합 로그인</h1>
            <p className="text-base font-medium leading-7 text-kaist-grey">
              이 페이지는 start/init endpoint에서 payload를 받아 SSO authorize form을 직접 submit하고,
              완료 후에는 `/api/auth/login`에서 처리된 결과를 조회합니다.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Start URL</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {startUrl || '설정되지 않음'}
              </p>
            </div>
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Callback URI</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {redirectUri || '설정되지 않음'}
              </p>
            </div>
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Start Env</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {startUrlEnv || '미설정'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:bg-kaist-grey"
            >
              {loading ? 'SSO 로그인 진행 중' : 'SSO 로그인 시작'}
            </button>
            {import.meta.env.DEV ? (
              <button
                type="button"
                onClick={() => void handleDevelopmentLogin()}
                disabled={developmentLoginLoading}
                className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey"
              >
                {developmentLoginLoading ? '개발용 로그인 처리 중' : '개발용 계정으로 로그인'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutLoading}
              className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey"
            >
              {logoutLoading ? '로그아웃 처리 중' : '로그아웃'}
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshFlowTest()}
              disabled={refreshTestLoading}
              className="rounded-full border border-kaist-greygreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-greygreen transition hover:bg-kaist-greygreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey"
            >
              {refreshTestLoading ? 'refresh 테스트 중' : '401/refresh 테스트'}
            </button>
          </div>

          {refreshTestMessage ? (
            <div className="mt-4 rounded-xl border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 p-4 text-sm font-medium text-kaist-black">
              {refreshTestMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight">서버 흐름</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-kaist-grey">
            <li>브라우저가 start/init endpoint를 `fetch`합니다.</li>
            <li>서버가 `state`와 `nonce`를 준비하고 authorize payload를 반환합니다.</li>
            <li>프런트가 hidden form을 직접 만들어 SSO authorize로 `POST`합니다.</li>
            <li>SSO 서버가 `/api/auth/login`으로 `POST` 콜백을 보냅니다.</li>
            <li>서버가 `code`를 사용자 정보 API로 교환한 뒤 `/login?status=...`로 되돌립니다.</li>
          </ol>
        </section>

        {hasResult ? (
          <section className="rounded-2xl border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 p-6 shadow-sm">
            <h2 className="text-xl font-extrabold tracking-tight">로그인 결과</h2>
            <div className="mt-4 space-y-2 text-sm font-medium text-kaist-black">
              <p>{resultMessage}</p>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold tracking-tight">상태</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-kaist-grey">
              아직 로그인 결과가 없습니다. 버튼을 눌러 서버 시작 엔드포인트로 이동하세요.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight">현재 세션 조회</h2>
          <div className="mt-4 space-y-2 text-sm font-medium text-kaist-black">
            <p>authenticated: {String(sessionSummary?.authenticated ?? false)}</p>
            <p>storageMode: {sessionSummary?.storageMode ?? '없음'}</p>
            <p>
              canUsePersistentFeatures:{' '}
              {String(sessionSummary?.canUsePersistentFeatures ?? false)}
            </p>
            <p>requiresConsent: {String(sessionSummary?.requiresConsent ?? false)}</p>
            <p>userId: {sessionSummary?.userId ?? '없음'}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
