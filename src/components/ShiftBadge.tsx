import React from 'react';
import { ShiftType, SHIFT_CONFIG } from '../types/schedule';

interface ShiftBadgeProps {
  shift: ShiftType;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export const ShiftBadge: React.FC<ShiftBadgeProps> = ({ shift, size = 'sm', showLabel = false }) => {
  const cfg = SHIFT_CONFIG[shift];

  if (shift === 'off') {
    return (
      <div className={`flex items-center justify-center ${size === 'xs' ? 'w-7 h-7' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'}`}>
        <span className="text-gray-200 text-xs font-bold">—</span>
      </div>
    );
  }

  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
  };

  // Цвета фона для каждого типа
  const bgStyles: Record<ShiftType, string> = {
    daily: 'bg-violet-600',
    day: 'bg-blue-500',
    night: 'bg-indigo-900',
    off: 'bg-gray-100',
    vacation: 'bg-emerald-500',
    sick: 'bg-red-500',
  };

  const textStyles: Record<ShiftType, string> = {
    daily: 'text-white',
    day: 'text-white',
    night: 'text-indigo-100',
    off: 'text-gray-300',
    vacation: 'text-white',
    sick: 'text-white',
  };

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl font-bold leading-none
      ${sizeClasses[size]} ${bgStyles[shift]} ${textStyles[shift]}`}>
      <span>{cfg.shortLabel}</span>
      {showLabel && (
        <span className="text-[8px] mt-0.5 opacity-80">{cfg.label}</span>
      )}
    </div>
  );
};
