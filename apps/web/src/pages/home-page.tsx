import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';

export function HomePage() {
  return (
    <div
      className="home-page-shell home-viewport-height flex min-h-screen flex-col overflow-x-hidden bg-background lg:overflow-x-hidden lg:overflow-y-auto"
    >
      <Header variant="home" />
      <div className="home-page-body -mt-[var(--ui-header-height)] flex flex-1 min-h-0">
        {/* Left Hero Image */}
        <aside className="home-hero-column hidden h-full shrink-0 self-stretch md:block">
          <Hero />
        </aside>

        {/* Right Side - Main Content */}
        <div className="home-main-column flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[var(--ui-surface-canvas)] pt-[var(--ui-header-height)] lg:h-full lg:min-h-0">
          <main className="channel-talk-safe-area flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden px-6 py-4 lg:min-h-0 lg:overflow-visible lg:px-8">
            {/* Event Carousel */}
            <div className="home-event-section home-mobile-section min-w-0 shrink-0 overflow-hidden">
              <EventCarousel />
            </div>
            
            {/* Board and calendar share the lower bento row equally. */}
            <div className="home-lower-widgets flex min-w-0 flex-col items-stretch gap-4 pb-1 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
              <div className="home-mobile-section min-w-0 lg:h-full lg:flex-1 lg:self-stretch">
                <NoticeBoard />
              </div>
              <div className="home-mobile-section min-w-0 lg:flex-1 lg:h-full lg:min-h-0 lg:self-stretch">
                <Calendar />
              </div>
            </div>
          </main>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
