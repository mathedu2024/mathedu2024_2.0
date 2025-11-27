import { MoonLoader } from 'react-spinners';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: 'blue' | 'white' | 'gray';
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  color = 'blue',
  text,
  className = '',
  fullScreen = false
}: LoadingSpinnerProps) {
  const colorMap = {
    blue: '#3B82F6',
    white: '#FFFFFF',
    gray: '#6B7280'
  };

  const sizeMap = {
    xs: 20,
    sm: 30,
    md: 40,
    lg: 50,
    xl: 60
  };
  
  const numericSize = typeof size === 'number' ? size : sizeMap[size];

  const content = (
    <div className={`flex flex-row items-center justify-center ${className}`}>
      <MoonLoader
        color={colorMap[color]}
        size={numericSize}
        speedMultiplier={1}
      />
      {text && <span className="ml-2 text-white">{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex flex-col items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
 