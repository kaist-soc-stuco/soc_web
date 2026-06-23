type PageHeroVariant = "large" | "medium" | "compact";

interface PageHeroProps {
  title: string;
  description: string;
  titleClassName?: string;
  descriptionClassName?: string;
  maxWidthClassName?: string;
  variant?: PageHeroVariant;
}

const heroVariantClass: Record<PageHeroVariant, string> = {
  large: "page-hero-large",
  medium: "page-hero-medium",
  compact: "page-hero-compact",
};

const titleScaleByVariant: Record<PageHeroVariant, string> = {
  large: "text-3xl md:text-4xl",
  medium: "text-2xl md:text-3xl",
  compact: "text-xl md:text-2xl",
};

const descriptionScaleByVariant: Record<PageHeroVariant, string> = {
  large: "text-sm md:text-base",
  medium: "text-[13px] md:text-sm",
  compact: "text-xs md:text-[13px]",
};

export function PageHero({
  title,
  description,
  titleClassName,
  descriptionClassName,
  maxWidthClassName = "max-w-7xl",
  variant = "medium",
}: PageHeroProps) {
  const resolvedTitleClassName = titleClassName ?? titleScaleByVariant[variant];
  const resolvedDescriptionClassName =
    descriptionClassName ?? descriptionScaleByVariant[variant];

  return (
    <section className={`page-hero-surface ${heroVariantClass[variant]} text-white`}>
      <div className={`${maxWidthClassName} mx-auto relative z-10 flex flex-col items-start gap-2 px-6 md:gap-3 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
        <h1 className={`font-bold tracking-tight font-outfit ${resolvedTitleClassName}`}>
          {title}
        </h1>
        <p className={`${resolvedDescriptionClassName} max-w-3xl font-medium leading-relaxed text-white/78`}>
          {description}
        </p>
      </div>
    </section>
  );
}
