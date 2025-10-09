'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`select-unified min-h-[42px] pr-16 flex items-center justify-between ${className}`}
      >
        <span className="truncate">
          {selectedItems.length === 0
            ? placeholder
            : selectedItems.length === 1
            ? selectedItems[0].label
            : `${selectedItems.length} 個已選擇`}
        </span>
        <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
      </button>

      {isOpen && (
        <div style={{ minWidth: dropdownRef.current?.offsetWidth || 200 }} className="absolute z-10 mt-1 w-full max-w-xs bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => handleToggleOption(option.value)}
              className={`cursor-pointer select-none flex items-center justify-between py-2 pl-4 pr-4 ${selectedOptions.includes(option.value) ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}
            >
              <span>{option.label}</span>
              {selectedOptions.includes(option.value) && (
                <svg className="w-5 h-5 text-blue-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}