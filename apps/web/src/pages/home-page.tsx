import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';

export function HomePage() {
  return (
    <div 
      className="bg-[#fafafa] h-screen overflow-hidden flex flex-col select-none" 
    >
      <div className="flex flex-1 min-h-0">
        {/* Left Hero Image - 1/3 width, fills height */}
        <aside className="hidden lg:block lg:w-1/3 h-full border-r border-kaist-grey/15 shrink-0">
          <Hero />
        </aside>

        {/* Right Side - Main Content (2/3) */}
        <div className="w-full lg:w-2/3 h-full flex flex-col min-h-0">
          <Header />
          <main className="flex-1 min-h-0 flex flex-col py-4 px-6 lg:px-8 gap-5 justify-between">
            {/* Event Carousel */}
            <div className="shrink-0">
              <EventCarousel />
            </div>
            
            {/* Notice & Calendar Side by Side with elegant margin and generous gaps */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-8 pb-2">
              <div className="flex-[1.6] h-full min-h-0">
                <NoticeBoard />
              </div>
              <div className="flex-1 h-full min-h-0">
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
