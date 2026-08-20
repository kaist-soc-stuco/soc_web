import { MessageCircle } from "lucide-react";

import { showChannelTalk } from "./channel-talk";

interface ChannelTalkInquiryCardProps {
  lang: string;
}

export function ChannelTalkInquiryCard({ lang }: ChannelTalkInquiryCardProps) {
  return (
    <section className="mx-auto mb-5 flex max-w-7xl flex-col gap-4 rounded-lg border border-brand-primary-border bg-brand-primary-light/45 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-primary-border bg-white text-brand-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">
            {lang === "ko" ? "빠른 문의는 채널톡으로" : "Need a quick answer? Use Channel Talk"}
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
            {lang === "ko"
              ? "행사, 회비, 사이트 이용 문의를 운영진에게 바로 남길 수 있습니다."
              : "Ask the council directly about events, fees, or using the site."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={showChannelTalk}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {lang === "ko" ? "채널톡 문의하기" : "Open Channel Talk"}
      </button>
    </section>
  );
}
