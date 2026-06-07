'use client';

import { useState, useRef, useEffect } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import {
  MULTISELECT_BUTTON_CLASS,
  MULTISELECT_MENU_CLASS,
  MULTISELECT_OPTION_BASE_CLASS,
} from './ui/dropdownStyles';

interface Option {
  label: string;
  value: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "請選擇...",
  className = '',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleOption = (optionValue: string) => {
    const newSelected = selectedOptions.includes(optionValue)
      ? selectedOptions.filter(value => value !== optionValue)
      : [...selectedOptions, optionValue];
    onChange(newSelected);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const selectedItems = options.filter(opt => selectedOptions.includes(opt.value));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={MULTISELECT_BUTTON_CLASS}
      >
        <span className="block truncate text-gray-900">
          {selectedItems.length === 0
              ? placeholder
              : selectedItems.length === 1
              ? selectedItems[0].label
              : `${selectedItems.length} 個已選擇`}
        </span>
        <div className="pointer-events-none flex items-center text-gray-500 ml-2 flex-shrink-0">
          <svg className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>

      {isOpen && (
        <div className={MULTISELECT_MENU_CLASS}>
          {options.length === 0 ? (
            <div className="relative cursor-default select-none py-2.5 px-4 text-gray-500">
              無選項
            </div>
          ) : (
            options.map((option) => {
              const isSelected = selectedOptions.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => handleToggleOption(option.value)}
                  className={`${MULTISELECT_OPTION_BASE_CLASS} ${
                    isSelected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span className="block truncate">
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-indigo-600">
                      <CheckIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}