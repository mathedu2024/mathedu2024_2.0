'use client';

import { CSSProperties, Fragment, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import {
  DROPDOWN_BUTTON_CLASS,
  DROPDOWN_MENU_CLASS,
  DROPDOWN_OPTION_ACTIVE_CLASS,
  DROPDOWN_OPTION_BASE_CLASS,
  DROPDOWN_OPTION_INACTIVE_CLASS,
} from './dropdownStyles';

export {
  DROPDOWN_BUTTON_CLASS,
  DROPDOWN_MENU_CLASS,
  DROPDOWN_OPTION_BASE_CLASS,
  DROPDOWN_OPTION_ACTIVE_CLASS,
  DROPDOWN_OPTION_INACTIVE_CLASS,
} from './dropdownStyles';

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
  buttonClassName?: string;
  style?: CSSProperties;
}

export default function Dropdown({ value, onChange, options, placeholder = 'Select an option', className = '', buttonClassName = '', style }: DropdownProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
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
          : { top: buttonRect.bottom + menuGap })
      });
    }
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);

  useEffect(() => {
    const updatePosition = () => {
      if (openRef.current && buttonRef.current) {
        calculatePosition();
      }
    };
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [calculatePosition]);

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
        if (open !== openRef.current) {
          openRef.current = open;
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
              className={DROPDOWN_MENU_CLASS}
              style={{
                left: `${position.left}px`,
                width: `${position.width}px`,
                top: position.top !== undefined ? `${position.top}px` : undefined,
                bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
              }}
              static={false}
            >
            {(options ?? []).map((option) => (
                <Listbox.Option
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    `${DROPDOWN_OPTION_BASE_CLASS} ${
                      active ? DROPDOWN_OPTION_ACTIVE_CLASS : DROPDOWN_OPTION_INACTIVE_CLASS
                    } ${selected ? 'font-medium' : 'font-normal'}`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {option.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600">
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        ) : null;

        return (
          <div className={`relative ${className}`}>
            <Listbox.Button 
              ref={buttonRef}
              style={style} 
              className={`${DROPDOWN_BUTTON_CLASS} ${buttonClassName}`}
            >
              <span className={`truncate ${!value ? 'text-gray-400' : 'text-gray-900'}`}>
                {(options || []).find(o => o.value === value)?.label || placeholder}
              </span>
              <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
            </Listbox.Button>
            {isMounted && createPortal(dropdownOptions, document.body)}
          </div>
        );
      }}
    </Listbox>
  );
}