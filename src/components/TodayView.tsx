import React, { useState, useRef, useCallback } from 'react';
import { ScheduleData, ShiftType, SHIFT_CONFIG, DEPARTMENT_CONFIG, Department, getDepartment } from '../types/schedule';
import { useTheme } from '../context/ThemeContext';

interface TodayViewProps {
  data: ScheduleData;
  fakeDate?: Date | null;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAYS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const SHIFT_CARD_GRADIENT: Record<ShiftType, string> = {
  daily:    'from-violet-600 to-purple-700',
  day:      'from-blue-500 to-sky-600',
  night:    'from-indigo-800 to-slate-900',
  off:      'from-gray-200 to-gray-300',
  vacation: 'from-emerald-500 to-teal-600',
  sick:     'from-red-500 to-rose-600',
};

const DEPT_ORDER: Department[] = ['bar_manager', 'power', 'bar', 'hall', 'kitchen'];

interface WorkingEntry {
  empId: string;
  name: string;
  role: string;
  color: string;
  shift: ShiftType;
  department: Department | null;
}

interface AbsentEntry {
  empId: string;
  name: string;
  role: string;
  color: string;
  shift: ShiftType;
}

interface DayData {
  date: Date;
  dateStr: string;
  working: WorkingEntry[];
  absent: AbsentEntry[];
}

function buildDayData(data: ScheduleData, date: Date): DayData {
  const dateStr = formatDate(date);
  const working: WorkingEntry[] = [];
  const absent: AbsentEntry[] = [];

  data.employees.forEach(emp => {
    const entry = data.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);
    const shift: ShiftType = entry?.shift ?? 'off';
    const role = entry?.role || emp.role;
    const department = getDepartment(role) ?? emp.department ?? null;

    if (shift === 'off') return;

    if (shift === 'vacation' || shift === 'sick') {
      absent.push({ empId: emp.id, name: emp.name, role, color: emp.color, shift });
    } else {
      working.push({ empId: emp.id, name: emp.name, role, color: emp.color, shift, department });
    }
  });

  return { date, dateStr, working, absent };
}

// ── Карточка одного дня ──────────────────────────────────────────────
interface DayCardProps {
  data: ScheduleData;
  date: Date;
  isToday: boolean;
}

