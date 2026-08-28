import { Header } from '@/components/organisms/header';
import { useLanguage } from '@/hooks/use-language';
import { PageHeader, PageMain, PageShell } from '@/components/ui/page-layout';

const privacySections = [
  {
    titleKo: '수집하는 정보',
    titleEn: 'Information We Collect',
    bodyKo: '전산학부 집행위원회 사이트는 SSO 로그인 과정에서 제공되는 이름, 이메일, 학번, 소속 등 서비스 운영에 필요한 기본 정보를 사용합니다.',
    bodyEn: 'The SoC Student Council website uses basic information provided through SSO, including your name, email address, student number, and affiliation.',
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
    bodyKo: '개인정보 처리와 관련한 문의는 전산학부 집행위원회 운영진에게 연락해 주세요.',
    bodyEn: 'For questions about the handling of personal information, contact the SoC Student Council.',
  },
];

export function PrivacyPage() {
  const { lang } = useLanguage();

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader title={lang === 'ko' ? '개인정보처리방침' : 'Privacy Policy'} />

        <section className="mx-auto w-full max-w-[var(--ui-legal-max-width)] px-5 pb-8 md:px-8">
          <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-7">
          <div className="divide-y divide-slate-100">
            {privacySections.map((section) => (
              <article key={section.titleEn} className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[10rem_1fr]">
                <h2 className="text-sm font-semibold text-kaist-black">
                  {lang === 'ko' ? section.titleKo : section.titleEn}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  {lang === 'ko' ? section.bodyKo : section.bodyEn}
                </p>
              </article>
            ))}
          </div>
          </div>
        </section>
      </PageMain>
    </PageShell>
  );
}
