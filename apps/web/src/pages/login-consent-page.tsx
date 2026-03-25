import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  clearStoredAuthState,
  readStoredAuthState,
  writeStoredAuthState,
} from '@/lib/auth-storage';

const withNoTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveConsentEndpoint = (): string => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (apiBaseUrl) {
    return `${withNoTrailingSlash(apiBaseUrl)}/auth/login/consent`;
  }

  const startUrl = (import.meta.env.VITE_SSO_START_URL as string | undefined)?.trim();
  if (startUrl) {
    try {
      const parsed = new URL(startUrl);
      const path = parsed.pathname.replace(/\/auth\/login\/start$/, '/auth/login/consent');
      return `${parsed.origin}${path}`;
    } catch {
      return '/api/auth/login/consent';
    }
  }

  return '/api/auth/login/consent';
};

/**
 * 개인정보 저장 동의 화면 스켈레톤입니다.
 *
 * TODO:
 * 1. `/login` callback 결과에서 `pendingLoginToken` 또는 `status=consent-required`를 받아 이 화면으로 넘기세요.
 * 2. 동의 / 비동의 버튼을 각각 `POST /auth/login/consent`와 연결하세요.
 * 3. temporary 로그인일 때 어떤 기능이 제한되는지 문구를 명확히 넣으세요.
 */
export function LoginConsentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const [submitting, setSubmitting] = useState<null | 'persisted' | 'temporary'>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const response = await fetch(resolveConsentEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consent,
          pendingLoginToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`동의 처리 요청이 실패했습니다. HTTP ${response.status}`);
      }

      const body = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
        sessionId?: string;
        storageMode: 'persisted' | 'temporary';
        userId?: string;
      };

      writeStoredAuthState({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        sessionId: body.sessionId,
        storageMode: body.storageMode,
        userId: body.userId,
      });

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
