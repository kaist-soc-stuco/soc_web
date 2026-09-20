import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/hooks/use-language";

type ConfirmTone = "default" | "danger";

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: ReactNode;
  warning?: ReactNode;
  title: ReactNode;
  tone?: ConfirmTone;
};

type ConfirmState = {
  cancelLabel: string;
  confirmLabel: string;
  description?: ReactNode;
  title: ReactNode;
  tone: ConfirmTone;
  warning?: ReactNode;
};

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
      warning: options.warning,
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
          showClose={state.tone !== "danger"}
          dividerless={state.tone === "danger"}
          title={state.title}
          className="max-w-[25rem]"
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
                variant={state.tone === "danger" ? "destructive" : "default"}
                onClick={() => close(true)}
              >
                {state.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="min-w-0 space-y-1">
            {state.description ? (
              <p className="break-keep text-sm font-normal leading-6 text-neutral-600">
                {state.description}
              </p>
            ) : null}
            {state.warning ? (
              <p className="break-keep text-sm font-normal leading-6 text-slate-500">
                {state.warning}
              </p>
            ) : null}
          </div>
        </Modal>
      )
    : null;

  return { confirm, ConfirmDialog };
}
