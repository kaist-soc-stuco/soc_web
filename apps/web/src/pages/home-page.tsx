import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';
import { useLanguage } from '@/hooks/use-language';

export function HomePage() {
  const { lang } = useLanguage();

  return (
    <div className="home-page-shell flex min-h-screen flex-col overflow-x-hidden bg-white">
      <Header variant="home" />
      <main className="channel-talk-safe-area flex-1">
        <Hero />

        <div className="home-public-content">
          <EventCarousel />
        </div>

        <section className="home-updates-section" aria-labelledby="home-updates-title">
          <div className="home-public-content">
            <div className="home-section-heading">
              <h2 id="home-updates-title">{lang === 'ko' ? '소식과 일정' : 'News and schedule'}</h2>
            </div>
            <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
              <div className="min-w-0">
                <NoticeBoard />
              </div>
              <div className="min-w-0">
                <Calendar />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
