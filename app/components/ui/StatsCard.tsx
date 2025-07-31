import React from 'react';
import Card from './Card';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactElement;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
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
  color = 'blue',
  trend,
  trendValue,
  description,
  onClick,
  className = ''
}: StatsCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    purple: 'text-purple-600 bg-purple-100',
    red: 'text-red-600 bg-red-100'
  };

  const trendClasses = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  };

  return (
    <Card
      variant="stats"
      color={color}
      onClick={onClick}
      hover={!!onClick}
      className={className}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-medium ${trendClasses[trend]}`}>
                {trendIcons[trend]} {trendValue}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
} 