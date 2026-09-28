import React, { useState, useEffect, useRef } from "react";
import { Clock, X } from "lucide-react";
import {
  getSuggestions,
  saveSuggestion,
  removeSuggestion,
  SuggestionItem,
} from "../lib/autocompleteStorage";

interface CustomAutoSuggestInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  fieldKey: string; // Storage identifier for this field
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  id?: string;
}

export const CustomAutoSuggestInput: React.FC<CustomAutoSuggestInputProps> = ({
  fieldKey,
  value,
  onChange,
  onSelectSuggestion,
  className = "",
  placeholder = "",
  disabled = false,
  type = "text",
  id,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load active valid suggestions (< 24 hours old)
  const refreshSuggestions = () => {
    if (!fieldKey) return;
    const items = getSuggestions(fieldKey);
    setSuggestions(items);
  };

  useEffect(() => {
    refreshSuggestions();
  }, [fieldKey]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuggestions = suggestions.filter((item) =>
    value ? item.text.toLowerCase().includes(value.toLowerCase()) : true
  );

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    refreshSuggestions();
    setIsOpen(true);
    if (props.onFocus) props.onFocus(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (value && value.trim().length >= 2) {
      saveSuggestion(fieldKey, value.trim());
    }
    if (props.onBlur) props.onBlur(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (value && value.trim().length >= 2) {
        saveSuggestion(fieldKey, value.trim());
      }
      setIsOpen(false);
    }
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleSelect = (text: string) => {
    onChange(text);
    saveSuggestion(fieldKey, text);
    if (onSelectSuggestion) onSelectSuggestion(text);
    setIsOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    removeSuggestion(fieldKey, text);
    refreshSuggestions();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        {...props}
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        data-lpignore="true"
        className={className}
      />

      {/* Custom Autocomplete Suggestions Dropdown */}
      {isOpen && !disabled && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto py-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 mb-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-brand-primary" /> Sugestões Recentes (24h)
            </span>
          </div>
          {filteredSuggestions.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelect(item.text)}
              className="px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-primary cursor-pointer flex items-center justify-between group transition-colors font-medium"
            >
              <span className="truncate">{item.text}</span>
              <button
                type="button"
                onClick={(e) => handleRemove(e, item.text)}
                title="Remover sugestão"
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomAutoSuggestInput;
