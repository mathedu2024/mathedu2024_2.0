'use client';

import { CSSProperties, Fragment, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}

export default function Dropdown({ value, onChange, options, placeholder = 'Select an option', className = '', style }: DropdownProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // 確保在客戶端渲染
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 計算下拉選單的位置（使用 fixed 定位）
  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const estimatedMenuHeight = 240; // max-h-60 約為 240px
      const menuGap = 4; // mt-1 的間距

      setPosition({
        left: buttonRect.left,
        width: buttonRect.width,
        // 如果下方空間不足，且上方空間更多，則向上顯示
        ...(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow
          ? { bottom: viewportHeight - buttonRect.top + menuGap }
          : { top: buttonRect.bottom + menuGap })
      });
    }
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);

  // 監聽打開狀態和視窗事件
  useEffect(() => {
    const updatePosition = () => {
      if (openRef.current && buttonRef.current) {
        calculatePosition();
      }
    };

    // 監聽滾動和大小變化
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [calculatePosition]);

  // 如果打開，持續更新位置（處理滾動）
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        calculatePosition();
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isOpen, calculatePosition]);

  // 監聽 isOpen 狀態變化來更新位置
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [isOpen, calculatePosition]);

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => {
        // 當打開狀態改變時，更新狀態
        if (open !== openRef.current) {
          openRef.current = open;
          // 使用 setTimeout 避免在渲染過程中設置狀態
          setTimeout(() => {
            setIsOpen(open);
          }, 0);
        }

        const dropdownOptions = open && isMounted ? (
          <Transition
            as={Fragment}
            show={open}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              ref={optionsRef}
              className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none"
              style={{
                left: `${position.left}px`,
                width: `${position.width}px`,
                top: position.top !== undefined ? `${position.top}px` : undefined,
                bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
              }}
              static={false}
            >
            {(options ?? []).map((option, optionIdx) => (
                <Listbox.Option
                  key={option.value}
                  value={option.value}
                  className={({ active }) =>
                    `cursor-pointer select-none relative py-2 pl-4 pr-10 ${
                      active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                    }`
                  }
                >
                  {option.label}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        ) : null;

        return (
          <div className="relative">
            <Listbox.Button 
              ref={buttonRef}
              style={style} 
              className={`select-unified pr-16 flex items-center justify-between ${className}`}
            >
              <span className="truncate">{(options || []).find(o => o.value === value)?.label || placeholder}</span>
              <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
            </Listbox.Button>
            {isMounted && createPortal(dropdownOptions, document.body)}
          </div>
        );
      }}
    </Listbox>
  );
}
