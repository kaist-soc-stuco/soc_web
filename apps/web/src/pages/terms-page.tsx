import { Header } from '@/components/organisms/header';
import { useLanguage } from '@/hooks/use-language';
import { PageHeader, PageMain, PageShell } from '@/components/ui/page-layout';

const termsSections = [
  {
    titleKo: '서비스 이용',
    titleEn: 'Using the service',
    bodyKo: '이 사이트는 전산학부 학생회가 공지, 행사, 설문 및 학생회 운영 정보를 제공하기 위한 서비스입니다. 이용자는 관련 법령과 사이트 운영 원칙을 준수해야 합니다.',
    bodyEn: 'This site provides School of Computing Student Council notices, events, surveys, and operating information. Users must follow applicable law and the site rules.',
  },
  {
    titleKo: '계정과 게시물',
    titleEn: 'Accounts and posts',
    bodyKo: '로그인 계정과 게시물은 본인이 책임지고 관리합니다. 타인의 권리를 침해하거나 사이트 운영을 방해하는 콘텐츠는 숨김·수정·보관될 수 있습니다.',
    bodyEn: 'Users are responsible for their accounts and posts. Content that violates another person’s rights or interferes with the service may be hidden, edited, or archived.',
  },
  {
    titleKo: '서비스 변경 및 문의',
    titleEn: 'Changes and contact',
    bodyKo: '학생회 운영에 따라 메뉴와 기능은 변경될 수 있습니다. 서비스 이용 또는 게시물 처리와 관련한 문의는 전산학부 학생회 운영진에게 연락해 주세요.',
    bodyEn: 'Menus and features may change as the council operates the service. Contact the School of Computing Student Council with questions about using the service or handling a post.',
  },
];

export function TermsPage() {
  const { lang } = useLanguage();

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader title={lang === 'ko' ? '이용약관' : 'Terms of Service'} />

        <section className="mx-auto w-full max-w-[var(--ui-legal-max-width)] px-5 pb-8 md:px-8">
          <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-7">
          <div className="divide-y divide-slate-100">
            {termsSections.map((section) => (
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
