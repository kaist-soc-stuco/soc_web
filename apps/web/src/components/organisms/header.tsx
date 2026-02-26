import { useState } from 'react';

export function Header() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const navItems = [
    {
      label: '게시판',
      href: '#board',
      dropdown: ['공지 게시판', '행사 게시판', 'HoC 게시판', '홍보 게시판', '건의사항', '연구실 게시판', 'QnA'],
    },
    {
      label: '행사 / 설문조사',
      href: '#events',
      dropdown: ['진행중인 행사', '완료된 행사', '설문조사'],
    },
    {
      label: 'About',
      href: '#about',
      dropdown: ['소개', '연혁', '조직도', '구성원'],
    },
  ];

  return (
    <header 
      className="flex-shrink-0 z-50 bg-kaist-white border-b border-kaist-black relative"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex h-14 w-full items-stretch justify-between pl-12 pr-6">
        {/* Navigation */}
        <nav className="hidden md:flex items-stretch">
          {navItems.map((item, index) => (
            <div
              key={index}
              className="relative group"
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <a 
                href={item.href} 
                className="relative flex items-center justify-center w-48 h-full text-sm lg:text-base font-extrabold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors"
              >
                <span className="py-2">{item.label}</span>
                <span 
                  className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${
                    hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </a>
            </div>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-6">
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <a 
            href="#login" 
            className="relative flex items-center text-sm lg:text-base font-extrabold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors group"
          >
            <span className="py-2">로그인</span>
            <span className="absolute bottom-0 left-0 right-0 h-1 scale-x-0 bg-kaist-darkgreen-main transition-transform duration-200 origin-center group-hover:scale-x-100" />
          </a>
        </div>
      </div>

      {/* Full Dropdown Menu - DDP Style */}
      <div 
        className={`absolute left-0 w-full bg-kaist-white shadow-lg overflow-hidden transition-all duration-300 ease-out ${
          hoveredIndex !== null 
            ? 'max-h-96 opacity-100 translate-y-0' 
            : 'max-h-0 opacity-0 -translate-y-4'
        }`}
        style={{ top: 'calc(100% + 1px)', zIndex: 40 }}
      >
        <div className="flex pl-12 gap-0">
          {navItems.map((item, index) => (
            <div
              key={index}
              className={`w-48 px-4 ${
                index === 0 ? 'border-l border-kaist-grey/30' : ''
              } ${
                index < navItems.length - 1 ? 'border-r border-kaist-grey/30' : 'border-r border-kaist-grey/30'
              }`}
            >
              <ul className="space-y-1">
                {item.dropdown.map((subItem, subIndex) => (
                  <li 
                    key={subIndex}
                    className={`transition-all duration-200 pb-1 mx-2 ${
                      hoveredIndex !== null 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 -translate-x-2'
                    } ${
                      subIndex < item.dropdown.length - 1 ? 'border-b border-kaist-grey/30' : 'pb-10'
                    } ${
                      subIndex === 0 ? 'pt-1' : ''
                    }` }
                    style={{
                      transitionDelay: hoveredIndex !== null ? `${(index * 80) + (subIndex * 40) + 80}ms` : '0ms',
                    }}
                  >
                    <a
                      href={`${item.href}/${subItem}`}
                      className={`block text-sm font-semibold tracking-tight text-center py-2 transition-all ${
                        hoveredIndex === index
                          ? 'text-kaist-black hover:text-kaist-darkgreen-main hover:translate-x-1'
                          : 'text-kaist-grey'
                      }`}
                    >
                      {subItem}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
