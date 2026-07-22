import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

interface DropdownOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  emptyLabel?: string;
  menuClassName?: string;
  optionClassName?: string;
}

export function SelectDropdown({
  id,
  value,
  options,
  onChange,
  placeholder,
  className,
  buttonClassName,
  disabled = false,
  emptyLabel,
  menuClassName,
  optionClassName,
}: SelectDropdownProps) {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`w-full rounded-xl border border-gray-200 px-4 py-2.5 text-left text-sm font-medium transition-all flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen ${
          disabled
            ? "bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed border-gray-200"
            : "bg-white text-gray-700 hover:border-gray-300"
        } ${buttonClassName || ""}`}
      >
        <span className={selectedOption ? "text-kaist-black" : "text-kaist-grey/50"}>
          {selectedOption
            ? selectedOption.label
            : placeholder || (lang === "ko" ? "선택하세요" : "Select")}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-kaist-grey/60 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-kaist-darkgreen" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          role="listbox"
          className={`absolute z-50 mt-2 w-full border border-gray-200 rounded-xl bg-white shadow-lg py-1 animate-in fade-in duration-100 max-h-60 overflow-y-auto ${menuClassName || ""}`}
        >
          {options.length === 0 ? (
            <div className="px-4 py-2.5 text-xs text-kaist-grey/50">
              {emptyLabel ??
                (lang === "ko" ? "선택지가 없습니다." : "No options.")}
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-kaist-lightgreen/40 transition-colors flex items-center justify-between ${
                  option.value === value
                    ? "text-kaist-darkgreen bg-kaist-lightgreen/20 font-bold"
                    : "text-kaist-black font-medium"
                } ${optionClassName || ""}`}
              >
                <span>{option.label}</span>
                {option.value === value && <Check className="w-3.5 h-3.5 text-kaist-darkgreen" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
