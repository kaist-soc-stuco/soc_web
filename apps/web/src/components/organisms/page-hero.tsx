type PageHeroVariant = "large" | "medium" | "compact";
type PageHeroTone = "neutral" | "brand";

interface PageHeroProps {
  title: string;
  description?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  maxWidthClassName?: string;
  variant?: PageHeroVariant;
  tone?: PageHeroTone;
  showDescription?: boolean;
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
  tone = "neutral",
  showDescription = true,
}: PageHeroProps) {
  const resolvedTitleClassName = titleClassName ?? titleScaleByVariant[variant];
  const resolvedDescriptionClassName =
    descriptionClassName ?? descriptionScaleByVariant[variant];

  return (
    <section
      className={`page-hero-surface ${heroVariantClass[variant]} ${
        tone === "brand" ? "page-hero-brand" : ""
      }`}
      aria-labelledby="page-hero-title"
    >
      <div
        className={`${maxWidthClassName} mx-auto flex flex-col items-start gap-1.5 px-5 md:gap-2.5 md:px-8`}
      >
        <h1
          id="page-hero-title"
          className={`font-semibold tracking-tight ${resolvedTitleClassName}`}
        >
          {title}
        </h1>
        {showDescription && description ? (
          <p
            className={`${resolvedDescriptionClassName} max-w-3xl font-normal leading-relaxed ${
              tone === "brand" ? "text-white/80" : "text-app-text-muted"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
