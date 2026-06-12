import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';

export function HomePage() {
  return (
    <div 
      className="min-h-screen bg-[#fafafa] flex flex-col select-none lg:h-screen lg:overflow-hidden"
    >
      <div className="flex flex-1 min-h-0">
        {/* Left Hero Image */}
        <aside className="hidden lg:block lg:w-[30%] h-full border-r border-kaist-grey/15 shrink-0">
          <Hero />
        </aside>

        {/* Right Side - Main Content */}
        <div className="w-full min-h-screen flex flex-col bg-[linear-gradient(180deg,#ffffff_0%,#f8faf9_100%)] lg:w-[70%] lg:h-full lg:min-h-0">
          <Header />
          <main className="flex-1 flex flex-col gap-5 overflow-y-auto px-6 py-5 lg:min-h-0 lg:overflow-hidden lg:px-8">
            {/* Event Carousel */}
            <div className="min-h-[350px] shrink-0 md:min-h-[400px]">
              <EventCarousel />
            </div>
            
            {/* Notice & Calendar Side by Side with elegant margin and generous gaps */}
            <div className="flex flex-col gap-7 pb-2 lg:flex-1 lg:min-h-0 lg:flex-row">
              <div className="lg:flex-[1.6] lg:h-full lg:min-h-0">
                <NoticeBoard />
              </div>
              <div className="lg:flex-1 lg:h-full lg:min-h-0">
                <Calendar />
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
