import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type AdminStatusTone = "neutral" | "positive" | "warning" | "danger" | "info";

export function AdminStatusBadge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: AdminStatusTone }) {
  return (
    <Badge
      tone={tone === "positive" ? "success" : tone}
      className={cn(
        "max-w-full whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}
