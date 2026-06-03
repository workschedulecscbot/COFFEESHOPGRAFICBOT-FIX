import React, { useState } from 'react';
import {
  ScheduleData, ShiftType, SHIFT_CONFIG,
  DEPARTMENT_CONFIG, Department, Employee,
} from '../types/schedule';
import { useTheme } from '../context/ThemeContext';

interface StaffViewProps {
  data: ScheduleData;
  month: number;
  year: number;
  fakeDate?: Date | null;
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const DAY_LABELS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const DEPT_ORDER: Department[] = ['bar_manager', 'power', 'bar', 'hall', 'kitchen'];

const TIMELINE_COLOR: Record<ShiftType, string> = {
  daily:    'bg-violet-500',
  day:      'bg-blue-400',
  night:    'bg-indigo-600',
  off:      'bg-gray-100',
  vacation: 'bg-emerald-400',
  sick:     'bg-red-400',
};

const TIMELINE_COLOR_DARK: Record<ShiftType, string> = {
  daily:    'bg-violet-500',
  day:      'bg-blue-400',
  night:    'bg-indigo-600',
  off:      'bg-slate-700',
  vacation: 'bg-emerald-500',
  sick:     'bg-red-500',
};

const CAL_CELL: Record<ShiftType, string> = {
  daily:    'bg-violet-100 border-violet-400 text-violet-700',
  day:      'bg-blue-100 border-blue-400 text-blue-700',
  night:    'bg-indigo-950 border-indigo-500 text-indigo-200',
  off:      'bg-gray-50 border-gray-100 text-gray-300',
  vacation: 'bg-emerald-100 border-emerald-400 text-emerald-700',
  sick:     'bg-red-100 border-red-400 text-red-700',
};

const CAL_CELL_DARK: Record<ShiftType, string> = {
  daily:    'bg-violet-900/40 border-violet-600 text-violet-300',
  day:      'bg-blue-900/40 border-blue-600 text-blue-300',
  night:    'bg-indigo-950 border-indigo-700 text-indigo-300',
  off:      'bg-slate-800/50 border-slate-700 text-slate-600',
  vacation: 'bg-emerald-900/40 border-emerald-600 text-emerald-300',
  sick:     'bg-red-900/40 border-red-600 text-red-300',
};

// ── Личный календарь сотрудника ───────────────────────────────────────
interface EmployeeCalendarProps {
  employee: Employee;
  data: ScheduleData;
  month: number;
  year: number;
  todayStr: string;
  onClose: () => void;
}

const EmployeeCalendar: React.FC<EmployeeCalendarProps> = ({
  employee, data, month, year, todayStr, onClose,
}) => {
  const { isDark } = useTheme();
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const calCell = isDark ? CAL_CELL_DARK : CAL_CELL;
  const timelineColor = isDark ? TIMELINE_COLOR_DARK : TIMELINE_COLOR;

  const getShift = (day: number): ShiftType => {
    const dateStr = formatDate(year, month, day);
    return data.shifts.find(s => s.employeeId === employee.id && s.date === dateStr)?.shift ?? 'off';
  };

  // Статистика
  const stats: Partial<Record<ShiftType, number>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const s = getShift(d);
    if (s !== 'off') stats[s] = (stats[s] || 0) + 1;
  }

