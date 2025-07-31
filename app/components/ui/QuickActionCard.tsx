import React from 'react';

export interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactElement;
  onClick: () => void;
  disabled?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red';
  className?: string;
}

export default function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
  color = 'blue',
  className = ''
}: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
    red: 'bg-red-100'
  };

  const disabledClasses = disabled
    ? 'bg-gray-100 cursor-not-allowed opacity-60 border-gray-200'
    : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-xl md:hover:-translate-y-1';

  const iconClasses = disabled
    ? 'bg-gray-200'
    : colorClasses[color];

  const textClasses = disabled
    ? 'text-gray-500'
    : 'text-gray-800';

  const descriptionClasses = disabled
    ? 'text-gray-400'
    : 'text-gray-600';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[260px] sm:min-w-0 text-left p-6 rounded-2xl transition-all sm:duration-200 md:duration-300 flex items-center border ${disabledClasses} ${className}`}
    >
      <div className={`p-4 rounded-xl mr-4 ${iconClasses}`}>
        {icon}
      </div>
      <div>
        <h3 className={`text-xl font-bold ${textClasses}`}>{title}</h3>
        <p className={`text-base mt-1 ${descriptionClasses}`}>{description}</p>
      </div>
    </button>
  );
} 