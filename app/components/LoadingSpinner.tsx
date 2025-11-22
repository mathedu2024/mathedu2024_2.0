import { MoonLoader } from 'react-spinners';

export interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  color?: 'blue' | 'white' | 'gray';
  className?: string;
  fullScreen?: boolean;
}

// 統一使用主視覺藍色 blue-600
export default function LoadingSpinner({ 
  className = '', 
  color = 'blue',
  fullScreen = false,
  size = 40,
  text = '',
}: LoadingSpinnerProps) {
  const colorMap = {
    blue: '#3B82F6',
    white: '#FFFFFF',
    gray: '#6B7280'
  };

  const content = (
    <div className={`flex items-center justify-center ${className}`}>
      <MoonLoader
        color={colorMap[color]}
        size={size}
        speedMultiplier={1}
      />
      {text && <span className="ml-2">{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
} 