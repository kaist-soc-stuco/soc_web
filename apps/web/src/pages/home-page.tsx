import { Header } from '@/components/organisms/header';
import { Hero } from '@/components/organisms/hero';
import { EventCarousel } from '@/components/organisms/event-carousel';
import { NoticeBoard } from '@/components/organisms/notice-board';
import { Calendar } from '@/components/organisms/calendar';
import { Footer } from '@/components/organisms/footer';

export function HomePage() {
  return (
    <div 
      className="bg-kaist-white min-h-screen flex flex-col" 
    >
      <div className="flex flex-1">
        {/* Left Hero Image - 1/3 width, scrolls with content */}
        <aside className="hidden lg:block lg:w-1/3 min-h-screen">
          <Hero />
        </aside>

        {/* Right Side - Main Content (2/3) */}
        <div className="w-full lg:w-2/3">
          <Header />
          <main className="flex flex-col">
            {/* Event Carousel */}
            <div className="min-h-[300px]">
              <EventCarousel />
            </div>
            
            {/* Notice & Calendar Side by Side */}
            <div className="flex flex-col lg:flex-row gap-4 px-6 lg:px-8 py-4">
              <div className="flex-[2]">
                <NoticeBoard />
              </div>
              <div className="flex-1">
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
