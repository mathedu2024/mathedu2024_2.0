'use client';

import { CSSProperties } from 'react';
import { Listbox } from '@headlessui/react';
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
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button style={style} className={`select-unified pr-16 flex items-center justify-between ${className}`}>
          <span className="truncate">{options.find(o => o.value === value)?.label || placeholder}</span>
          <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
        </Listbox.Button>
        <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
          {options.map((option) => (
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
      </div>
    </Listbox>
  );
}
