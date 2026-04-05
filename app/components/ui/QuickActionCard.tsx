import React from 'react';

export interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactElement<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red' | 'indigo';
  className?: string;
}

export default function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
  color = 'indigo',
  className = ''
}: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    green: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white',
    yellow: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    red: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
  };

  const disabledClasses = disabled
    ? 'bg-gray-50 cursor-not-allowed opacity-60 border-gray-200'
    : 'bg-white hover:bg-white border-gray-200 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer';

  const iconContainerClasses = disabled
    ? 'bg-gray-200 text-gray-400'
    : `${colorClasses[color]} transition-colors duration-300`;

  const textClasses = disabled ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-900';
  const descriptionClasses = disabled ? 'text-gray-400' : 'text-gray-500';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`group relative flex items-center p-5 rounded-2xl border transition-all duration-300 ${disabledClasses} ${className}`}
    >
      <div className={`p-3 rounded-xl mr-4 flex-shrink-0 ${iconContainerClasses}`}>
        {React.cloneElement(icon, { className: "w-6 h-6" })}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-lg font-bold truncate ${textClasses}`}>{title}</h3>
        <p className={`text-sm mt-0.5 truncate ${descriptionClasses}`}>{description}</p>
      </div>
      {!disabled && (
        <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
      )}
    </div>
  );
}