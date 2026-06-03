import React, { useMemo, useState, useEffect } from 'react';
import { ScheduleData, ShiftEntry, Employee, ShiftType, SHIFT_CONFIG, DEPARTMENT_CONFIG, Department, getDepartment } from '../types/schedule';
import { getShiftEdit } from '../utils/adminEdits';
import { useTheme } from '../context/ThemeContext';

interface MonthViewProps {
  data: ScheduleData;
  month: number;
  year: number;
  fakeDate?: Date | null;
  linkedEmpId?: string | null;
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function calcHoursFromTimeRange(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return Math.round(((endMin - startMin) / 60) * 100) / 100;
}

function formatTimeRange(start?: string, end?: string) {
  const s = start ? start.slice(0, 2) : '';
  const e = end ? end.slice(0, 2) : '';
  if (!s && !e) return '';
  return `${s}${s && e ? '–' : ''}${e}`;
}

type DaySegment = { label: string; color: string; dept: Department };

const SHIFT_TIMES: Record<ShiftType, { start: string; end: string; short: string } | null> = {
  daily:    { start: '09:00', end: '09:00', short: '09-09' },
  day:      { start: '09:00', end: '20:00', short: '09-20' },
  night:    { start: '20:00', end: '09:00', short: '20-09' },
  off:      null,
  vacation: null,
  sick:     null,
};

function getDaySegmentsForEmployee(emp: Employee, dateStr: string, shifts: ShiftEntry[]): DaySegment[] {
  console.log(`[getDaySegmentsForEmployee] ВЫЗОВ: ${emp.name} ${dateStr}, всего shifts: ${shifts.length}`);
  
  const entries = shifts.filter(s => s.employeeId === emp.id && s.date === dateStr);
  console.log(`[getDaySegmentsForEmployee] entries для ${emp.name}: ${entries.length}`, entries);
  
  if (!entries.length) return [];

  // Если есть shiftsWithTimes - не показываем на календаре
  if (entries.some(e => e.shiftsWithTimes?.length)) {
    return [];
  }

  const segments: DaySegment[] = [];
  
  for (const entry of entries) {
    const baseRole = entry.role || emp.role;
    const deptBase = getDepartment(baseRole) ?? emp.department ?? 'kitchen';
    const shift = entry.shift;
    
    console.log(`[getDaySegmentsForEmployee] ${emp.name} ${dateStr}: shift=${shift}, has ms=${!!entry.multipleShifts}, ms=${entry.multipleShifts}`);

    // Если есть multipleShifts с информацией о типах смен (shift field)
    // показываем временные диапазоны для каждой смены
    if (entry.multipleShifts?.some(ms => ms.shift)) {
      console.log(`[getDaySegmentsForEmployee] multipleShifts с shift для ${emp.name}:`, entry.multipleShifts);
      for (const ms of entry.multipleShifts) {
        if (ms.shift) {
          const times = SHIFT_TIMES[ms.shift];
          console.log(`  - Добавляю на календарь: ${ms.shift} ${times?.short}`);
          if (times?.short) {
            segments.push({
              label: times.short,
              color: DEPARTMENT_CONFIG[ms.dept].color,
              dept: ms.dept
            });
          }
        }
      }
    }
    // Если есть multipleShifts с часами (3Б 2К)
    else if (entry.multipleShifts?.some(ms => ms.hours > 0)) {
      for (const ms of entry.multipleShifts) {
        if (ms.hours > 0) {
          segments.push({
            label: `${ms.hours}ч`,
            color: DEPARTMENT_CONFIG[ms.dept].color,
            dept: ms.dept
          });
        }
      }
    }
    // Если есть часы для одной роли
    else if (entry.hours && entry.hours > 0) {
      segments.push({
        label: `${entry.hours}ч`,
        color: DEPARTMENT_CONFIG[deptBase].color,
        dept: deptBase
      });
    }
    // Обычная смена - показываем время
    else if (shift && shift !== 'off' && shift !== 'vacation' && shift !== 'sick') {
      const times = SHIFT_TIMES[shift];
      if (times?.short) {
        segments.push({
          label: times.short,
          color: DEPARTMENT_CONFIG[deptBase].color,
          dept: deptBase
        });
      }
    }
  }
  
  if (segments.length > 0) console.log(`[getDaySegmentsForEmployee] ${emp.name} ${dateStr}: segments=`, segments);

  return segments;
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU_FULL = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

const MONTHS_RU_GEN = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];

const DAYS_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

const DEPT_ORDER: Department[] = ['bar_manager', 'power', 'bar', 'hall', 'kitchen'];

const SHIFT_CARD_GRADIENT: Record<ShiftType, string> = {
  daily:    'from-violet-600 to-purple-700',
  day:      'from-blue-500 to-sky-600',
  night:    'from-indigo-800 to-slate-900',
  off:      'from-gray-200 to-gray-300',
  vacation: 'from-emerald-500 to-teal-600',
  sick:     'from-red-500 to-rose-600',
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

// Доминирующий тип смены для ячейки (если несколько — самый «интересный»)
const SHIFT_PRIORITY: ShiftType[] = ['sick', 'vacation', 'daily', 'day', 'night', 'off'];

function getDominantShift(shifts: ShiftType[]): ShiftType {
  for (const s of SHIFT_PRIORITY) {
    if (shifts.includes(s)) return s;
  }
  return 'off';
}

// ── Модалка дня ──────────────────────────────────────────────────────
interface DayModalProps {
  day: number;
  month: number;
  year: number;
  date: Date;
  data: ScheduleData;
  onClose: () => void;
}

const DayModal: React.FC<DayModalProps> = ({ day, month, year, date, data, onClose }) => {
  const { isDark } = useTheme();
  const dateStr = formatDate(year, month, day);
  
  useEffect(() => {
    console.log(`✅ DayModal useEffect: dateStr=${dateStr}, total shifts=${data.shifts.length}`);
  }, [dateStr, data.shifts.length]);

  // Собираем всех кто работает
  const working: { name: string; role: string; color: string; shift: ShiftType; dept: Department | null; customStart?: string; customEnd?: string }[] = [];
  const absent:  { name: string; role: string; color: string; shift: ShiftType }[] = [];

  data.employees.forEach(emp => {
    // Ищем ВСЕ записи для этого сотрудника в эту дату (может быть несколько должностей)
    const entries = data.shifts.filter(s => s.employeeId === emp.id && s.date === dateStr);
    
    // ДИАГНОСТИКА
    if (emp.name === 'Овчаренко Владимир' && dateStr === '2026-06-30') {
      console.log(`[DEBUG] Овчаренко на 30 июня:`);
      console.log(`  - Ищу: employeeId="${emp.id}", date="${dateStr}"`);
      console.log(`  - Найдено entries: ${entries.length}`, entries);
      console.log(`  - Всего shifts: ${data.shifts.length}`);
      const allForThisDate = data.shifts.filter(s => s.date === dateStr);
      console.log(`  - Всего смен на эту дату: ${allForThisDate.length}`);
    }
    
    if (!entries.length) return;

    for (const entry of entries) {
      const shift: ShiftType = entry?.shift ?? 'off';
      const role = entry?.role || emp.role;
      
      // Пропускаем только если нет ни смены, ни часов (multipleShifts)
      if (shift === 'off' && !entry?.hours && !entry?.multipleShifts) continue;
      
      const dept = getDepartment(role) ?? emp.department ?? null;
      // Получаем админские часы
      const custom = getShiftEdit(emp.id, dateStr);
      const customStart = custom?.customStart;
      const customEnd = custom?.customEnd;
      
      if (shift === 'vacation' || shift === 'sick') {
        absent.push({ name: emp.name, role, color: emp.color, shift });
      } else {
        // Если есть multipleShifts - это может быть:
        // 1. Две разные смены типов (День+Ночь, без часов) - ms.shift будет определен
        // 2. Несколько смен с часами (3Б 2К) - ms.hours будет > 0
        if (entry?.multipleShifts && entry.multipleShifts.length > 0) {
          // Проверяем есть ли у них часы или это комбо типов смен
          const hasHours = entry.multipleShifts.some(ms => ms.hours > 0);
          const hasShift = entry.multipleShifts.some(ms => ms.shift);
          
          if (!hasHours && hasShift) {
            // Это комбо типов смен - добавляем каждую как отдельную запись
            console.log(`[DayModal] РАСШИРЯЮ multipleShifts для ${emp.name} на ${dateStr}:`, entry.multipleShifts);
            entry.multipleShifts.forEach(ms => {
              if (ms.shift) {
                console.log(`  - Добавляю в modal: ${ms.shift} (роль: ${ms.role}, dept: ${ms.dept})`);
                working.push({ 
                  name: emp.name, 
                  role: ms.role || role,  // используем роль из multipleShift если есть
                  color: emp.color, 
                  shift: ms.shift, 
                  dept: ms.dept as Department, 
                  customStart, 
                  customEnd 
                });
              }
            });
          } else {
            // Это смены с часами - добавляем как одну запись
            working.push({ name: emp.name, role, color: emp.color, shift, dept, customStart, customEnd });
          }
        } else {
          working.push({ name: emp.name, role, color: emp.color, shift, dept, customStart, customEnd });
        }
      }
    }
  });

  const byDept: Record<Department, typeof working> = { bar_manager: [], power: [], bar: [], hall: [], kitchen: [] };
  working.forEach(w => { byDept[w.dept ?? 'kitchen'].push(w); });

  type ByShift = Partial<Record<ShiftType, typeof working>>;
  const groupByShift = (list: typeof working): ByShift => {
    const r: ByShift = {};
    list.forEach(w => { if (!r[w.shift]) r[w.shift] = []; r[w.shift]!.push(w); });
    return r;
  };

  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className={`relative w-full max-w-md rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col ${
          isDark ? 'bg-slate-900' : 'bg-white'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
        </div>

        {/* Header */}
        <div className={`px-5 pt-2 pb-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium capitalize ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {DAYS_FULL[dow]}
                {isWeekend && <span className={`ml-1.5 text-xs ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>• выходной</span>}
              </p>
              <h2 className={`text-2xl font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                {day} {MONTHS_RU_GEN[month - 1]} {year}
              </h2>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(['daily','day','night'] as ShiftType[]).map(t => {
                  const cnt = working.filter(w => w.shift === t).length;
                  if (!cnt) return null;
                  const cfg = SHIFT_CONFIG[t];
                  return (
                    <span key={t} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bgColor} ${cfg.textColor}`}>
                      {cfg.icon} {cnt} {cfg.label.toLowerCase()}
                    </span>
                  );
                })}
                {working.length === 0 && (
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Нет смен</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-all active:scale-95 ${
                isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'
              }`}
            >×</button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {working.length === 0 && absent.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📭</p>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Нет данных на этот день</p>
            </div>
          )}

          {/* По отделам */}
          {DEPT_ORDER.map(dept => {
            const group = byDept[dept];
            if (!group.length) return null;
            const deptCfg = DEPARTMENT_CONFIG[dept];
            const byShift = groupByShift(group);
            const shiftOrder: ShiftType[] = ['daily', 'day', 'night'];

            return (
              <div key={dept} className={`rounded-2xl overflow-hidden border shadow-sm ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
              }`}>
                <div className={`px-4 py-2 flex items-center gap-2 border-b ${
                  isDark ? 'border-slate-700 bg-slate-700/50' : `${deptCfg.bgColor} border-black/5`
                }`}>
                  <span className="text-lg">{deptCfg.icon}</span>
                  <span className="font-bold text-sm" style={{ color: deptCfg.color }}>{deptCfg.label}</span>
                </div>
                {shiftOrder.map(shiftType => {
                  const sg = byShift[shiftType];
                  if (!sg?.length) return null;
                  const sCfg = SHIFT_CONFIG[shiftType];
                  return (
                    <div key={shiftType}>
                      <div className={`bg-gradient-to-r ${SHIFT_CARD_GRADIENT[shiftType]} px-4 py-1.5 flex items-center gap-2`}>
                        <span className="text-sm">{sCfg.icon}</span>
                        <span className="text-xs font-semibold text-white">{sCfg.label}</span>
                        {sCfg.time && <span className="text-[10px] text-white/60 ml-1">{sCfg.time}</span>}
                      </div>
                      <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-50'}`}>
                        {sg.map((w, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: w.color }}
                            >
                              {w.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{w.name}</p>
                              <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{w.role}</p>
                              {/* Показываем актуальные часы, если заданы админом */}
                              {(w.customStart || w.customEnd) && (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 ml-1">
                                  {w.customStart?.slice(0, 2) ?? ''}{w.customStart && w.customEnd ? '–' : ''}{w.customEnd?.slice(0, 2) ?? ''}
                                </span>
                              )}
                            </div>
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
          {absent.length > 0 && (
            <div className={`rounded-2xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
              <h3 className={`font-bold text-sm mb-3 flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                <span>📋</span> Отсутствуют ({absent.length})
              </h3>
              <div className="space-y-2">
                {absent.map((a, i) => {
                  const cfg = SHIFT_CONFIG[a.shift];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: a.color }}
                      >
                        {a.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{a.name}</p>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{a.role}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bgColor} ${cfg.textColor}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
};

// ── Основной компонент ────────────────────────────────────────────────
export const MonthView: React.FC<MonthViewProps> = ({ data, month, year, fakeDate, linkedEmpId }) => {
  const { isDark } = useTheme();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = fakeDate ?? new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const getShiftsForDay = (day: number): ShiftType[] => {
    const dateStr = formatDate(year, month, day);
    const result = data.shifts
      .filter(s => s.date === dateStr && s.shift !== 'off')
      .map(s => s.shift);
    if (result.length > 0) console.log(`[getShiftsForDay] ${dateStr}: ${result.length} shifts`, result);
    return result;
  };

  const getMyShift = (day: number): ShiftType | null => {
    if (!linkedEmpId) return null;
    const dateStr = formatDate(year, month, day);
    const entry = data.shifts.find(s => s.employeeId === linkedEmpId && s.date === dateStr);
    return entry?.shift ?? 'off';
  };

  const calCell = isDark ? CAL_CELL_DARK : CAL_CELL;

  // Легенда
  const legend: { shift: ShiftType; label: string }[] = [
    { shift: 'daily', label: 'Сутки' },
    { shift: 'day',   label: 'День' },
    { shift: 'night', label: 'Ночь' },
    { shift: 'vacation', label: 'Отпуск' },
    { shift: 'sick', label: 'Больничный' },
  ];

  return (
    <div className="w-full">
      {/* Заголовок */}
      <div className={`rounded-2xl p-4 mb-4 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h2 className={`text-lg font-extrabold mb-1 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
          {MONTHS_RU_FULL[month - 1]} {year}
        </h2>
        <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          Нажмите на день чтобы увидеть кто работает
          {linkedEmpId && <span className="ml-1">· <span className="text-indigo-400 font-semibold">● твои смены</span></span>}
        </p>
        {/* Легенда */}
        <div className="flex flex-wrap gap-1.5">
          {legend.map(l => {
            const cfg = SHIFT_CONFIG[l.shift];
            return (
              <div key={l.shift} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bgColor} ${cfg.textColor}`}>
                <span>{cfg.icon}</span>
                <span>{l.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Календарная сетка */}
      <div className={`rounded-2xl p-3 shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        {/* Заголовки дней */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-bold py-1 ${
                i >= 5
                  ? isDark ? 'text-rose-400' : 'text-rose-400'
                  : isDark ? 'text-slate-500' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Ячейки */}
        <div className="grid grid-cols-7 gap-1">
          {/* Пустые ячейки до начала месяца */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateStr  = formatDate(year, month, day);
            const dayShifts = getShiftsForDay(day);
            const dominant  = getDominantShift(dayShifts.length ? dayShifts : ['off']);
            const hasShifts = dayShifts.length > 0;
            const isToday   = dateStr === todayStr;
            const dow       = new Date(year, month - 1, day).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const myShift   = getMyShift(day);
            const isMyShift = myShift !== null && myShift !== 'off';

            const linkedEmp = linkedEmpId ? data.employees.find(e => e.id === linkedEmpId) ?? null : null;
            const mySegments = linkedEmp ? getDaySegmentsForEmployee(linkedEmp, dateStr, data.shifts) : [];

            // Получаем сегменты для всех сотрудников на этот день
            let allTimeSegments: { label: string; color: string }[] = [];
            if (!linkedEmp && hasShifts) {
              console.log(`[MonthView] Собираю сегменты для дня ${dateStr}`);
              const uniqueSegments = new Map<string, { label: string; color: string }>();
              // Собираем сегменты от каждого сотрудника на эту дату
              data.employees.forEach(emp => {
                const segments = getDaySegmentsForEmployee(emp, dateStr, data.shifts);
                if (segments.length > 0) {
                  console.log(`[MonthView] ${emp.name} на ${dateStr}: ${segments.length} segments`, segments);
                  segments.forEach(seg => {
                    const key = `${seg.label}|${seg.dept}`;
                    if (!uniqueSegments.has(key)) {
                      uniqueSegments.set(key, seg);
                    }
                  });
                }
              });
              allTimeSegments = Array.from(uniqueSegments.values());
              console.log(`[MonthView] Итого для ${dateStr}: ${allTimeSegments.length} сегментов`, allTimeSegments);
            }

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-bold border-2 transition-all active:scale-95 cursor-pointer relative
                  ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                  ${hasShifts ? calCell[dominant] : isDark
                    ? `border-slate-700 ${isWeekend ? 'text-rose-500/50' : 'text-slate-600'}`
                    : `border-gray-100 ${isWeekend ? 'text-rose-300' : 'text-gray-300'}`
                  }`}
              >
                <span className="text-[11px] font-bold">{day}</span>
                {hasShifts && (
                  <span className="text-[8px] leading-none mt-0.5 font-extrabold">
                    {SHIFT_CONFIG[dominant].shortLabel}
                    {dayShifts.length > 1 && <span className="opacity-60">+{dayShifts.length - 1}</span>}
                  </span>
                )}
                {/* Индикатор личной смены */}
                {isMyShift && (
                  <div
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 flex items-center justify-center"
                    style={{
                      backgroundColor: SHIFT_CONFIG[myShift].color,
                      borderColor: isDark ? '#0f172a' : '#ffffff',
                    }}
                  />
                )}
                {/* Показываем часы для текущего пользователя (раздельно по должностям) */}
                {linkedEmp && mySegments.length > 0 ? (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1 mt-0.5">
                    {mySegments.slice(0, 3).map((seg, idx) => (
                      <span
                        key={idx}
                        className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: seg.color + '22', color: seg.color, border: `1px solid ${seg.color}40` }}
                      >
                        {seg.label}
                      </span>
                    ))}
                    {mySegments.length > 3 && (
                      <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                        +{mySegments.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  allTimeSegments.length > 0 && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1 mt-0.5">
                      {allTimeSegments.slice(0, 3).map((seg, idx) => (
                        <span
                          key={idx}
                          className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: seg.color + '22', color: seg.color, border: `1px solid ${seg.color}40` }}
                        >
                          {seg.label}
                        </span>
                      ))}
                      {allTimeSegments.length > 3 && (
                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                          +{allTimeSegments.length - 3}
                        </span>
                      )}
                    </div>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Подсказка */}
      <p className={`text-center text-[10px] mt-3 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
        Цвет ячейки — доминирующая смена дня · число после + — остальные
      </p>

      {/* Модалка дня */}
      {selectedDay !== null && (
        <DayModal
          day={selectedDay}
          month={month}
          year={year}
          date={new Date(year, month - 1, selectedDay)}
          data={data}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
};
