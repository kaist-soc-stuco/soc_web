import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

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

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

const getStartPayloadFromJson = async (response: Response): Promise<SsoStartPayload> => {
  const body = (await response.json()) as Record<string, unknown>;

  return {
    action: readString(
      body.action || body.loginUrl || body.login_url || body.authorizeUrl || body.serverUrl,
    ),
    clientId: readString(body.clientId || body.client_id || body.clientID),
    nonce: readString(body.nonce),
    redirectUri: readString(body.redirectUri || body.redirect_uri),
    state: readString(body.state),
  };
};

const getStartPayloadFromHtml = async (response: Response): Promise<SsoStartPayload> => {
  const html = await response.text();
  const document = new DOMParser().parseFromString(html, 'text/html');
  const form = document.querySelector('form');

  if (!form) {
    throw new Error('SSO start payload에 form이 없습니다.');
  }

  const readInputValue = (name: string): string =>
    document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? '';

  return {
    action: form.getAttribute('action') ?? '',
    clientId: readInputValue('client_id'),
    nonce: readInputValue('nonce'),
    redirectUri: readInputValue('redirect_uri'),
    state: readInputValue('state'),
  };
};

const readStartPayload = async (response: Response): Promise<SsoStartPayload> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return getStartPayloadFromJson(response);
  }

  return getStartPayloadFromHtml(response);
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

const getResultMessage = (searchParams: URLSearchParams): string => {
  const message =
    searchParams.get('message') ??
    searchParams.get('reason') ??
    searchParams.get('error') ??
    searchParams.get('detail') ??
    searchParams.get('description');

  if (message) {
    return message;
  }

  const status = searchParams.get('status');
  if (status === 'success') {
    return '로그인이 완료되었습니다.';
  }
  if (status === 'error') {
    return '로그인 중 오류가 발생했습니다.';
  }

  return '표시할 결과가 없습니다.';
};

export function TreeLogin() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startUrlEnv = import.meta.env.VITE_SSO_START_URL ?? '';
  const redirectUri = import.meta.env.VITE_SSO_REDIRECT_URI ?? '';
  const startUrl = resolveStartUrl(startUrlEnv, redirectUri);

  const status = searchParams.get('status');
  const reason = searchParams.get('reason');
  const errorCode = searchParams.get('errorCode');
  const userId = searchParams.get('userId');
  const resultMessage = getResultMessage(searchParams);

  const handleLogin = async () => {
    if (!startUrl || typeof window === 'undefined') {
      setErrorMessage('SSO 시작 URL을 만들 수 없습니다.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(startUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json, text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`로그인 시작 요청이 실패했습니다. HTTP ${response.status}`);
      }

      const payload = await readStartPayload(response);

      if (
        !payload.action ||
        !payload.clientId ||
        !payload.nonce ||
        !payload.redirectUri ||
        !payload.state
      ) {
        throw new Error('SSO 시작 payload가 불완전합니다.');
      }

      submitAuthorizeForm(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인 시작 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const hasResult = Boolean(
    status ||
      searchParams.get('message') ||
      searchParams.get('reason') ||
      searchParams.get('error') ||
      searchParams.get('errorCode'),
  );

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

          {!startUrl ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              `VITE_SSO_START_URL` 또는 `VITE_SSO_REDIRECT_URI`로부터 시작 URL을 만들 수 없습니다.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={!startUrl || loading}
              className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:bg-kaist-grey"
            >
              {loading ? 'SSO 로그인 진행 중' : 'SSO 로그인 시작'}
            </button>
          </div>

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
              <p>status: {status ?? '없음'}</p>
              <p>message: {resultMessage}</p>
              <p>reason: {reason ?? '없음'}</p>
              <p>errorCode: {errorCode ?? '없음'}</p>
              <p>userId: {userId ?? '없음'}</p>
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
      </div>
    </main>
  );
}
