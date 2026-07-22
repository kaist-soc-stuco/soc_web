import { useState, useEffect, useRef } from 'react';

export function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // TODO: MySQL에서 Hero 배경 이미지 가져오기
  // useEffect(() => {
  //   const fetchHeroImages = async () => {
  //     try {
  //       const response = await fetch('/api/hero-images');
  //       const data = await response.json();
  //       // data 형식 예상: [{ id: 1, imageUrl: '/uploads/hero_1.jpg', order: 1 }, ...]
  //       const imageUrls = data.map((item: any) => item.imageUrl);
  //       setOriginalImages(imageUrls);
  //     } catch (error) {
  //       console.error('Failed to fetch hero images:', error);
  //       // 에러 시 기본 이미지 사용
  //     }
  //   };
  //   
  //   fetchHeroImages();
  // }, []);

  // 임시 하드코딩된 이미지 
  const originalImages = [
    '/hero_background_1.jpg',
    '/hero_background2.jpeg',
    '/hero_background3.jpeg',
    '/hero_background4.jpeg',
  ];

  // 무한 루프를 위해 첫 번째와 마지막 이미지를 양 끝에 추가
  const images = [
    originalImages[originalImages.length - 1], // 마지막 이미지 복사
    ...originalImages,
    originalImages[0], // 첫 번째 이미지 복사
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => prevIndex + 1);
    }, 5000); // 5초마다 이미지 변경

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 마지막 복사본에 도달하면 첫 번째 실제 이미지로 점프
    if (currentImageIndex === images.length - 1) {
      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentImageIndex(1);
      }, 800); // transition 완료 후
    }
    // 첫 번째 복사본에 도달하면 마지막 실제 이미지로 점프
    else if (currentImageIndex === 0) {
      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentImageIndex(images.length - 2);
      }, 800); // transition 완료 후
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentImageIndex, images.length]);

  useEffect(() => {
    // transition 없이 점프한 후 다시 transition 활성화
    if (!isTransitioning) {
      const timeout = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isTransitioning]);

  return (
    <section className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
      {/* Background Images - Sliding */}
      <div 
        className="absolute inset-0 flex"
        style={{
          transform: `translateX(-${currentImageIndex * 100}%)`,
          transition: isTransitioning ? 'transform 800ms ease-in-out' : 'none',
        }}
      >
        {images.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="w-full h-full flex-shrink-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
        ))}
      </div>
      
      {/* Logo section */}
      <div className="relative z-10 flex h-16 items-center justify-start px-6 lg:h-[85px] lg:px-7">
        <div className="flex items-center gap-2 md:gap-4">
          <img 
            src="/kaist_logo.png" 
            alt="KAIST Logo" 
            className="h-6 w-auto lg:h-[39px]"
          />
          <div className="h-6 w-px bg-gray-300 lg:h-5" />
          <img 
            src="/logo.png" 
            alt="SOC Logo" 
            className="h-7 w-auto lg:h-[42px]"
          />
        </div>
      </div>

      {/* Content - Vertically centered */}
      <div className="absolute inset-0 z-10 flex items-center px-8 md:px-12 lg:px-[15.6%]">
        <div className="flex max-w-7xl items-start gap-6 lg:gap-8">
          {/* Green Accent Bar */}
          <div className="mt-5 h-11 w-3 bg-kaist-lightgreen2 lg:mt-11 lg:h-[54px] lg:w-[11px]" />
          
          {/* Title */}
          <h1 
            className="mt-1 max-w-md text-4xl font-black leading-[150%] tracking-normal text-kaist-white md:text-5xl lg:mt-4 lg:max-w-xl lg:text-[72px]"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            KAIST
            <br />
            School Of
            <br />
            Computing
          </h1>
        </div>
      </div>
    </section>
  );
}
