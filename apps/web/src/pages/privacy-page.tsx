import { Header } from '@/components/organisms/header';
import { Footer } from '@/components/organisms/footer';
import { useLanguage } from '@/hooks/use-language';

const privacySections = [
  {
    titleKo: '수집하는 정보',
    titleEn: 'Information We Collect',
    bodyKo: '전산학부 학생회 사이트는 SSO 로그인 과정에서 제공되는 이름, 이메일, 학번, 소속 등 서비스 운영에 필요한 기본 정보를 사용합니다.',
    bodyEn: 'The School of Computing Student Council website uses basic information provided through SSO, including your name, email address, student number, and affiliation.',
  },
  {
    titleKo: '이용 목적',
    titleEn: 'How We Use It',
    bodyKo: '수집된 정보는 게시글 작성, 설문 참여, 권한 확인, 학생회 운영 공지 및 문의 대응 등 사이트 기능 제공을 위해 사용됩니다.',
    bodyEn: 'We use this information to provide site features such as posting, survey participation, access checks, council announcements, and inquiry support.',
  },
  {
    titleKo: '보관 및 관리',
    titleEn: 'Retention and Access',
    bodyKo: '개인정보는 서비스 운영에 필요한 기간 동안 보관되며, 접근 권한은 운영상 필요한 관리자에게만 제한됩니다.',
    bodyEn: 'Personal information is retained only as needed to operate the service, and access is limited to authorized administrators.',
  },
  {
    titleKo: '문의',
    titleEn: 'Contact',
    bodyKo: '개인정보 처리와 관련한 문의는 전산학부 학생회 운영진에게 연락해 주세요.',
    bodyEn: 'For questions about the handling of personal information, contact the School of Computing Student Council.',
  },
];

export function PrivacyPage() {
  const { lang } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-8">
        <section className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-kaist-black">
            {lang === 'ko' ? '개인정보처리방침' : 'Privacy Policy'}
          </h1>
          <p className="mt-2 text-sm font-semibold text-kaist-grey">
            {lang === 'ko'
              ? '전산학부 학생회 사이트 운영에 필요한 개인정보 처리 기준을 안내합니다.'
              : 'Learn how the School of Computing Student Council website handles personal information.'}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="divide-y divide-slate-100">
            {privacySections.map((section) => (
              <article key={section.titleEn} className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[10rem_1fr]">
                <h2 className="text-sm font-extrabold text-kaist-black">
                  {lang === 'ko' ? section.titleKo : section.titleEn}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  {lang === 'ko' ? section.bodyKo : section.bodyEn}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
