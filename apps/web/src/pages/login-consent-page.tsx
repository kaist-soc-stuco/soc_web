import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';

import {
  clearStoredAuthState,
  readStoredAuthState,
  writeStoredAuthState,
} from '@/lib/auth-storage';

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

export function LoginConsentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const [submitting, setSubmitting] = useState<null | 'persisted' | 'temporary'>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const pendingLoginToken = useMemo(() => {
    const queryToken = query.get('pendingLoginToken');
    if (queryToken) {
      return queryToken;
    }

    const stored = readStoredAuthState();
    return stored?.pendingLoginToken ?? null;
  }, [query]);

  const submitDecision = async (consent: boolean) => {
    if (!pendingLoginToken) {
      setErrorMessage('pendingLoginToken이 없습니다. 로그인부터 다시 진행해 주세요.');
      return;
    }

    setSubmitting(consent ? 'persisted' : 'temporary');
    setErrorMessage(null);

    try {
      const payload = await apiClient.submitConsentDecision({
        consent,
        pendingLoginToken,
      });

      if (payload.storageMode === 'temporary') {
        writeStoredAuthState({
          temporarySession: payload.temporarySession,
        });
      } else {
        clearStoredAuthState();
      }

      navigate('/login?status=success&reason=consent_processed', {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '동의 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <main className="min-h-screen bg-kaist-white px-6 py-12 text-kaist-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3">
          <Link to="/login" className="text-sm font-semibold text-kaist-darkgreen hover:underline">
            로그인 화면으로 돌아가기
          </Link>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
              Privacy Consent
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">개인정보 저장 동의</h1>
            <p className="text-base font-medium leading-7 text-kaist-grey">
              이 화면은 SSO 로그인 직후 개인정보를 영구 저장할지 묻는 단계입니다.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <div className="space-y-4 text-sm font-medium leading-7 text-kaist-grey">
            <p>저장 항목: SSO 식별자, 이메일, 휴대전화</p>
            <p>비동의 시에는 temporary 모드로 로그인되며, 개인정보 영구 저장이 필요한 기능은 제한됩니다.</p>
            <p>pendingLoginToken: {pendingLoginToken ?? '없음'}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              disabled={!pendingLoginToken || submitting !== null}
              onClick={() => void submitDecision(true)}
              className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white disabled:bg-kaist-grey"
            >
              {submitting === 'persisted' ? '처리 중...' : '동의하고 저장'}
            </button>
            <button
              type="button"
              disabled={!pendingLoginToken || submitting !== null}
              onClick={() => void submitDecision(false)}
              className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen disabled:border-kaist-grey disabled:text-kaist-grey"
            >
              {submitting === 'temporary' ? '처리 중...' : '저장하지 않고 계속'}
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6">
            <button
              type="button"
              onClick={clearStoredAuthState}
              className="text-sm font-semibold text-kaist-greygreen underline"
            >
              저장된 로그인 상태 초기화
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
