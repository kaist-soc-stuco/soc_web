import { LoaderCircle, Search } from "lucide-react";
import { useContext } from "react";

import { SearchLoadingContext } from "@/lib/search-loading-context";
import { cn } from "@/lib/utils";

export function SearchFieldIcon({ loading, className }: { loading?: boolean; className?: string }) {
  const listLoading = useContext(SearchLoadingContext);
  const busy = loading ?? listLoading;
  return (
    <span className={cn("pointer-events-none absolute left-3 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center text-slate-400", className)}>
      {busy ? <LoaderCircle role="status" aria-label="목록 갱신 중" className="size-4 animate-spin" /> : <Search aria-hidden="true" className="size-4" />}
    </span>
  );
}
