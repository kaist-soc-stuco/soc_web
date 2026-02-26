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
    '/hero_background_2.jpg',
    '/hero_background_3.jpg',
    '/hero_background_4.jpg',
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
      <div className="relative z-10 flex h-16 items-center justify-start px-8 mt-2">
        <div className="flex items-center gap-2 md:gap-4">
          <img 
            src="/kaist_logo.png" 
            alt="KAIST Logo" 
            className="h-6 w-auto"
          />
          <div className="h-6 w-px bg-gray-300 mb-1" />
          <img 
            src="/logo.png" 
            alt="KAIST Logo" 
            className="h-7 w-auto mb-2"
          />
        </div>
      </div>

      {/* Content - Vertically centered */}
      <div className="absolute inset-0 z-10 flex items-center px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl flex items-start gap-8">
          {/* Green Accent Bar */}
          <div className="mt-8 h-12 w-4 bg-kaist-lightgreen2" />
          
          {/* Title */}
          <h1 
            className="mt-4 text-5xl font-black leading-[150%] tracking-[-0.011em] text-kaist-white max-w-md md:max-w-lg lg:max-w-xl"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            KAIST School Of Computing
          </h1>
        </div>
      </div>
    </section>
  );
}
