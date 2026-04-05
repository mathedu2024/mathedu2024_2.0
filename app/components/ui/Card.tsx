import React from 'react';

export interface CardProps {
  variant?: 'default' | 'stats' | 'action';
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'gray' | 'indigo';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({
  variant = 'default',
  color,
  children,
  className = '',
  onClick,
  hover = false
}: CardProps) {
  const baseClasses = 'bg-white rounded-2xl shadow-sm border border-gray-100';
  
  const variantClasses = {
    default: 'p-6',
    stats: 'p-5',
    action: 'p-6 cursor-pointer transition-all duration-300'
  };

  const colorClasses = {
    blue: 'border-l-4 border-indigo-500', // Blue maps to Indigo
    indigo: 'border-l-4 border-indigo-500',
    green: 'border-l-4 border-emerald-500',
    yellow: 'border-l-4 border-amber-500',
    purple: 'border-l-4 border-purple-500',
    red: 'border-l-4 border-rose-500',
    gray: 'border-l-4 border-gray-500'
  };

  const hoverClasses = hover || onClick ? 'hover:bg-gray-50/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300' : '';
  const clickClasses = onClick ? 'cursor-pointer' : '';

  const classes = `${baseClasses} ${variantClasses[variant]} ${color ? colorClasses[color] : ''} ${hoverClasses} ${clickClasses} ${className}`;

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}