import { useEffect, useRef, useState } from "react";

/** Persist idle edits without resetting text typed while a request is pending. */
export function useDebouncedEditorSave(value: unknown, commit: () => Promise<boolean>, enabled: boolean) {
  const signature = JSON.stringify(value);
  const saved = useRef(signature);
  const busy = useRef(false);
  const failed = useRef<string | null>(null);
  const callback = useRef(commit);
  callback.current = commit;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || saved.current === signature || failed.current === signature) return;
    const timer = window.setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (await callback.current()) { saved.current = signature; failed.current = null; }
        else failed.current = signature;
      } catch {
        failed.current = signature;
      } finally {
        busy.current = false;
        // Revisit newer edits after this request, without retrying failed edits.
        setRevision(value => value + 1);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [enabled, signature, revision]);
}
