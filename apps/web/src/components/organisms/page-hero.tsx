interface PageHeroProps {
  title: string;
  description: string;
  titleClassName?: string;
  descriptionClassName?: string;
  maxWidthClassName?: string;
}

export function PageHero({
  title,
  description,
  titleClassName = "text-3xl md:text-4xl",
  descriptionClassName = "text-sm md:text-base",
  maxWidthClassName = "max-w-7xl",
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-kaist-darkgreen to-[#002613] px-4 py-8 md:py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(113,185,141,0.16),transparent)] pointer-events-none" />
      <div className={`${maxWidthClassName} mx-auto relative z-10 flex flex-col items-start gap-2 md:gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
        <h1 className={`font-black tracking-tight font-outfit ${titleClassName}`}>
          {title}
        </h1>
        <p className={`${descriptionClassName} max-w-3xl font-medium leading-relaxed text-white/78`}>
          {description}
        </p>
      </div>
    </section>
  );
}