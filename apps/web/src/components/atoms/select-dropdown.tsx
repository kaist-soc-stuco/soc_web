import { createPortal } from "react-dom";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { ChevronDown, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  separatorBefore?: boolean;
}

export interface SelectDropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  buttonClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  open?: boolean;
  ariaInvalid?: boolean;
  emptyLabel?: string;
  menuClassName?: string;
  onOpenChange?: (open: boolean) => void;
  optionClassName?: string;
  disableMenuScroll?: boolean;
}

const DROPDOWN_VIEWPORT_PADDING = 8;
const DROPDOWN_GAP = 8;
// Keep the menu compact while allowing the option list to scroll when the
// viewport is short. The scrollbar is visually hidden below.
const DROPDOWN_MAX_HEIGHT = 240;

const openDropdownListeners = new Set<(instanceId: string) => void>();

export function SelectDropdown({
  id,
  value,
  options,
  onChange,
  placeholder,
  className,
  ariaLabel,
  buttonClassName,
  disabled = false,
  autoFocus = false,
  open,
  ariaInvalid = false,
  emptyLabel,
  menuClassName,
  onOpenChange,
  optionClassName,
  disableMenuScroll = false,
}: SelectDropdownProps) {
  const { lang } = useLanguage();
  const instanceId = useId();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = open ?? internalIsOpen;
  const onOpenChangeRef = useRef(onOpenChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionLabelsKey = options.map((option) => option.label).join("\u0001");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    visibility: "hidden",
    width: "max-content",
  });
  const setOpen = (open: boolean) => {
    if (open === isOpen || (open && disabled)) return;
    if (open) {
      openDropdownListeners.forEach((listener) => listener(instanceId));
    }
    if (open === false || open === true) setInternalIsOpen(open);
    onOpenChange?.(open);
  };

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    const closeWhenAnotherOpens = (openedInstanceId: string) => {
      if (openedInstanceId === instanceId) return;
      setInternalIsOpen(false);
      onOpenChangeRef.current?.(false);
    };
    openDropdownListeners.add(closeWhenAnotherOpens);
    return () => {
      openDropdownListeners.delete(closeWhenAnotherOpens);
    };
  }, [instanceId]);

  useLayoutEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      setMenuStyle({ visibility: "hidden", width: "max-content" });
      return;
    }

    setMenuStyle({ visibility: "hidden", width: "max-content" });

    const updateMenuPosition = () => {
      const trigger = containerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom - DROPDOWN_VIEWPORT_PADDING;
      const spaceAbove = triggerRect.top - DROPDOWN_VIEWPORT_PADDING;
      const naturalHeight = menu.scrollHeight;
      const opensUp = spaceBelow < naturalHeight + DROPDOWN_GAP && spaceAbove > spaceBelow;
      const availableHeight = Math.max(
        120,
        (opensUp ? spaceAbove : spaceBelow) - DROPDOWN_GAP,
      );
      const maxMenuHeight = disableMenuScroll
        ? undefined
        : Math.min(DROPDOWN_MAX_HEIGHT, availableHeight);
      const positionedHeight = disableMenuScroll
        ? naturalHeight
        : Math.min(menu.scrollHeight, maxMenuHeight ?? DROPDOWN_MAX_HEIGHT);
      const optionNode = menu.querySelector<HTMLElement>('[role="option"]');
      const font = optionNode ? window.getComputedStyle(optionNode).font : window.getComputedStyle(menu).font;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) context.font = font;
      const measuredLabelWidth = optionLabelsKey.split("\u0001").reduce((width, label) => {
        const labelWidth = context?.measureText(label).width ?? 0;
        return Math.max(width, labelWidth);
      }, 0);
      // Measure labels directly. An auto-width fixed element can otherwise
      // stretch to the remaining viewport width before its position is set.
      const contentWidth = Math.min(Math.ceil(measuredLabelWidth + 58), 320);
      const viewportWidth = Math.max(
        DROPDOWN_VIEWPORT_PADDING * 2,
        window.innerWidth - DROPDOWN_VIEWPORT_PADDING * 2,
      );
      const menuWidth = Math.min(Math.max(triggerRect.width, contentWidth), viewportWidth);
      const left = Math.min(
        Math.max(DROPDOWN_VIEWPORT_PADDING, triggerRect.left),
        Math.max(DROPDOWN_VIEWPORT_PADDING, window.innerWidth - menuWidth - DROPDOWN_VIEWPORT_PADDING),
      );

      const top = disableMenuScroll
        ? (() => {
            // Keep the trigger around the lower third of a tall menu, so the
            // list naturally expands farther below than above it.
            const preferredTop =
              triggerRect.top + triggerRect.height / 2 - positionedHeight * 0.35;
            const maxTop = Math.max(
              DROPDOWN_VIEWPORT_PADDING,
              window.innerHeight - positionedHeight - DROPDOWN_VIEWPORT_PADDING,
            );
            return Math.min(
              Math.max(DROPDOWN_VIEWPORT_PADDING, preferredTop),
              maxTop,
            );
          })()
        : opensUp
          ? Math.max(
              DROPDOWN_VIEWPORT_PADDING,
              triggerRect.top - positionedHeight - DROPDOWN_GAP,
            )
          : triggerRect.bottom + DROPDOWN_GAP;

      setMenuStyle({
        left,
        ...(maxMenuHeight === undefined ? {} : { maxHeight: maxMenuHeight }),
        top,
        visibility: "visible",
        width: menuWidth,
      });
    };

    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, optionLabelsKey]);

  useEffect(() => {
    if (!isOpen) return;

    const close = () => {
      setInternalIsOpen(false);
      onOpenChangeRef.current?.(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const SelectedIcon = selectedOption?.icon;
  const menuId = id ? `${id}-menu` : undefined;

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => !disabled && setOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-controls={isOpen ? menuId : undefined}
          aria-invalid={ariaInvalid ? "true" : undefined}
        className={`interaction-control h-[var(--ui-control-height)] w-full justify-between px-3 py-0 text-left text-[length:var(--ui-control-font-size)] [font-weight:var(--ui-control-font-weight)] ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-50"
            : "bg-white text-gray-700"
        } ${buttonClassName || ""}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selectedOption ? "text-kaist-black" : "text-kaist-grey/50"}`}>
          {SelectedIcon ? <SelectedIcon aria-hidden="true" className="size-4 shrink-0 text-slate-500" /> : null}
          <span className="min-w-0 truncate">
            {selectedOption
              ? selectedOption.label
              : placeholder || (lang === "ko" ? "선택하세요" : "Select")}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-kaist-grey/60 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-kaist-darkgreen" : ""
          }`}
        />
      </Button>

      {isOpen && !disabled
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              style={menuStyle}
              className={`ui-select-dropdown-menu fixed z-[100] max-h-60 overflow-x-hidden overflow-y-auto rounded-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white p-1 shadow-[0_2px_8px_rgb(15_23_42_/_0.08)] ${disableMenuScroll ? "!max-h-none !overflow-visible" : ""} ${menuClassName || ""}`}
            >
              {options.length === 0 ? (
                <div className="px-2.5 py-2 text-sm font-normal text-kaist-grey/50">
                  {emptyLabel ??
                    (lang === "ko" ? "선택지가 없습니다." : "No options.")}
                </div>
              ) : (
                options.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <Fragment key={option.value}>
                      {option.separatorBefore ? (
                        <div role="separator" className="my-1 border-t border-slate-100" />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        role="option"
                        aria-selected={option.value === value}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={`interaction-menu-item h-[var(--ui-menu-row-height)] w-full min-w-0 justify-between overflow-hidden rounded-md px-2.5 py-0 text-left text-[length:var(--ui-text-body-size)] ${
                          option.value === value
                            ? "bg-brand-primary-light text-brand-primary font-medium"
                            : "text-kaist-black font-normal"
                        } ${optionClassName || ""}`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          {OptionIcon ? <OptionIcon aria-hidden="true" className="size-4 shrink-0 text-slate-500" /> : null}
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{option.label}</span>
                        </span>
                        {option.value === value && <Check className="size-3.5 shrink-0 text-kaist-darkgreen" />}
                      </Button>
                    </Fragment>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
