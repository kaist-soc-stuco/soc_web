import { useCallback, useState } from "react";

/** Keep always-open and all-day mutually exclusive, retaining the last scheduled mode. */
export function useScheduleMode() {
  const [mode, setMode] = useState({ isAllDay: false, isAlwaysOpen: false, rememberedAllDay: false });
  const setIsAllDay = useCallback((checked: boolean) => {
    setMode(current => ({ ...current, isAllDay: current.isAlwaysOpen ? false : checked, rememberedAllDay: checked }));
  }, []);
  const setIsAlwaysOpen = useCallback((checked: boolean) => {
    setMode(current => checked
      ? { isAllDay: false, isAlwaysOpen: true, rememberedAllDay: current.isAlwaysOpen ? current.rememberedAllDay : current.isAllDay }
      : { ...current, isAlwaysOpen: false, isAllDay: current.isAlwaysOpen ? current.rememberedAllDay : current.isAllDay });
  }, []);
  return { isAllDay: mode.isAllDay, isAlwaysOpen: mode.isAlwaysOpen, setIsAllDay, setIsAlwaysOpen };
}
