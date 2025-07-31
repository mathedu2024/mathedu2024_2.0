import React from 'react';

export interface CardProps {
  variant?: 'default' | 'stats' | 'action';
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'gray';
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
  const baseClasses = 'bg-white rounded-lg shadow-md';
  
  const variantClasses = {
    default: 'p-6',
    stats: 'p-4 md:p-6',
    action: 'p-6 cursor-pointer transition-all duration-200'
  };

  const colorClasses = {
    blue: 'border-l-4 border-blue-500',
    green: 'border-l-4 border-green-500',
    yellow: 'border-l-4 border-yellow-500',
    purple: 'border-l-4 border-purple-500',
    red: 'border-l-4 border-red-500',
    gray: 'border-l-4 border-gray-500'
  };

  const hoverClasses = hover ? 'hover:bg-gray-50 hover:shadow-lg' : '';
  const clickClasses = onClick ? 'cursor-pointer' : '';

  const classes = `${baseClasses} ${variantClasses[variant]} ${color ? colorClasses[color] : ''} ${hoverClasses} ${clickClasses} ${className}`;

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
} 