import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';

export function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-kaist-white lg:h-dvh lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="h-[42dvh] min-h-[360px] lg:hidden">
          <Hero />
        </section>

        {/* Left Hero Image */}
        <aside className="hidden lg:block lg:h-dvh lg:basis-[34.375%]">
          <Hero />
        </aside>

        {/* Right Side - Main Content */}
        <div className="flex w-full min-w-0 flex-col lg:h-dvh lg:basis-[65.625%]">
          <Header />
          <main className="flex flex-1 min-h-0 flex-col overflow-y-auto lg:overflow-hidden">
            {/* Event Carousel */}
            <div className="min-h-[360px] flex-none lg:min-h-0 lg:flex-[1.36]">
              <EventCarousel />
            </div>
            
            {/* Notice & Calendar Side by Side */}
            <div className="flex flex-1 flex-col gap-6 px-6 pb-7 pt-3 md:px-8 lg:min-h-0 lg:flex-row lg:gap-10 lg:px-14 lg:pb-8">
              <div className="min-h-0 flex-[2]">
                <NoticeBoard />
              </div>
              <div className="min-h-[300px] flex-1 lg:min-h-0">
                <Calendar clickable />
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Footer - Full width */}
      {/*<Footer />*/}
    </div>
  );
}
