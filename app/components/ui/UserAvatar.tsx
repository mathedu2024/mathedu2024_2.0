import React from 'react';

export interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: string;
  email?: string;
  className?: string;
  onClick?: () => void;
}

export default function UserAvatar({
  name,
  size = 'md',
  role,
  email,
  className = '',
  onClick
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarClasses = `inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-medium ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:bg-blue-700 transition-colors' : ''} ${className}`;

  return (
    <div className="flex items-center space-x-3">
      <div className={avatarClasses} onClick={onClick}>
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {role && (
          <p className="text-sm text-gray-500 truncate">({role})</p>
        )}
        {email && (
          <p className="text-sm text-gray-500 truncate">{email}</p>
        )}
      </div>
    </div>
  );
} 