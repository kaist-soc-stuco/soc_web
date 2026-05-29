import { Header } from '@/components/organisms/header';
import { Footer } from '@/components/organisms/footer';

const privacySections = [
  {
    title: '수집하는 정보',
    body: '전산학부 집행위원회 사이트는 SSO 로그인 과정에서 제공되는 이름, 이메일, 학번, 학과 등 서비스 운영에 필요한 기본 정보를 사용합니다.',
  },
  {
    title: '이용 목적',
    body: '수집된 정보는 게시글 작성, 설문 참여, 권한 확인, 학생회 운영 공지 및 문의 대응 등 사이트 기능 제공을 위해 사용됩니다.',
  },
  {
    title: '보관 및 관리',
    body: '개인정보는 서비스 운영에 필요한 기간 동안 보관되며, 접근 권한은 운영상 필요한 관리자에게만 제한됩니다.',
  },
  {
    title: '문의',
    body: '개인정보 처리와 관련한 문의는 전산학부 학생회 운영진에게 연락해 주세요.',
  },
];

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-8">
        <section className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-kaist-black">개인정보처리방침</h1>
          <p className="mt-2 text-sm font-semibold text-kaist-grey">
            전산학부 집행위원회 사이트 운영에 필요한 개인정보 처리 기준을 안내합니다.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="divide-y divide-slate-100">
            {privacySections.map((section) => (
              <article key={section.title} className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[10rem_1fr]">
                <h2 className="text-sm font-extrabold text-kaist-black">{section.title}</h2>
                <p className="text-sm leading-6 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
