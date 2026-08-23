import { Link } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePublicContentBlocksByType } from '@/features/site-content/site-content';
import { resolveAssetUrl } from '@/lib/asset-url';

export function Logo({ inverse = false }: { inverse?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const customLogo = usePublicContentBlocksByType("LOGO")[0];
  const imageUrl = customLogo?.imageUrl && !imageFailed
    ? resolveAssetUrl(customLogo.imageUrl)
    : "/kaist_logo.png";

  return (
    <Link
      to="/"
      className="flex items-center gap-4 transition-opacity hover:opacity-90"
    >
      <img
        src={imageUrl}
        alt={customLogo?.titleKo || "KAIST Logo"}
        onError={() => setImageFailed(true)}
        className={cn("h-6 w-auto", inverse && "brightness-0 invert")}
      />
      <div className={cn("h-6 w-px", inverse ? "bg-white/30" : "bg-slate-300")} />
      <span className="flex flex-col leading-none" aria-label="SOC Student Council">
        <span className={cn("text-xl font-bold tracking-[-0.04em]", inverse ? "text-white" : "text-kaist-darkgreen")}>
          SOC
        </span>
        <span className={cn("mt-0.5 whitespace-nowrap text-[7px] font-bold uppercase tracking-[0.18em]", inverse ? "text-white/70" : "text-kaist-grey")}>
          Student Council
        </span>
      </span>
    </Link>
  );
}
