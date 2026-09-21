import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';

export function HomePage() {
  return (
    <div className="home-page-shell flex min-h-screen flex-col overflow-x-clip bg-white">
      <Header variant="home" />
      <main className="channel-talk-safe-area flex-1">
        <Hero />

        <div className="home-public-content">
          <EventCarousel />
        </div>

        <div className="home-updates-section">
          <div className="home-public-content">
            <div className="home-updates-grid">
              <div className="min-w-0">
                <NoticeBoard />
              </div>
              <div className="min-w-0">
                <Calendar />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
