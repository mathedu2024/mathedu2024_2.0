import React from 'react';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'date' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  error,
  label,
  required = false,
  className = '',
  fullWidth = true,
  size = 'md'
}: InputProps) {
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

  const inputClasses = `${baseClasses} ${sizeClasses[size]} ${stateClasses} ${widthClass} ${className}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        required={required}
        className={inputClasses}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
} 