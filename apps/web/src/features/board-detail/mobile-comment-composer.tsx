import { useEffect, useRef, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CommentComposer } from "@/components/ui/comment-section";
import { rememberAuthReturnPath } from "@/lib/auth-storage";

export function MobileCommentComposer({ inputRef, loginRef, authenticated, canCreate, submitting, value, error, lang, onChange, onSubmit }: {
  inputRef: RefObject<HTMLTextAreaElement | null>; loginRef: RefObject<HTMLAnchorElement | null>;
  authenticated: boolean; canCreate: boolean; submitting: boolean; value: string; error: string | null; lang: string;
  onChange: (value: string) => void; onSubmit: () => Promise<void>;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => {
    document.body.classList.add("site-mobile-comment-open");
    return () => document.body.classList.remove("site-mobile-comment-open");
  }, []);
  useEffect(() => {
    const surface = surfaceRef.current;
    const page = surface?.closest<HTMLElement>(".mobile-detail-has-composer");
    if (!surface || !page) return;
    const reserveSpace = () => page.style.setProperty("--comment-composer-height", `${surface.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(surface);
    reserveSpace();
    return () => {
      observer.disconnect();
      page.style.removeProperty("--comment-composer-height");
    };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const keyboardOffset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const surface = surfaceRef.current;
      surface?.style.setProperty("--comment-keyboard-offset", `${keyboardOffset}px`);
      surface?.style.setProperty("--comment-safe-bottom", keyboardOffset > 0 ? "0px" : "env(safe-area-inset-bottom,0px)");
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    return () => { viewport?.removeEventListener("resize", syncViewport); viewport?.removeEventListener("scroll", syncViewport); };
  }, []);

  return <div ref={surfaceRef} className="mobile-sticky-comment-composer" role="region" aria-label={lang === "ko" ? "댓글 작성" : "Write a comment"}>
    {authenticated ? canCreate ? <>
      {error && <p role="alert" className="mb-2 text-xs text-rose-600">{error}</p>}
      <CommentComposer inputRef={inputRef} mobile ariaLabel={lang === "ko" ? "댓글 입력" : "Comment input"} submitLabel={lang === "ko" ? "댓글 등록" : "Post comment"} disabled={submitting} isSubmitting={submitting} value={value} onChange={onChange} onSubmit={onSubmit} placeholder={lang === "ko" ? "댓글을 입력하세요" : "Write a comment"} />
    </> : <p className="py-3 text-center text-sm text-slate-500">{lang === "ko" ? "댓글을 작성할 권한이 없습니다." : "You cannot comment on this post."}</p> : <Link ref={loginRef} className="mobile-comment-login" to="/login" onClick={() => rememberAuthReturnPath(`${location.pathname}${location.search}${location.hash}`)}><span>{lang === "ko" ? "로그인하고 댓글 쓰기" : "Sign in to write a comment"}</span><ArrowRight aria-hidden="true" /></Link>}
  </div>;
}
