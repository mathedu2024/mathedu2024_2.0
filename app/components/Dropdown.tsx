'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

export default function Dropdown({ options, value, onChange, placeholder = '請選擇', className = '', buttonClassName = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  // 如果沒有傳入自定義背景色，則預設使用白色
  const backgroundClass = buttonClassName.includes('bg-') ? '' : 'bg-white';

  // Close dropdown on click outside
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

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`w-full flex items-center justify-between border border-gray-200 text-gray-700 px-4 py-2.5 text-sm rounded-xl shadow-sm transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${backgroundClass} ${buttonClassName}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'font-medium' : 'text-gray-500'}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-1 w-full bg-white shadow-lg border border-gray-100 rounded-xl max-h-60 overflow-y-auto"
            role="listbox"
          >
            <ul className="p-1">
              {options.filter(Boolean).map((option) => (
                <li
                  key={option.value}
                  className={`px-4 py-2.5 text-sm cursor-pointer rounded-lg transition-colors ${
                    value === option.value
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-gray-800 hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelect(option.value)}
                  role="option"
                  aria-selected={value === option.value}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}