const DayCard: React.FC<DayCardProps> = ({ data, date, isToday }) => {
  const { isDark } = useTheme();
  const day = buildDayData(data, date);

  const byDept: Record<Department, WorkingEntry[]> = {
    bar_manager: [], power: [], bar: [], hall: [], kitchen: [],
  };
  day.working.forEach(w => {
    const d = w.department ?? 'kitchen';
    byDept[d].push(w);
  });

  type ByShift = Partial<Record<ShiftType, WorkingEntry[]>>;
  const groupByShift = (list: WorkingEntry[]): ByShift => {
    const r: ByShift = {};
    list.forEach(w => {
      if (!r[w.shift]) r[w.shift] = [];
      r[w.shift]!.push(w);
    });
    return r;
  };

  const hasAnyone = day.working.length > 0 || day.absent.length > 0;

  return (
    <div className="w-full space-y-3">
      {/* Шапка дня */}
      <div className={`rounded-3xl p-5 text-white shadow-lg ${
        isToday
          ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-indigo-200'
          : 'bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-200'
      }`}>
        {isToday && (
          <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-0.5 mb-2">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[11px] font-bold tracking-wide uppercase">Сегодня</span>
          </div>
        )}
        <p className="text-white/70 text-sm font-medium capitalize">
          {DAYS_FULL[date.getDay()]}
        </p>
        <h2 className="text-3xl font-bold mt-0.5">
          {date.getDate()} {MONTHS_RU[date.getMonth()]}
        </h2>

        {/* Мини-статистика по типам смен — компактно, без счётчика */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['daily', 'day', 'night'] as ShiftType[]).map(t => {
            const cnt = day.working.filter(w => w.shift === t).length;
            if (cnt === 0) return null;
            const cfg = SHIFT_CONFIG[t];
            return (
              <div key={t} className="bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-1.5 flex items-center gap-1.5">
                <span className="text-base leading-none">{cfg.icon}</span>
                <span className="text-sm font-bold">{cnt}</span>
                <span className="text-xs text-white/70">{cfg.label.toLowerCase()}</span>
              </div>
            );
          })}
          {day.working.length === 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-1.5">
              <span className="text-xs text-white/70">Нет смен</span>
            </div>
          )}
        </div>
      </div>

      {/* Нет никого */}
      {!hasAnyone && (
        <div className={`rounded-2xl p-6 shadow-sm border text-center ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        }`}>
          <p className="text-3xl mb-2">📭</p>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Нет данных на этот день</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Проверьте подключение к таблице</p>
        </div>
      )}

      {/* Отделы */}
      {DEPT_ORDER.map(dept => {
        const group = byDept[dept];
        if (group.length === 0) return null;
        const deptCfg = DEPARTMENT_CONFIG[dept];
        const byShift = groupByShift(group);
        const shiftOrder: ShiftType[] = ['daily', 'day', 'night'];

        return (
          <div key={dept} className={`rounded-2xl shadow-sm border overflow-hidden ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
          }`}>
            {/* Заголовок отдела — БЕЗ счётчика */}
            <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${
              isDark ? 'border-slate-700 bg-slate-700/50' : `${deptCfg.bgColor} border-black/5`
            }`}>
              <span className="text-lg leading-none">{deptCfg.icon}</span>
              <span className="font-bold text-sm" style={{ color: deptCfg.color }}>{deptCfg.label}</span>
            </div>

            {/* Смены внутри отдела */}
            {shiftOrder.map(shiftType => {
              const shiftGroup = byShift[shiftType];
              if (!shiftGroup || shiftGroup.length === 0) return null;
              const sCfg = SHIFT_CONFIG[shiftType];
              const gradient = SHIFT_CARD_GRADIENT[shiftType];

              return (
                <div key={shiftType}>
                  {/* Мини-заголовок смены */}
                  <div className={`bg-gradient-to-r ${gradient} px-4 py-1.5 flex items-center gap-2`}>
                    <span className="text-sm">{sCfg.icon}</span>
                    <span className="text-xs font-semibold text-white">{sCfg.label}</span>
                    {sCfg.time && (
                      <span className="text-[10px] text-white/60 ml-1">{sCfg.time}</span>
                    )}
                  </div>

                  {/* Сотрудники */}
                  <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-50'}`}>
                    {shiftGroup.map(w => (
                      <div key={w.empId} className="flex items-center gap-3 px-4 py-2.5">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: w.color }}
                        >
                          {w.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                            {w.name}
                          </p>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
                            {w.role}
                          </p>
                        </div>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sCfg.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Отсутствующие */}
      {day.absent.length > 0 && (
        <div className={`rounded-2xl p-4 shadow-sm border ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        }`}>
          <h3 className={`font-bold text-sm mb-3 flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            <span>📋</span> Отсутствуют ({day.absent.length})
          </h3>
          <div className="space-y-2">
            {day.absent.map(a => {
              const cfg = SHIFT_CONFIG[a.shift];
              return (
                <div key={a.empId} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: a.color }}
                  >
                    {a.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                      {a.name}
                    </p>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{a.role}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bgColor} ${cfg.textColor} flex-shrink-0`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Главный компонент с горизонтальным слайдером ─────────────────────
export const TodayView: React.FC<TodayViewProps> = ({ data, fakeDate }) => {
  const { isDark } = useTheme();
  const baseDate = fakeDate ?? new Date();
  const [offset, setOffset] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) setOffset(o => o + 1);
      else setOffset(o => o - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  const currentDate = addDays(baseDate, offset);
  const isToday = offset === 0;

  // Вчера (-1) + Сегодня (0) + 6 дней вперёд = 8 дней
  const weekDays = Array.from({ length: 8 }, (_, i) => addDays(baseDate, i - 1));

  return (
    <div className="w-full space-y-3">
      {/* Горизонтальная строка дней */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
        {weekDays.map((d, i) => {
          const dayOffset = i - 1; // i=0 → вчера(-1), i=1 → сегодня(0), i=2..7 → +1..+6
          const isActive = dayOffset === offset;
          const isActualToday = dayOffset === 0;
          const dateStr = formatDate(d);
          const hasWorking = data.shifts.some(
            s => s.date === dateStr && s.shift !== 'off' && s.shift !== 'vacation' && s.shift !== 'sick'
          );

          return (
            <button
              key={i}
              onClick={() => setOffset(dayOffset)}
              className={`flex flex-col items-center px-2.5 py-2 rounded-2xl min-w-[44px] flex-shrink-0 transition-all active:scale-95 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : isActualToday
                  ? isDark ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                  : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {DAYS_SHORT[d.getDay()]}
              </span>
              <span className="text-base font-bold leading-tight mt-0.5">{d.getDate()}</span>
              <div className={`w-1 h-1 rounded-full mt-1 ${
                hasWorking
                  ? isActive ? 'bg-white/70' : 'bg-indigo-400'
                  : 'bg-transparent'
              }`} />
            </button>
          );
        })}
      </div>

      {/* Кнопка «Сегодня» */}
      {!isToday && (
        <button
          onClick={() => setOffset(0)}
          className={`w-full py-2 text-xs font-semibold rounded-xl border active:scale-95 transition-all ${
            isDark
              ? 'text-indigo-400 bg-indigo-900/30 border-indigo-800'
              : 'text-indigo-600 bg-indigo-50 border-indigo-100'
          }`}
        >
          ← Вернуться к сегодня
        </button>
      )}

      {/* Свайп-область */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full"
      >
        <DayCard data={data} date={currentDate} isToday={isToday} />
      </div>

      <p className={`text-center text-[10px] pb-1 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
        ← свайп для смены дня →
      </p>
    </div>
  );
};
