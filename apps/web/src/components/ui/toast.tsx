import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  message: string;
  action?: ToastAction;
  duration?: number;
  type?: ToastType;
};

type ToastItem = ToastOptions & {
  id: string;
};

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${++nextId.current}`;
    setToasts((current) => [...current.slice(-2), { ...options, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="pointer-events-none fixed inset-x-4 bottom-6 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [isLeaving, setIsLeaving] = useState(false);
  const toastType = item.type ?? "info";
  const Icon =
    toastType === "success"
      ? CheckCircle2
      : toastType === "error"
        ? CircleAlert
        : toastType === "warning"
          ? TriangleAlert
          : Info;
  const iconClassName =
    toastType === "success"
      ? "text-emerald-300"
      : toastType === "error"
        ? "text-rose-300"
        : toastType === "warning"
          ? "text-amber-300"
          : "text-sky-300";

  const requestDismiss = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 160);
  }, [isLeaving, item.id, onDismiss]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      requestDismiss,
      item.duration ?? 4500,
    );
    return () => window.clearTimeout(timeoutId);
  }, [item.duration, requestDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto inline-flex max-w-full items-center gap-3 rounded-lg border border-slate-800/10 bg-slate-900 px-3.5 py-2.5 text-[length:var(--ui-text-body-sm-size)] font-medium leading-5 text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)] ${isLeaving ? "toast-exit" : "toast-enter"}`}
    >
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${iconClassName}`} />
      <span className="min-w-0">{item.message}</span>
      {item.action ? (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-300 outline-none hover:bg-white/10 hover:text-emerald-200 focus-visible:bg-white/10"
          onClick={() => {
            requestDismiss();
            item.action?.onClick();
          }}
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="토스트 닫기"
        title="닫기"
        className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
        onClick={requestDismiss}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
