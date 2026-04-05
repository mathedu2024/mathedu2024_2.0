import React from 'react';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'date' | 'number' | 'tel' | 'url' | 'time' | 'datetime-local';
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  min?: string | number;
  max?: string | number;
  step?: string | number;
  id?: string;
  name?: string;
  autoComplete?: string;
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
  size = 'md',
  ...props
}: InputProps) {
  const baseClasses = 'border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-500';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-base min-h-[44px]',
    lg: 'px-5 py-3.5 text-lg min-h-[52px]'
  };

  const stateClasses = error 
    ? 'border-red-300 focus:ring-red-200 text-red-900 placeholder-red-300' 
    : 'border-gray-300 hover:border-gray-400';

  const widthClass = fullWidth ? 'w-full' : '';

  const inputClasses = `${baseClasses} ${sizeClasses[size]} ${stateClasses} ${widthClass} ${className}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        required={required}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500 ml-1 font-medium flex items-center">
           <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           {error}
        </p>
      )}
    </div>
  );
}