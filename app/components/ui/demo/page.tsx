'use client';

import React, { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import LoadingSpinner from '../LoadingSpinner'; // 假設 LoadingSpinner 在 components 目錄

// --- Button ---
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  fullWidth = false, 
  disabled, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg shadow-indigo-200 focus:ring-indigo-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-400",
    danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-md hover:shadow-lg shadow-rose-200 focus:ring-rose-500",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg shadow-emerald-200 focus:ring-emerald-500",
    warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-md hover:shadow-lg shadow-amber-200 focus:ring-amber-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <div className="mr-2"><LoadingSpinner size={size === 'sm' ? 12 : 16} color="white" /></div>}
      {children}
    </button>
  );
};

// --- Card ---
interface CardProps {
  children: React.ReactNode;
  className?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'indigo';
  onClick?: () => void;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', color, onClick, hover }) => {
  const colorBorders = {
    blue: 'border-l-4 border-l-blue-500',
    green: 'border-l-4 border-l-emerald-500',
    yellow: 'border-l-4 border-l-amber-500',
    purple: 'border-l-4 border-l-purple-500',
    red: 'border-l-4 border-l-rose-500',
    indigo: 'border-l-4 border-l-indigo-500',
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 border border-gray-100 shadow-sm ${color ? colorBorders[color] : ''} ${hover || onClick ? 'hover:shadow-md hover:-translate-y-1 cursor-pointer transition-all duration-300' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

// --- Input ---
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">{label}</label>}
      <input 
        className={`w-full px-4 py-2.5 border rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-300'} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );
};

// --- Select ---
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({ label, error, options, placeholder, className = '', value, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">{label}</label>}
      <div className="relative">
        <select 
          className={`w-full px-4 py-2.5 border rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-300'} ${className}`}
          value={value}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );
};

export default function DemoPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">UI Components Demo</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <div className="flex gap-4 flex-wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button loading>Loading</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card color="indigo" hover>
            <h3 className="font-bold">Indigo Card</h3>
            <p>Content goes here</p>
          </Card>
          <Card color="green">
            <h3 className="font-bold">Green Card</h3>
            <p>Content goes here</p>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Inputs</h2>
        <div className="max-w-md space-y-4">
          <Input label="Username" placeholder="Enter username" />
          <Input label="Error State" error="This field is required" />
          <Select 
            label="Role" 
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'user', label: 'User' }
            ]} 
          />
        </div>
      </section>
    </div>
  );
}