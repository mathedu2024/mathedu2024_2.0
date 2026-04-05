import React from 'react';
import Card from './Card';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactElement<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'indigo';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  color = 'indigo',
  trend,
  trendValue,
  description,
  onClick,
  className = ''
}: StatsCardProps) {
  const colorClasses = {
    blue: 'text-indigo-600 bg-indigo-50', // Map blue to indigo style
    indigo: 'text-indigo-600 bg-indigo-50',
    green: 'text-emerald-600 bg-emerald-50',
    yellow: 'text-amber-600 bg-amber-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-rose-600 bg-rose-50'
  };

  const trendClasses = {
    up: 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full',
    down: 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full',
    neutral: 'text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  };

  return (
    <Card
      color={color}
      onClick={onClick}
      hover={!!onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div className="flex justify-between items-start">
        <div className="relative z-10">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h4 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h4>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            {React.cloneElement(icon, { className: "w-6 h-6" })}
          </div>
        )}
      </div>
      
      {trend && trendValue && (
        <div className="mt-4 flex items-center">
            <span className={`text-xs font-bold flex items-center ${trendClasses[trend]}`}>
            <span className="mr-1">{trendIcons[trend]}</span> {trendValue}
            </span>
            <span className="text-xs text-gray-400 ml-2">較上月</span>
        </div>
      )}
    </Card>
  );
}