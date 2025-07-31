import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = '請選擇...',
  disabled = false,
  error,
  label,
  required = false,
  className = '',
  fullWidth = true,
  size = 'md'
}: SelectProps) {
  const baseClasses = 'border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';
  
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-sm min-h-[32px]',
    md: 'px-3 py-2 text-base min-h-[44px]',
    lg: 'px-4 py-3 text-lg min-h-[48px]'
  };

  const stateClasses = disabled 
    ? 'bg-gray-100 cursor-not-allowed text-gray-500' 
    : error 
    ? 'border-red-500 focus:ring-red-500' 
    : '';

  const widthClass = fullWidth ? 'w-full' : '';

  const selectClasses = `${baseClasses} ${sizeClasses[size]} ${stateClasses} ${widthClass} ${className}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        className={selectClasses}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
} 