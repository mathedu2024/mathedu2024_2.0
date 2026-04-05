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
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  };

  // 根據角色決定配色
  const getRoleColorClass = (roleName?: string) => {
    const r = roleName?.toLowerCase() || '';
    if (r.includes('admin') || r.includes('管理員')) return 'bg-purple-100 text-purple-700 ring-purple-50';
    if (r.includes('teacher') || r.includes('老師')) return 'bg-indigo-100 text-indigo-700 ring-indigo-50';
    if (r.includes('student') || r.includes('學生')) return 'bg-emerald-100 text-emerald-700 ring-emerald-50';
    return 'bg-gray-100 text-gray-600 ring-gray-50'; // Default
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    // 針對中文姓名取最後兩個字，英文取首字母
    if (/[\u4e00-\u9fa5]/.test(name)) {
        return name.length > 2 ? name.slice(-2) : name;
    }
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const colorClass = getRoleColorClass(role);
  
  const avatarClasses = `
    inline-flex items-center justify-center rounded-full font-bold 
    ring-4 ring-opacity-50 transition-all duration-200
    ${colorClass} 
    ${sizeClasses[size]} 
    ${onClick ? 'cursor-pointer hover:ring-opacity-100 hover:scale-105 active:scale-95' : ''} 
    ${className}
  `;

  return (
    <div className={`flex items-center gap-3 ${onClick ? 'cursor-pointer group' : ''}`} onClick={onClick}>
      <div className={avatarClasses}>
        {getInitials(name)}
      </div>
      {(role || email) && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold text-gray-800 truncate ${onClick ? 'group-hover:text-indigo-600 transition-colors' : ''}`}>
                {name}
            </p>
            {role && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-gray-100 text-gray-500`}>
                    {role}
                </span>
            )}
          </div>
          {email && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{email}</p>
          )}
        </div>
      )}
    </div>
  );
}