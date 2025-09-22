'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: string;
  name: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "請選擇...",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleOption = (optionId: string) => {
    const newSelected = selectedOptions.includes(optionId)
      ? selectedOptions.filter(id => id !== optionId)
      : [...selectedOptions, optionId];
    onChange(newSelected);
  };

  const handleRemoveOption = (optionId: string) => {
    const newSelected = selectedOptions.filter(id => id !== optionId);
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
  
  const selectedItems = options.filter(opt => selectedOptions.includes(opt.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="select-unified min-h-[42px]">
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedItems.map(item => (
            <div key={item.id} className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center gap-2">
              <span>{item.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveOption(item.id)}
                className="text-blue-800 hover:text-blue-900"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left"
        >
          {placeholder}
        </button>
      </div>

      {isOpen && (
        <div style={{zIndex: 9999, position: 'fixed', left: dropdownRef.current?.getBoundingClientRect().left, top: dropdownRef.current?.getBoundingClientRect().bottom, width: dropdownRef.current?.offsetWidth}} className="bg-white border rounded-md max-h-60 overflow-auto shadow-xl">
          {options.map(option => (
            <div
              key={option.id}
              onClick={() => handleToggleOption(option.id)}
              className={`p-2 cursor-pointer hover:bg-gray-100 flex items-center justify-between ${selectedOptions.includes(option.id) ? 'bg-blue-50' : ''}`}
            >
              <span>{option.name}</span>
              {selectedOptions.includes(option.id) && (
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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