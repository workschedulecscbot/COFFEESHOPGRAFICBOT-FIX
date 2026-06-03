import React from 'react';
import { Employee } from '../types/schedule';

interface AvatarProps {
  employee: Employee;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ employee, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}
      style={{ backgroundColor: employee.color }}
    >
      {getInitials(employee.name)}
    </div>
  );
};
