import { AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useLanguage } from "@/hooks/use-language";

type ConfirmTone = "default" | "danger";

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  title: string;
  tone?: ConfirmTone;
};

type ConfirmState = Required<Pick<ConfirmOptions, "cancelLabel" | "confirmLabel" | "title" | "tone">> &
  Pick<ConfirmOptions, "description">;

export function useConfirmDialog() {
  const { lang } = useLanguage();
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolverRef.current?.(false);

    setState({
      cancelLabel:
        options.cancelLabel ?? (lang === "ko" ? "취소" : "Cancel"),
      confirmLabel:
        options.confirmLabel ?? (lang === "ko" ? "확인" : "Confirm"),
      description: options.description,
      title: options.title,
      tone: options.tone ?? "default",
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [lang]);

  useEffect(() => {
    if (!state) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, state]);

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const ConfirmDialog = state
    ? createPortal(
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
        >
          <Button variant="ghost"
            type="button"
            aria-label={lang === "ko" ? "닫기" : "Close"}
            className="absolute inset-0 cursor-default"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  state.tone === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-emerald-50 text-kaist-darkgreen"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold leading-snug text-slate-900">
                  {state.title}
                </h2>
                {state.description && (
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-500">
                    {state.description}
                  </p>
                )}
              </div>
              <IconButton
                size="sm"
                aria-label={lang === "ko" ? "닫기" : "Close"}
                onClick={() => close(false)}
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => close(false)}
              >
                {state.cancelLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => close(true)}
                className={`text-white ${
                  state.tone === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-kaist-darkgreen hover:bg-[#0f5c29]"
                }`}
              >
                {state.confirmLabel}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { confirm, ConfirmDialog };
}
