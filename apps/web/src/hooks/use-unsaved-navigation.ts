import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/** Warn only while a manually saved form has changes that would be lost. */
export function useUnsavedNavigation(dirty: boolean, confirmDiscard: () => Promise<boolean>) {
  const confirming = useRef(false);
  const confirmRef = useRef(confirmDiscard);
  confirmRef.current = confirmDiscard;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked" || confirming.current) return;
    confirming.current = true;
    void confirmRef.current().then((discard) => {
      if (discard) blocker.proceed();
      else blocker.reset();
    }).finally(() => { confirming.current = false; });
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
