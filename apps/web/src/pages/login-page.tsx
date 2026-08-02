import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createApiClient, type DevelopmentAccountId } from '@soc/api-client';
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
    }
    catch {
        return null;
    }
};
const resolveStartUrl = (startUrl: string, redirectUri: string): string | null => {
    const explicitStartUrl = startUrl.trim();
    if (explicitStartUrl.length > 0) {
        try {
            return new URL(explicitStartUrl).toString();
        }
        catch {
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
        }
        catch {
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
    success: uiText("pages.login-page.006a167e52"),
    'consent-required': uiText("pages.login-page.e59930ea77"),
    error: uiText("pages.login-page.b278a7eb60"),
    logged_out: uiText("pages.login-page.3d33abefa1"),
    session_expired: uiText("pages.login-page.a7a08fd577"),
    sso_authorize_failed: uiText("pages.login-page.619f4030b1"),
    origin_required_or_mismatch: uiText("pages.login-page.f3d6981443"),
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
    return uiText("pages.login-page.3e4ffb3529");
};
export function TreeLogin() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const [loading, setLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [developmentLoginLoading, setDevelopmentLoginLoading] = useState<DevelopmentAccountId | null>(null);
    const [refreshTestLoading, setRefreshTestLoading] = useState(false);
    const [refreshTestMessage, setRefreshTestMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionSummary, setSessionSummary] = useState<{
        authenticated: boolean;
        canUsePersistentFeatures: boolean;
        requiresConsent: boolean;
        storageMode: 'persisted' | 'temporary' | null;
        userId?: string;
    } | null>(null);
    const startUrlEnv = import.meta.env.VITE_SSO_START_URL ?? '';
    const redirectUri = import.meta.env.VITE_SSO_REDIRECT_URI ?? '';
    const startUrl = resolveStartUrl(startUrlEnv, redirectUri);
    const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
    const resultMessage = getResultMessage(searchParams);
    useEffect(() => {
        let cancelled = false;
        if (searchParams.get('status') === 'success' && searchParams.get('reason') !== 'consent_processed')
            beginAuthSessionTransition();
        const priorEpoch = getAuthSessionSnapshot().epoch;
        void getAuthSessionSummary(apiClient)
            .then((summary) => {
            if (!cancelled) {
                setSessionSummary(summary);
                if (getAuthSessionSnapshot().epoch !== priorEpoch) {
                    void loadBoardCatalog().catch(() => undefined);
                    if (summary.authenticated)
                        void refetchAdminGrants().catch(() => undefined);
                    else
                        invalidateAdminGrants();
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
            if (!payload.loginUrl ||
                !payload.clientId ||
                !payload.nonce ||
                !payload.redirectUri ||
                !payload.state) {
                throw new Error(uiText("pages.login-page.798735aaa0"));
            }
            submitAuthorizeForm({
                action: payload.loginUrl,
                clientId: payload.clientId,
                nonce: payload.nonce,
                redirectUri: payload.redirectUri,
                state: payload.state,
            });
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : uiText("pages.login-page.f9a48bcc57"));
            setLoading(false);
        }
    };
    const handleDevelopmentLogin = async (account: DevelopmentAccountId) => {
        setDevelopmentLoginLoading(account);
        setErrorMessage(null);
        try {
            await apiClient.loginWithDevelopmentAccount(account);
            beginAuthSessionTransition();
            setSessionSummary(await getAuthSessionSummary(apiClient));
            void loadBoardCatalog().catch(() => undefined);
            void refetchAdminGrants().catch(() => undefined);
            navigate('/', { replace: true });
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : uiText("pages.login-page.1a3c3caea7"));
        }
        finally {
            setDevelopmentLoginLoading(null);
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
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : uiText("pages.login-page.64e4e33137"));
        }
        finally {
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
            setRefreshTestMessage(uiFormat("pages.login-page.template.e1089dc972", [summary.storageMode ?? 'none']));
        }
        catch (error) {
            setRefreshTestMessage(error instanceof Error
                ? uiFormat("pages.login-page.template.eb5e63464f", [error.message]) : uiText("pages.login-page.59eb77a51f"));
        }
        finally {
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
    return (<main className="min-h-screen bg-kaist-white px-6 py-12 text-kaist-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3">
          <Link to="/" className="text-sm font-semibold text-kaist-darkgreen hover:underline">{uiText("pages.login-page.3614fbb3a7")}</Link>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
              KAIST PassNi SSO
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">{uiText("pages.login-page.b45af2566e")}</h1>
            <p className="text-base font-medium leading-7 text-kaist-grey">{uiText("pages.login-page.4cd74879a7")}</p>
          </div>
        </div>

        {import.meta.env.DEV ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Start URL</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {startUrl || uiText("pages.login-page.8437fcce44")}
              </p>
            </div>
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Callback URI</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {redirectUri || uiText("pages.login-page.8437fcce44")}
              </p>
            </div>
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Start Env</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {startUrlEnv || uiText("pages.login-page.c6c6749ad9")}
              </p>
            </div>
          </div>
        </section> : null}

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" onClick={handleLogin} disabled={loading} className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:bg-kaist-grey">
              {loading ? uiText("pages.login-page.2fe0e3ce15") : uiText("pages.login-page.9e0dd27236")}
            </button>
            {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEVELOPMENT_LOGIN === 'true') ? (<>
                {([
                ['admin', uiText("pages.login-page.bdd81e0de6")],
                ['user-1', uiText("pages.login-page.9700662b8d")],
                ['user-2', uiText("pages.login-page.a318578002")],
            ] as const).map(([account, label]) => (<button key={account} type="button" onClick={() => void handleDevelopmentLogin(account)} disabled={developmentLoginLoading !== null} className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey">
                    {developmentLoginLoading === account ? uiText("pages.login-page.25b96b19a3") : label}
                  </button>))}
              </>) : null}
            <button type="button" onClick={() => void handleLogout()} disabled={logoutLoading} className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey">
              {logoutLoading ? uiText("pages.login-page.cb54388a0d") : uiText("pages.login-page.3879f078a4")}
            </button>
            {import.meta.env.DEV ? (<button type="button" onClick={() => void handleRefreshFlowTest()} disabled={refreshTestLoading} className="rounded-full border border-kaist-greygreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-greygreen transition hover:bg-kaist-greygreen hover:text-kaist-white disabled:cursor-not-allowed disabled:border-kaist-grey disabled:text-kaist-grey">
                {refreshTestLoading ? uiText("pages.login-page.1ac2b5439b") : uiText("pages.login-page.b9a28280ff")}
              </button>) : null}
          </div>

          {refreshTestMessage ? (<div className="mt-4 rounded-xl border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 p-4 text-sm font-medium text-kaist-black">
              {refreshTestMessage}
            </div>) : null}

          {errorMessage ? (<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {errorMessage}
            </div>) : null}
        </section>

        {import.meta.env.DEV ? <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight">{uiText("pages.login-page.6db8f4bcab")}</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-kaist-grey">
            <li>{uiText("pages.login-page.692ddaee41")}</li>
            <li>{uiText("pages.login-page.1fedda7749")}</li>
            <li>{uiText("pages.login-page.e82c987c18")}</li>
            <li>{uiText("pages.login-page.09a63b162c")}</li>
            <li>{uiText("pages.login-page.ff89a288cf")}</li>
          </ol>
        </section> : null}

        {hasResult ? (<section className="rounded-2xl border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 p-6 shadow-sm">
            <h2 className="text-xl font-extrabold tracking-tight">{uiText("pages.login-page.5a109fdeb9")}</h2>
            <div className="mt-4 space-y-2 text-sm font-medium text-kaist-black">
              <p>{resultMessage}</p>
            </div>
          </section>) : (<section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold tracking-tight">{uiText("pages.login-page.2926977ba7")}</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-kaist-grey">{uiText("pages.login-page.8b629693c7")}</p>
          </section>)}

        {import.meta.env.DEV ? <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight">{uiText("pages.login-page.2e45be07e1")}</h2>
          <div className="mt-4 space-y-2 text-sm font-medium text-kaist-black">
            <p>authenticated: {String(sessionSummary?.authenticated ?? false)}</p>
            <p>storageMode: {sessionSummary?.storageMode ?? uiText("pages.login-page.d58fa73adc")}</p>
            <p>
              canUsePersistentFeatures:{' '}
              {String(sessionSummary?.canUsePersistentFeatures ?? false)}
            </p>
            <p>requiresConsent: {String(sessionSummary?.requiresConsent ?? false)}</p>
            <p>userId: {sessionSummary?.userId ?? uiText("pages.login-page.d58fa73adc")}</p>
          </div>
        </section> : null}
      </div>
    </main>);
}
