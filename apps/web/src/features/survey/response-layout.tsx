import type { ReactNode } from "react";
import { MobileDetailHeader } from "@/components/ui/mobile-detail-header";
import { RichTextContent } from "@/components/ui/rich-text-content";

export function ResponseMobileNavigation({ to, lang }: { to: "/surveys" | "/votes"; lang: string }) {
  return <MobileDetailHeader backTo={to} lang={lang} title={to === "/surveys" ? (lang === "ko" ? "설문" : "Survey") : (lang === "ko" ? "투표" : "Vote")} />;
}

export function ResponsePageMain({ children, busy = false, className = "" }: { children: ReactNode; busy?: boolean; className?: string }) {
  return <main className={`channel-talk-safe-area flex-1 bg-[#f3f5f4] px-4 py-6 sm:py-10 lg:px-0 ${className}`} aria-busy={busy}><div className="mx-auto max-w-[42rem] space-y-5">{children}</div></main>;
}

export function ResponseHeaderCard({ title, children, status }: { title: string; children?: ReactNode; status?: ReactNode }) {
  return <section className="response-header-card rounded-lg border border-t-8 border-slate-200 border-t-brand-primary bg-white p-4 shadow-none sm:p-8">
    {status && <div className="mb-2">{status}</div>}
    <h1 className="break-words text-2xl font-normal tracking-tight text-slate-950 sm:text-3xl"><RichTextContent content={title} /></h1>
    {children}
  </section>;
}
