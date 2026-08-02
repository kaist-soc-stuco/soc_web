import { uiText } from "@/lib/i18n/surface-catalog";
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import { beginAuthSessionTransition, getAuthSessionSummary } from '@/lib/auth-session';
import { refetchAdminGrants } from '@/lib/admin-grants';
import { loadBoardCatalog } from '@/lib/board-catalog';
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
export function LoginConsentPage() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState<null | 'persisted' | 'temporary'>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
    const submitDecision = async (consent: boolean) => {
        setSubmitting(consent ? 'persisted' : 'temporary');
        setErrorMessage(null);
        try {
            await apiClient.submitConsentDecision({ consent });
            beginAuthSessionTransition();
            await getAuthSessionSummary(apiClient);
            void loadBoardCatalog().catch(() => undefined);
            void refetchAdminGrants().catch(() => undefined);
            navigate('/login?status=success&reason=consent_processed', {
                replace: true,
            });
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : uiText("pages.login-consent-page.80e4aaf4ea"));
        }
        finally {
            setSubmitting(null);
        }
    };
    return (<main className="min-h-screen bg-kaist-white px-6 py-12 text-kaist-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3">
          <Link to="/login" className="text-sm font-semibold text-kaist-darkgreen hover:underline">{uiText("pages.login-consent-page.964d15367f")}</Link>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
              Privacy Consent
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">{uiText("pages.login-consent-page.57701d6b2e")}</h1>
            <p className="text-base font-medium leading-7 text-kaist-grey">{uiText("pages.login-consent-page.6ea9a25b73")}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <div className="space-y-4 text-sm font-medium leading-7 text-kaist-grey">
            <p>{uiText("pages.login-consent-page.6a9e799be0")}</p>
            <p>{uiText("pages.login-consent-page.d9cc573162")}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button type="button" disabled={submitting !== null} onClick={() => void submitDecision(true)} className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white disabled:bg-kaist-grey">
              {submitting === 'persisted' ? uiText("pages.login-consent-page.e6e1a2914f") : uiText("pages.login-consent-page.31f9f29576")}
            </button>
            <button type="button" disabled={submitting !== null} onClick={() => void submitDecision(false)} className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen disabled:border-kaist-grey disabled:text-kaist-grey">
              {submitting === 'temporary' ? uiText("pages.login-consent-page.e6e1a2914f") : uiText("pages.login-consent-page.f38ec52aaf")}
            </button>
          </div>

          {errorMessage ? (<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {errorMessage}
            </div>) : null}

        </section>
      </div>
    </main>);
}
