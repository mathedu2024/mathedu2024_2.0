'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  placeholder = '請選擇...',
  className = '',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const estimatedMenuHeight = 240;
    const menuGap = 4;

    setPosition({
      left: buttonRect.left,
      width: buttonRect.width,
      ...(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow
        ? { bottom: viewportHeight - buttonRect.top + menuGap }
        : { top: buttonRect.bottom + menuGap }),
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    calculatePosition();
    const updatePosition = () => calculatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleOption = (optionValue: string) => {
    const newSelected = selectedOptions.includes(optionValue)
      ? selectedOptions.filter((value) => value !== optionValue)
      : [...selectedOptions, optionValue];
    onChange(newSelected);
  };

  const selectedItems = options.filter((opt) => selectedOptions.includes(opt.value));

  const menu = isOpen && isMounted ? (
    <div
      ref={menuRef}
      className={MULTISELECT_MENU_CLASS}
      style={{
        position: 'fixed',
        left: `${position.left}px`,
        width: `${position.width}px`,
        top: position.top !== undefined ? `${position.top}px` : undefined,
        bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
      }}
    >
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
                isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className="block truncate">{option.label}</span>
              {isSelected && (
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-primary">
                  <CheckIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
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
          <svg
            className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isMounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
