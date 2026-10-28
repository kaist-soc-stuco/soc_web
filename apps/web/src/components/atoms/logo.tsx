import { Link } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePublicContentBlocksByType } from '@/features/site-content/site-content';
import { resolveAssetUrl } from '@/lib/asset-url';

export function Logo({ inverse = false }: { inverse?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const customLogo = usePublicContentBlocksByType("LOGO")[0];
  const customLogoUrl = customLogo?.imageUrl && !imageFailed
    ? resolveAssetUrl(customLogo.imageUrl)
    : null;

  return (
    <Link
      to="/"
      className="select-none flex items-center gap-4 transition-opacity hover:opacity-90"
    >
      <img
        src="/kaist_logo.png"
        alt="KAIST Logo"
        className={cn(
          "h-6 w-auto transition-[filter] duration-300 ease-out",
          inverse && "brightness-0 invert",
        )}
      />
      <div
        className={cn(
          "h-6 w-px transition-colors duration-300 ease-out",
          inverse ? "bg-white/30" : "bg-slate-300",
        )}
      />
      {customLogoUrl ? (
        <img
          src={customLogoUrl}
          alt={customLogo?.titleKo || "SoC Student Council"}
          onError={() => setImageFailed(true)}
          className={cn(
            "h-6 w-auto max-w-[9rem] object-contain transition-[filter] duration-300 ease-out",
            inverse && "brightness-0 invert",
          )}
        />
      ) : (
        <DefaultCouncilLogo inverse={inverse} />
      )}
    </Link>
  );
}

export function DefaultCouncilLogo({ inverse = false, preview = false }: { inverse?: boolean; preview?: boolean }) {
  return <span className={cn("inline-flex shrink-0 items-center leading-none", preview ? "gap-4" : "gap-2")} role="img" aria-label="TREE · SoC Student Council">
          <img src="/tree-leaf.png" alt="" aria-hidden="true" className={cn("w-auto object-contain", preview ? "h-20 md:h-24" : "h-7 md:h-8")} />
          <strong
            className={cn(
              "font-bold tracking-[0.12em] transition-colors duration-300 ease-out",
              preview ? "text-5xl md:text-6xl" : "hidden text-xl md:inline",
              inverse ? "text-white" : "text-kaist-darkgreen",
            )}
          >
            TREE
          </strong>
        </span>;
}
