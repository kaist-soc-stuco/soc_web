import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

const overlayStack: HTMLElement[] = [];
let bodyScrollLockCount = 0;
let previousBodyOverflow: string | null = null;
let previousDocumentOverflow: string | null = null;
let previousDocumentScrollbarGutter: string | null = null;

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousDocumentOverflow = document.documentElement.style.overflow;
    previousDocumentScrollbarGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
  }
  bodyScrollLockCount += 1;

  return () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow ?? "";
      document.documentElement.style.overflow = previousDocumentOverflow ?? "";
      document.documentElement.style.scrollbarGutter = previousDocumentScrollbarGutter ?? "";
      previousBodyOverflow = null;
      previousDocumentOverflow = null;
      previousDocumentScrollbarGutter = null;
    }
  };
}

function getFocusableElements(surface: HTMLElement) {
  return Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex >= 0 &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0,
  );
}

function focusSurface(surface: HTMLElement, last = false) {
  const focusable = getFocusableElements(surface);
  const target = last ? focusable.at(-1) : focusable[0];
  (target ?? surface).focus({ preventScroll: true });
}

interface UseOverlayBehaviorOptions {
  onClose: () => void;
  open: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
}

/**
 * Shared behavior for modal-like surfaces: body scroll locking, focus capture/
 * restoration, Escape handling, and a small focus trap for the active overlay.
 */
export function useOverlayBehavior({
  onClose,
  open,
  surfaceRef,
}: UseOverlayBehaviorOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const surface = surfaceRef.current;
    if (!surface) return;

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockBodyScroll = lockBodyScroll();
    overlayStack.push(surface);

    const focusFrame = window.requestAnimationFrame(() => {
      if (overlayStack.at(-1) === surface) focusSurface(surface);
    });

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (overlayStack.at(-1) !== surface) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (overlayStack.at(-1) !== surface || surface.contains(event.target as Node)) return;
      focusSurface(surface);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      const stackIndex = overlayStack.lastIndexOf(surface);
      if (stackIndex >= 0) overlayStack.splice(stackIndex, 1);
      unlockBodyScroll();

      if (previousActiveElement && document.contains(previousActiveElement)) {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus({ preventScroll: true });
        });
      }
    };
  }, [open, surfaceRef]);

  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const surface = surfaceRef.current;
    if (!surface || overlayStack.at(-1) !== surface) return;

    const focusable = getFocusableElements(surface);
    if (focusable.length === 0) {
      event.preventDefault();
      surface.focus({ preventScroll: true });
      return;
    }

    const activeElement = document.activeElement;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (activeElement === first || !surface.contains(activeElement))) {
      event.preventDefault();
      last?.focus({ preventScroll: true });
    } else if (!event.shiftKey && (activeElement === last || !surface.contains(activeElement))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }, [surfaceRef]);
}
