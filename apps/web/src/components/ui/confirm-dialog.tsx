import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/hooks/use-language";

type ConfirmTone = "default" | "danger";

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  title: ReactNode;
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

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const ConfirmDialog = state
    ? (
        <Modal
          open
          onClose={() => close(false)}
          title={
            <span className="text-xl font-semibold leading-7 text-slate-900">
              {state.title}
            </span>
          }
          className="max-w-md"
          bodyClassName="px-6 py-5"
          footer={
            <>
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
            </>
          }
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                state.tone === "danger"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-emerald-50 text-kaist-darkgreen"
              }`}
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
            </div>
            {state.description ? (
              <p className="min-w-0 break-keep text-sm font-medium leading-6 text-slate-600">
                {state.description}
              </p>
            ) : null}
          </div>
        </Modal>
      )
    : null;

  return { confirm, ConfirmDialog };
}
