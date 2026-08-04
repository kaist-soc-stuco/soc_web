import { useEffect } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

/**
 * Blocks in-app navigation and browser unloads while an editor has unsaved work.
 * Use the returned blocker to present a confirmation dialog, then call either
 * `blocker.proceed()` or `blocker.reset()` from that dialog.
 */
export function useDirtyNavigation(shouldBlock: boolean | (() => boolean)): Blocker {
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    const isDirty = () => typeof shouldBlock === 'function' ? shouldBlock() : shouldBlock;
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [shouldBlock]);

  return blocker;
}
