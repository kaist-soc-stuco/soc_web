import { Link, useLocation } from 'react-router-dom';

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

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

  const redirectUri = import.meta.env.VITE_SSO_REDIRECT_URI ?? '';
  const startUrl = deriveStartUrl(redirectUri);

  const status = searchParams.get('status');
  const reason = searchParams.get('reason');
  const errorCode = searchParams.get('errorCode');
  const userId = searchParams.get('userId');
  const resultMessage = getResultMessage(searchParams);

  const handleLogin = () => {
    if (!startUrl || typeof window === 'undefined') {
      return;
    }

    window.location.assign(startUrl);
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
              이 페이지는 서버의 `/api/auth/login/start`로 이동해 SSO 로그인을 시작하고, 완료 후에는
              `/api/auth/login`에서 처리된 결과를 조회합니다.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Callback URI</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {redirectUri || '설정되지 않음'}
              </p>
            </div>
            <div className="rounded-xl bg-kaist-darkgreen/6 p-4">
              <p className="text-sm font-semibold text-kaist-greygreen">Start Endpoint</p>
              <p className="mt-2 break-all text-sm font-semibold text-kaist-black">
                {startUrl || '설정되지 않음'}
              </p>
            </div>
          </div>

          {!startUrl ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              `VITE_SSO_REDIRECT_URI`가 올바른 URL 형식이 아닙니다.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={!startUrl}
              className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:bg-kaist-grey"
            >
              SSO 로그인 시작
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight">서버 흐름</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-kaist-grey">
            <li>브라우저가 `/api/auth/login/start`로 이동합니다.</li>
            <li>서버가 `state`와 `nonce`를 생성해 Redis에 저장하고 SSO authorize로 `POST`합니다.</li>
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