  const MONTHS_RU_FULL = [
    'Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`relative w-full max-w-md rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col ${
          isDark ? 'bg-slate-900' : 'bg-gray-50'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {/* Карточка сотрудника */}
          <div
            className="rounded-3xl p-5 text-white shadow-lg mb-4 mt-2"
            style={{ background: `linear-gradient(135deg, ${employee.color}, ${employee.color}cc)` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-extrabold text-xl shadow-inner">
                {employee.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-lg leading-tight">{employee.name}</h3>
                <p className="text-white/70 text-sm">{employee.role}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg active:scale-95"
              >×</button>
            </div>

            <div className="mt-4 text-sm font-semibold text-white/80">
              {MONTHS_RU_FULL[month - 1]} {year}
            </div>
          </div>

          {/* Статистика смен */}
          {Object.keys(stats).length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(Object.entries(stats) as [ShiftType, number][]).map(([shift, cnt]) => {
                const cfg = SHIFT_CONFIG[shift];
                return (
                  <div key={shift} className={`rounded-2xl p-3 text-center border-2 ${calCell[shift]}`}>
                    <div className="text-xl mb-1">{cfg.icon}</div>
                    <div className="text-2xl font-extrabold leading-none">{cnt}</div>
                    <div className="text-[10px] mt-1 font-semibold opacity-80">{cfg.label}</div>
                    {cfg.time && <div className="text-[9px] opacity-60 mt-0.5">{cfg.time}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Мини-таймлайн */}
          <div className={`rounded-2xl p-3 mb-3 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
            <p className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              Таймлайн месяца
            </p>
            <div className="flex gap-px rounded-lg overflow-hidden">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const shift = getShift(day);
                const dateStr = formatDate(year, month, day);
                const isTodayCell = dateStr === todayStr;
                return (
                  <div
                    key={day}
                    title={`${day}: ${SHIFT_CONFIG[shift].label}`}
                    className={`flex-1 h-6 ${timelineColor[shift]} ${isTodayCell ? 'ring-2 ring-indigo-400 ring-inset relative z-10' : ''}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>1</span>
              <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>{daysInMonth}</span>
            </div>
          </div>

          {/* Календарная сетка */}
          <div className={`rounded-2xl p-3 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS_SHORT.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-bold py-1 ${
                  i >= 5
                    ? isDark ? 'text-rose-400' : 'text-rose-400'
                    : isDark ? 'text-slate-500' : 'text-gray-400'
                }`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = formatDate(year, month, day);
                const shift = getShift(day);
                const isTodayCell = dateStr === todayStr;
                const dow = new Date(year, month - 1, day).getDay();
                const isWeekend = dow === 0 || dow === 6;

                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-bold border-2 transition-all
                      ${isTodayCell ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                      ${calCell[shift]}`}
                  >
                    <span className={`text-[10px] font-bold ${
                      shift === 'off' && isWeekend
                        ? isDark ? 'text-rose-700' : 'text-rose-300'
                        : shift === 'off'
                        ? isDark ? 'text-slate-600' : 'text-gray-300'
                        : ''
                    }`}>{day}</span>
                    {shift !== 'off' && (
                      <span className="text-[9px] leading-none mt-0.5 font-extrabold">
                        {SHIFT_CONFIG[shift].shortLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Карточка сотрудника в списке ──────────────────────────────────────
interface EmployeeCardProps {
  employee: Employee;
  data: ScheduleData;
  month: number;
  year: number;
  todayStr: string;
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee, data, month, year, todayStr, onClick,
}) => {
  const { isDark } = useTheme();
  const daysInMonth = new Date(year, month, 0).getDate();
  const timelineColor = isDark ? TIMELINE_COLOR_DARK : TIMELINE_COLOR;

  const getShift = (day: number): ShiftType => {
    const dateStr = formatDate(year, month, day);
    return data.shifts.find(s => s.employeeId === employee.id && s.date === dateStr)?.shift ?? 'off';
  };

  const stats: Partial<Record<ShiftType, number>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const s = getShift(d);
    if (s !== 'off') stats[s] = (stats[s] || 0) + 1;
  }

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl p-3 shadow-sm border transition-all text-left active:scale-[0.99] ${
        isDark
          ? 'bg-slate-800 border-slate-700 hover:border-indigo-700'
          : 'bg-white border-gray-100 hover:border-indigo-200'
      }`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        {/* Аватар */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
          style={{ backgroundColor: employee.color }}
        >
          {employee.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
            {employee.name}
          </p>
          <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {employee.role}
          </p>
        </div>

        {/* Значки-счётчики */}
        <div className="flex gap-1 flex-shrink-0">
          {(Object.entries(stats) as [ShiftType, number][]).map(([shift, cnt]) => {
            const cfg = SHIFT_CONFIG[shift];
            return (
              <span
                key={shift}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${cfg.bgColor} ${cfg.textColor}`}
              >
                {cfg.shortLabel}×{cnt}
              </span>
            );
          })}
          {Object.keys(stats).length === 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-lg ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
              нет смен
            </span>
          )}
        </div>

        <span className={`text-sm flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>›</span>
      </div>

      {/* Мини-таймлайн */}
      <div className="flex gap-px rounded-lg overflow-hidden">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const shift = getShift(day);
          const dateStr = formatDate(year, month, day);
          const isTodayCell = dateStr === todayStr;
          return (
            <div
              key={day}
              className={`flex-1 h-4 ${timelineColor[shift]} ${isTodayCell ? 'ring-1 ring-indigo-400 ring-inset' : ''}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>1</span>
        <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>{daysInMonth}</span>
      </div>
    </button>
  );
};

// ── Главный компонент ─────────────────────────────────────────────────
export const StaffView: React.FC<StaffViewProps> = ({ data, month, year, fakeDate }) => {
  const { isDark } = useTheme();
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [activeDept, setActiveDept] = useState<Department | 'all'>('all');

  const today = fakeDate ?? new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Группировка по отделам
  const byDept: Record<Department, Employee[]> = { bar_manager: [], power: [], bar: [], hall: [], kitchen: [] };
  const unassigned: Employee[] = [];

  data.employees.forEach(emp => {
    const dept = emp.department;
    if (dept && byDept[dept]) {
      byDept[dept].push(emp);
    } else {
      unassigned.push(emp);
    }
  });

  const selectedEmp = selectedEmpId ? data.employees.find(e => e.id === selectedEmpId) : null;

  const deptTabs: { id: Department | 'all'; label: string; icon: string; count: number }[] = [
    { id: 'all', label: 'Все', icon: '👥', count: data.employees.length },
    ...DEPT_ORDER
      .filter(d => byDept[d].length > 0)
      .map(d => ({
        id: d as Department | 'all',
        label: DEPARTMENT_CONFIG[d].label,
        icon: DEPARTMENT_CONFIG[d].icon,
        count: byDept[d].length,
      })),
  ];

  const getVisibleDepts = (): { dept: Department; employees: Employee[] }[] => {
    if (activeDept === 'all') {
      const result: { dept: Department; employees: Employee[] }[] = [];
      DEPT_ORDER.forEach(d => {
        if (byDept[d].length) result.push({ dept: d, employees: byDept[d] });
      });
      return result;
    }
    return byDept[activeDept as Department].length
      ? [{ dept: activeDept as Department, employees: byDept[activeDept as Department] }]
      : [];
  };

  return (
    <div className="w-full">
      {/* Фильтр по отделам */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {deptTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveDept(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
              activeDept === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : isDark
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeDept === tab.id
                ? 'bg-white/20 text-white'
                : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-500'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Список по отделам */}
      <div className="space-y-4">
        {getVisibleDepts().map(({ dept, employees }) => {
          const deptCfg = DEPARTMENT_CONFIG[dept];
          return (
            <div key={dept}>
              {/* Заголовок отдела */}
              <div className={`flex items-center gap-2 px-1 mb-2`}>
                <span className="text-base">{deptCfg.icon}</span>
                <span className="font-bold text-sm" style={{ color: deptCfg.color }}>
                  {deptCfg.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isDark ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-500'
                }`}>{employees.length} чел.</span>
              </div>

              {/* Карточки сотрудников */}
              <div className="space-y-2">
                {employees.map(emp => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    data={data}
                    month={month}
                    year={year}
                    todayStr={todayStr}
                    onClick={() => setSelectedEmpId(emp.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Нераспределённые */}
        {(activeDept === 'all') && unassigned.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-base">❓</span>
              <span className={`font-bold text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Другие</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                isDark ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-500'
              }`}>{unassigned.length} чел.</span>
            </div>
            <div className="space-y-2">
              {unassigned.map(emp => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  data={data}
                  month={month}
                  year={year}
                  todayStr={todayStr}
                  onClick={() => setSelectedEmpId(emp.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Личный календарь */}
      {selectedEmp && (
        <EmployeeCalendar
          employee={selectedEmp}
          data={data}
          month={month}
          year={year}
          todayStr={todayStr}
          onClose={() => setSelectedEmpId(null)}
        />
      )}
    </div>
  );
};
