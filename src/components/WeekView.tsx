import React from 'react';
import { ScheduleData, ShiftType, SHIFT_CONFIG } from '../types/schedule';
import { Avatar } from './Avatar';
import { useTheme } from '../context/ThemeContext';

interface WeekViewProps {
  data: ScheduleData;
  weekStart: Date;
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const CELL_BG: Record<ShiftType, string> = {
  daily:    'bg-violet-600 text-white',
  day:      'bg-blue-500 text-white',
  night:    'bg-indigo-900 text-indigo-100',
  off:      'bg-transparent text-gray-200',
  vacation: 'bg-emerald-500 text-white',
  sick:     'bg-red-500 text-white',
};

export const WeekView: React.FC<WeekViewProps> = ({ data, weekStart }) => {
  const { isDark } = useTheme();
  const days = getWeekDays(weekStart);
  const today = formatDate(new Date());

  const getShift = (empId: string, date: string): ShiftType => {
    const entry = data.shifts.find(s => s.employeeId === empId && s.date === date);
    return entry?.shift ?? 'off';
  };

  const countWorking = (date: string) =>
    data.employees.filter(emp => {
      const s = getShift(emp.id, date);
      return s !== 'off';
    }).length;

  const rowBg = isDark
    ? 'bg-slate-800/80 border-slate-700/60'
    : 'bg-white/80 border-white/60';

  const legendBg = isDark
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white/80 border-white/60';

  return (
    <div className="w-full min-w-0">
      {/* Заголовки дней */}
      <div className="flex gap-1 mb-2">
        <div className="w-[90px] flex-shrink-0" />
        {days.map((day, i) => {
          const dateStr = formatDate(day);
          const isToday = dateStr === today;
          const isWeekend = i >= 5;
          const count = countWorking(dateStr);
          return (
            <div
              key={dateStr}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl min-w-0 transition-all ${
                isToday
                  ? 'bg-indigo-600 shadow-md shadow-indigo-200'
                  : isWeekend
                  ? isDark ? 'bg-rose-900/30' : 'bg-rose-50'
                  : isDark ? 'bg-slate-800/70' : 'bg-white/70'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wide ${
                isToday ? 'text-indigo-200' : isWeekend
                  ? isDark ? 'text-rose-400' : 'text-rose-400'
                  : isDark ? 'text-slate-400' : 'text-gray-400'
              }`}>
                {DAY_LABELS[i]}
              </span>
              <span className={`text-sm font-extrabold leading-tight ${
                isToday ? 'text-white' : isWeekend
                  ? isDark ? 'text-rose-400' : 'text-rose-500'
                  : isDark ? 'text-slate-200' : 'text-gray-800'
              }`}>
                {day.getDate()}
              </span>
              <span className={`text-[9px] mt-0.5 font-medium ${
                isToday ? 'text-indigo-200' : isDark ? 'text-slate-500' : 'text-gray-400'
              }`}>
                {count > 0 ? `${count}` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Строки сотрудников */}
      <div className="space-y-1.5">
        {data.employees.map(emp => (
          <div
            key={emp.id}
            className={`flex items-center gap-1 backdrop-blur-sm rounded-2xl px-1.5 py-1.5 shadow-sm border ${rowBg}`}
          >
            {/* Имя */}
            <div className="w-[90px] flex-shrink-0 flex items-center gap-1.5 min-w-0 pr-1">
              <Avatar employee={emp} size="sm" />
              <div className="min-w-0">
                <p className={`text-[11px] font-semibold truncate leading-tight ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  {emp.name.split(' ')[0]}
                </p>
                <p className={`text-[9px] truncate leading-tight ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {emp.role}
                </p>
              </div>
            </div>

            {/* Смены */}
            {days.map(day => {
              const dateStr = formatDate(day);
              const isToday = dateStr === today;
              const shift = getShift(emp.id, dateStr);
              const cfg = SHIFT_CONFIG[shift];
              const cellBg = CELL_BG[shift];

              return (
                <div
                  key={dateStr}
                  className={`flex-1 flex items-center justify-center rounded-xl py-1.5 min-w-0 transition-all
                    ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                    ${shift === 'off' ? '' : cellBg}`}
                >
                  {shift === 'off' ? (
                    <span className={`text-[11px] font-bold ${isDark ? 'text-slate-700' : 'text-gray-200'}`}>—</span>
                  ) : (
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[10px]">{cfg.icon}</span>
                      <span className={`text-[10px] font-extrabold ${shift === 'night' ? 'text-indigo-200' : 'text-white'}`}>
                        {cfg.shortLabel}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Легенда */}
      <div className={`mt-4 rounded-2xl p-3 shadow-sm border ${legendBg}`}>
        <p className={`text-[10px] font-semibold mb-2 uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          Легенда
        </p>
        <div className="flex flex-wrap gap-2">
          {(['daily', 'day', 'night', 'vacation', 'sick'] as ShiftType[]).map(t => {
            const cfg = SHIFT_CONFIG[t];
            const bg = CELL_BG[t];
            return (
              <div key={t} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${bg}`}>
                <span className="text-xs">{cfg.icon}</span>
                <span className="text-[10px] font-bold">
                  {cfg.shortLabel} — {cfg.label}
                </span>
                {cfg.time && (
                  <span className="text-[9px] opacity-80">{cfg.time}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
