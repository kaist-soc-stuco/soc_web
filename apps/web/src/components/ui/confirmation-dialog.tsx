import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmationDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
  destructive?: boolean;
  className?: string;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  destructive = false,
  className,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const confirmInFlightRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const isBusy = busy || confirming;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.open = true;
      }
      queueMicrotask(() => cancelButtonRef.current?.focus());
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.open = false;
    }
    openerRef.current?.focus();
  }, [open]);

  const cancel = () => {
    if (!isBusy) onCancel();
  };

  const handleNativeCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    cancel();
  };

  const confirm = async () => {
    if (isBusy || confirmInFlightRef.current) return;

    confirmInFlightRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      confirmInFlightRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn('m-auto w-full max-w-md rounded-lg border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/50', className)}
      onCancel={handleNativeCancel}
    >
      <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
      {description ? <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <button
          ref={cancelButtonRef}
          type="button"
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
          disabled={isBusy}
          onClick={cancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }), 'min-h-11')}
          disabled={isBusy}
          aria-busy={isBusy || undefined}
          onClick={confirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
