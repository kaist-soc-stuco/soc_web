import { Link } from 'react-router-dom';

/**
 * 개인정보 저장 동의 화면 스켈레톤입니다.
 *
 * TODO:
 * 1. `/login` callback 결과에서 `pendingLoginToken` 또는 `status=consent-required`를 받아 이 화면으로 넘기세요.
 * 2. 동의 / 비동의 버튼을 각각 `POST /auth/login/consent`와 연결하세요.
 * 3. temporary 로그인일 때 어떤 기능이 제한되는지 문구를 명확히 넣으세요.
 */
export function LoginConsentPage() {
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
            <p>TODO: 저장할 개인정보 항목(예: 이메일, 휴대전화, SSO 식별자)을 명확히 적으세요.</p>
            <p>TODO: 비동의 시 어떤 기능이 제한되는지 사용자 언어로 설명하세요.</p>
            <p>TODO: pendingLoginToken을 어디서 받아올지(query, state, session) 먼저 결정하세요.</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              disabled
              className="rounded-full bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-white disabled:bg-kaist-grey"
            >
              동의하고 저장
            </button>
            <button
              type="button"
              disabled
              className="rounded-full border border-kaist-darkgreen px-6 py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen disabled:border-kaist-grey disabled:text-kaist-grey"
            >
              저장하지 않고 계속
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
