import React, { useState, useEffect } from 'react';
import {
  ScheduleData, ShiftType, SHIFT_CONFIG,
  DEPARTMENT_CONFIG, Department, getDepartment, Employee,
} from '../types/schedule';
import { useTheme } from '../context/ThemeContext';
import { getShiftEdit, saveShiftEdit, deleteShiftEdit } from '../utils/adminEdits';
import { watchAllShiftNotes, watchEmpNotes, watchShiftEdits } from '../utils/firebase';

const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
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

const SHIFT_TIMES: Record<ShiftType, { start: string; end: string; short: string } | null> = {
  daily:    { start: '09:00', end: '09:00', short: '09-09' },
  day:      { start: '09:00', end: '20:00', short: '09-20' },
  night:    { start: '20:00', end: '09:00', short: '20-09' },
  off:      null,
  vacation: null,
  sick:     null,
};

const SHIFT_CARD_GRADIENT: Record<ShiftType, string> = {
  daily:    'from-violet-600 to-purple-700',
  day:      'from-blue-500 to-sky-600',
  night:    'from-indigo-800 to-slate-900',
  off:      'from-gray-200 to-gray-300',
  vacation: 'from-emerald-500 to-teal-600',
  sick:     'from-red-500 to-rose-600',
};

const STORAGE_COLLEAGUE_IDS = 'sf_colleague_ids';
const STORAGE_FRIENDS_IDS   = 'sf_friends_ids';

function getDeptColorByRole(role: string, fallback = '#6366f1'): string {
  const dept = getDepartment(role);
  return dept ? DEPARTMENT_CONFIG[dept].color : fallback;
}

const STORAGE_COLLEAGUE_COLORS = 'sf_colleague_colors';

// Фиксированные цвета для коллег (красный, темно-синий, розовый)
const COLLEAGUE_COLORS = ['#ef4444', '#1e3a8a', '#ec4899'];

function loadColleagueColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_COLLEAGUE_COLORS) || '{}'); } catch { return {}; }
}

function saveColleagueColor(empId: string, color: string): void {
  const all = loadColleagueColors();
  all[empId] = color;
  try { localStorage.setItem(STORAGE_COLLEAGUE_COLORS, JSON.stringify(all)); } catch {}
}

function ensureColleagueColor(emp: Employee, index: number = 0): string {
  const all = loadColleagueColors();
  if (all[emp.id]) return all[emp.id];
  // Assign one of three fixed colors based on index
  const chosen = COLLEAGUE_COLORS[Math.min(index, COLLEAGUE_COLORS.length - 1)];
  saveColleagueColor(emp.id, chosen);
  return chosen;
}

// format hours into compact "00-00" label; input like "08:00" -> "08-00" etc
function formatHourLabel(start?: string, end?: string): string | undefined {
  if (!start || !end) return undefined;
  // Получаем часы и минуты из "HH:MM"
  const s = start.slice(0, 2);  // "20:05" -> "20"
  const e = end.slice(0, 2);    // "08:00" -> "08"
  return `${s}-${e}`;
}


function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function normalizeName(s: string) { return s.toLowerCase().replace(/\s+/g,' ').trim(); }

const SHIFT_PRIORITY: ShiftType[] = ['sick','vacation','daily','day','night','off'];
function getDominantShift(shifts: ShiftType[]): ShiftType {
  for (const s of SHIFT_PRIORITY) if (shifts.includes(s)) return s;
  return 'off';
}

// Get employees with birthdays on a given date (MM-DD format)
function getEmployeesBirthdayToday(employees: Employee[], date: Date): Employee[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const todayMMDD = `${month}-${day}`;
  const result = employees.filter(emp => emp.birthday === todayMMDD);
  if (result.length > 0) {
    console.log(`[ShiftsView] 🎂 Found birthdays on ${todayMMDD}:`, result.map(e => e.name).join(', '));
  }
  return result;
}

// ── Edit Shift Modal ────────────────────────────────────────────────
interface EditShiftModalProps {
  emp: Employee;
  date: string;
  shift: ShiftType;
  onClose: () => void;
  onSaved: () => void;
  initialEdit?: { customStart?: string; customEnd?: string; note?: string }; // pass existing values from Firebase/local state
}
const EditShiftModal: React.FC<EditShiftModalProps> = ({ emp, date, shift, onClose, onSaved, initialEdit }) => {
  const { isDark } = useTheme();
  const defaultTimes = SHIFT_TIMES[shift];
  const existing = getShiftEdit(emp.id, date);
  const editValues = initialEdit ?? existing;

  const [startTime, setStartTime] = useState(editValues?.customStart ?? defaultTimes?.start ?? '08:00');
  const [endTime,   setEndTime]   = useState(editValues?.customEnd   ?? defaultTimes?.end   ?? '20:00');
  const [note,      setNote]      = useState(editValues?.note ?? '');

  const dayStr = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

  const handleSave = () => {
    const hasChanges =
      startTime !== defaultTimes?.start ||
      endTime   !== defaultTimes?.end   ||
      note.trim() !== '';

    if (hasChanges) {
      saveShiftEdit({
        empId: emp.id,
        date,
        customStart: startTime,
        customEnd:   endTime,
        note:        note.trim() || undefined,
      });
    } else {
      deleteShiftEdit(emp.id, date);
    }
    onSaved();
    onClose();
  };

  const handleReset = () => {
    deleteShiftEdit(emp.id, date);
    onSaved();
    onClose();
  };

  const card = isDark ? 'bg-slate-900' : 'bg-white';
  const inp  = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-md rounded-t-3xl shadow-2xl ${card}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
        </div>

        {/* Шапка */}
        <div className={`px-5 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
                ✏️ Редактировать смену
              </p>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                {emp.name}
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {dayStr} · {SHIFT_CONFIG[shift].icon} {SHIFT_CONFIG[shift].label}
              </p>
            </div>
            <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>×</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Время смены */}
          {defaultTimes && (
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                🕐 Время смены
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Начало</p>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${inp}`}
                  />
                </div>
                <div className={`text-lg font-bold mt-4 ${isDark ? 'text-slate-500' : 'text-gray-300'}`}>→</div>
                <div className="flex-1">
                  <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Конец</p>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${inp}`}
                  />
                </div>
              </div>
              {(startTime !== defaultTimes.start || endTime !== defaultTimes.end) && (
                <p className="text-[10px] text-amber-500 mt-1.5 font-medium">
                  ⚠️ Стандарт: {defaultTimes.start} – {defaultTimes.end}
                </p>
              )}
            </div>
          )}

          {/* Примечание к смене */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              💬 Примечание к смене
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Например: приедет к 11:00, уйдёт раньше..."
              rows={3}
              className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${inp}`}
            />
          </div>
        </div>

        {/* Кнопки */}
        <div className={`px-5 pb-6 pt-0 flex gap-2 border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <button
            onClick={handleReset}
            className={`flex-1 py-3 rounded-2xl text-sm font-semibold border transition-all active:scale-95 mt-4 ${
              isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Сбросить
          </button>
          <button
            onClick={handleSave}
            className="flex-2 flex-grow py-3 rounded-2xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all active:scale-95 mt-4"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Day Modal ─────────────────────────────────────────────────────────
interface DayModalProps {
  day: number; month: number; year: number;
  data: ScheduleData;
  linkedEmpId: string | null;
  isAdmin: boolean;
  onClose: () => void;
}
const DayModal: React.FC<DayModalProps> = ({ day, month, year, data, linkedEmpId, isAdmin, onClose }) => {
  const { isDark } = useTheme();
  const dateStr = formatDate(year, month, day);
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  // Для перерисовки после сохранения правок
  const [editKey, setEditKey] = useState(0);
  const [editingShift, setEditingShift] = useState<{ emp: Employee; shift: ShiftType } | null>(null);

  // Real-time Firebase listeners
  const [fsEmpNotes, setFsEmpNotes] = useState<Record<string,string>>({});
  const [fsShiftNotes, setFsShiftNotes] = useState<Record<string,string>>({});
  const [fsShiftEdits, setFsShiftEdits] = useState<Record<string,any>>({});
  // const [fsEmpRules, setFsEmpRules] = useState<Record<string,any>>({});

  useEffect(() => {
    let mounted = true;
    console.log('[DayModal] Setting up Firebase listeners');
    const unsubscribers: (() => void)[] = [];


    // Listen to all shift edits
    const unsubShiftEdits = watchShiftEdits((edits: any[]) => {
      if (!mounted) return;
      const editMap: Record<string, any> = {};
      edits.forEach(edit => {
        editMap[`${edit.empId}-${edit.date}`] = edit;
      });
      console.log('[DayModal] Shift edits updated:', editMap);
      setFsShiftEdits(editMap);
    });
    unsubscribers.push(unsubShiftEdits);

    // Listen to all emp notes
    const unsubEmpNotes = watchEmpNotes((notes: any[]) => {
      if (!mounted) return;
      const noteMap: Record<string, string> = {};
      notes.forEach(note => {
        noteMap[note.empId] = note.note || '';
      });
      console.log('[DayModal] Emp notes updated:', noteMap);
      setFsEmpNotes(noteMap);
    });
    unsubscribers.push(unsubEmpNotes);

    // Listen to all shift notes
    const unsubShiftNotes = watchAllShiftNotes((notes: any[]) => {
      if (!mounted) return;
      const noteMap: Record<string, string> = {};
      notes.forEach(note => {
        // shift_notes docs may have structure: { id: "...", shiftId: "..." } or { empId: "...", date: "..." }
        // We'll map by shiftId or by empId-date if available
        const key = note.shiftId || `${note.empId}-${note.date}`;
        noteMap[key] = note.note || '';
      });
      console.log('[DayModal] Shift notes updated:', noteMap);
      setFsShiftNotes(noteMap);
    });
    unsubscribers.push(unsubShiftNotes);

    return () => {
      mounted = false;
      console.log('[DayModal] Cleaning up Firebase listeners');
      unsubscribers.forEach(unsub => {
        try { unsub?.(); } catch (err) { console.error('[DayModal] Error unsubscribing:', err); }
      });
    };
  }, []);

  const getCustomTimes = (empId: string, dateStr: string) => {
    // Try Firebase first, then localStorage as fallback
    const fbEdit = fsShiftEdits[`${empId}-${dateStr}`];
    if (fbEdit) {
      return {
        customStart: fbEdit.customStart,
        customEnd: fbEdit.customEnd,
        note: fbEdit.note,
      };
    }
    // Fallback to localStorage
    const localEdit = getShiftEdit(empId, dateStr);
    return localEdit ? {
      customStart: localEdit.customStart,
      customEnd: localEdit.customEnd,
      note: localEdit.note,
    } : undefined;
  };
  const getNote = (empId: string) => {
    // Prefer Firebase (emp_notes) over shift edits notes
    return fsEmpNotes[empId] ?? fsShiftEdits[empId]?.note ?? '';
  };
  const getShiftNote = (empId: string, dateStr: string) => {
    // Try Firebase shift_notes first (stored as { shiftId: "empId-date", text: "..." })
    const fbShiftNote = fsShiftNotes[`${empId}-${dateStr}`];
    if (fbShiftNote) return fbShiftNote;
    
    // Fallback to shift edit note
    const fbEdit = fsShiftEdits[`${empId}-${dateStr}`];
    if (fbEdit?.note) return fbEdit.note;
    
    return '';
  };

  const working: {
    emp: Employee; name: string; role: string; color: string;
    shift: ShiftType; dept: Department; isMe: boolean; hours?: number;
    multipleShifts?: Array<{ dept: Department; hours: number; role?: string }>;
    startTime?: string; endTime?: string;
    birthday?: boolean;
  }[] = [];
  const absent: {
    emp: Employee; name: string; role: string; color: string;
    shift: ShiftType; isMe: boolean; hours?: number;
    multipleShifts?: Array<{ dept: Department; hours: number; role?: string }>;
    birthday?: boolean;
  }[] = [];

  data.employees.forEach(emp => {
    const entry = data.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);
    const shift: ShiftType = entry?.shift ?? 'off';
    const hours = entry?.hours;
    const multipleShifts = entry?.multipleShifts;
    const shiftsWithTimes = entry?.shiftsWithTimes;
    const role = entry?.role || emp.role;
    // Если нет смены и нет отработанных часов — пропускаем
    if (shift === 'off' && !hours && !multipleShifts && !shiftsWithTimes) return;
    const color = getDeptColorByRole(role, emp.color);
    const dept = getDepartment(role) ?? emp.department ?? 'kitchen';
    const isMe = emp.id === linkedEmpId;
    
    if (shift === 'vacation' || shift === 'sick') {
      absent.push({ emp, name: emp.name, role, color, shift, isMe, hours, multipleShifts });
    } else if (shiftsWithTimes && shiftsWithTimes.length > 0) {
      // Если есть смены с временем, добавляем отдельную запись для каждой
      for (const swt of shiftsWithTimes) {
        const deptCfg = DEPARTMENT_CONFIG[swt.dept];
        working.push({
          emp,
          name: emp.name,
          role: swt.role,
          color: deptCfg.color,
          shift: 'off',
          dept: swt.dept,
          isMe,
          startTime: swt.startTime,
          endTime: swt.endTime,
        });
      }
    } else if (multipleShifts && multipleShifts.length > 0) {
      // Если есть несколько смен по часам, добавляем отдельную запись для каждой
      for (const ms of multipleShifts) {
        const deptCfg = DEPARTMENT_CONFIG[ms.dept];
        // Сначала используем роль из multipleShifts (сохранена при парсировании)
        // Потом ищем роль по отделу, потом используем базовую роль
        const roleForShift = ms.role || emp.roles?.find(r => getDepartment(r) === ms.dept) || role;
        working.push({
          emp,
          name: emp.name,
          role: roleForShift,
          color: deptCfg.color,
          shift: 'off',
          dept: ms.dept,
          isMe,
          hours: ms.hours,
        });
      }
    } else {
      working.push({ emp, name: emp.name, role, color, shift, dept, isMe, hours });
    }
  });

  // добавить именинников даже если не работают
  const birthdayEmps = getEmployeesBirthdayToday(data.employees, date);
  birthdayEmps.forEach(emp => {
    const already = working.some(w => w.emp.id === emp.id) || absent.some(a => a.emp.id === emp.id);
    if (!already) {
      const color = getDeptColorByRole(emp.role, emp.color);
      const dept = getDepartment(emp.role) ?? emp.department ?? 'kitchen';
      const isMe = emp.id === linkedEmpId;
      working.push({ emp, name: emp.name, role: emp.role, color, shift: 'off', dept, isMe, birthday: true });
    }
  });

  const byDept: Record<Department, typeof working> = { bar_manager: [], power:[], bar:[], hall:[], kitchen:[] };
  working.forEach(w => { byDept[w.dept].push(w); });

  type ByShift = Partial<Record<ShiftType, typeof working>>;
  const groupByShift = (list: typeof working): ByShift => {
    const r: ByShift = {};
    list.forEach(w => { if (!r[w.shift]) r[w.shift] = []; r[w.shift]!.push(w); });
    return r;
  };

  // Принудительно перерисовываем после сохранения
  const handleSaved = () => setEditKey(k => k + 1);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className={`relative w-full max-w-md rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
          </div>
          <div className={`px-5 pt-2 pb-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium capitalize ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {DAYS_FULL[dow]}
                  {isWeekend && <span className={`ml-1.5 text-xs ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>• выходной</span>}
                </p>
                <h2 className={`text-2xl font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                  {day} {MONTHS_RU_GEN[month-1]} {year}
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
                  {working.length === 0 && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Нет смен</span>}
                </div>
              </div>
              <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>×</button>
            </div>
          </div>

          {/* Список сотрудников */}
          <div key={editKey} className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            {working.length === 0 && absent.length === 0 && (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📭</p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Нет данных на этот день</p>
              </div>
            )}
            {DEPT_ORDER.map(dept => {
              const group = byDept[dept];
              if (!group.length) return null;
              const deptCfg = DEPARTMENT_CONFIG[dept];
              const byShift = groupByShift(group);
              return (
                <div key={dept} className={`rounded-2xl overflow-hidden border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                  <div className={`px-4 py-2 flex items-center gap-2 border-b ${isDark ? 'border-slate-700 bg-slate-700/50' : `${deptCfg.bgColor} border-black/5`}`}>
                    <span className="text-lg">{deptCfg.icon}</span>
                    <span className="font-bold text-sm" style={{ color: deptCfg.color }}>{deptCfg.label}</span>
                  </div>
                  {(['daily','day','night'] as ShiftType[]).map(shiftType => {
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
                          {sg.map((w, i) => {
                            const custom    = getCustomTimes(w.emp.id, dateStr);
                            const empNote   = getNote(w.emp.id);
                            const shiftNote = getShiftNote(w.emp.id, dateStr);
                            const timeStart = custom?.customStart ?? SHIFT_TIMES[w.shift]?.start;
                            const timeEnd   = custom?.customEnd   ?? SHIFT_TIMES[w.shift]?.end;
                            const hasCustomTime = custom?.customStart || custom?.customEnd;
                            // Не показываем часы в этой секции, если это запись только с часами (shift==='off' и есть hours)
                            // Такие записи показываются в отдельной секции "Часы" ниже
                            const workedHours = w.shift === 'off' && w.hours ? undefined : w.hours;

                            return (
                              <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${w.isMe ? isDark ? 'bg-indigo-900/30' : 'bg-indigo-50' : ''}`}>
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm mt-0.5"
                                  style={{ backgroundColor: w.color }}
                                >
                                  {w.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{w.name}</p>
                                    {w.isMe && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Я</span>}
                                    {w.birthday && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-pink-600 text-white' : 'bg-pink-600 text-white'}`}>
                                        🎂 именинник
                                      </span>
                                    )}
                                    {hasCustomTime && (
                                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                        {timeStart?.slice(0, 2)}–{timeEnd?.slice(0, 2)}
                                      </span>
                                    )}
                                    {workedHours && (
                                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                        {workedHours}ч
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{w.role}</p>
                                  {empNote && (
                                    <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                      💬 {empNote}
                                    </p>
                                  )}
                                  {shiftNote && (
                                    <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                      📌 {shiftNote}
                                    </p>
                                  )}
                                </div>
                                {/* Карандаш — только для администраторов */}
                                {isAdmin && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditingShift({ emp: w.emp, shift: w.shift }); }}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all active:scale-95 flex-shrink-0 mt-0.5 ${
                                      isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                                    } ${(empNote || shiftNote || hasCustomTime) ? isDark ? '!bg-amber-900/40 !text-amber-400' : '!bg-amber-100 !text-amber-600' : ''}`}
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Дополнительная секция для именинников без смен */}
                  {group.filter(w => w.birthday && w.shift === 'off' && !w.hours).length > 0 && (
                    <div key="birthdays">
                      <div className={`px-4 py-1.5 flex items-center gap-2 ${isDark ? 'bg-pink-900/40' : 'bg-pink-100'}`}> 
                        <span className="text-sm">🎂</span>
                        <span className={`text-xs font-semibold ${isDark ? 'text-pink-300' : 'text-gray-800'}`}>Именинник</span>
                      </div>
                      <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-50'}`}>
                        {group.filter(w => w.birthday && w.shift === 'off' && !w.hours).map((w, i) => {
                          const empNote = getNote(w.emp.id);
                          const shiftNote = getShiftNote(w.emp.id, dateStr);
                          return (
                            <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${w.isMe ? isDark ? 'bg-indigo-900/30' : 'bg-indigo-50' : ''}`}>
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm mt-0.5"
                                style={{ backgroundColor: w.color }}
                              >
                                {w.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{w.name}</p>
                                  {w.isMe && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Я</span>}
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-pink-600 text-white' : 'bg-pink-600 text-white'}`}>
                                    🎂 именинник
                                  </span>
                                </div>
                                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{w.role}</p>
                                {empNote && (
                                  <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                    💬 {empNote}
                                  </p>
                                )}
                                {shiftNote && (
                                  <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                    📌 {shiftNote}
                                  </p>
                                )}
                              </div>
                              {/* Карандаш — только для администраторов */}
                              {isAdmin && (
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingShift({ emp: w.emp, shift: w.shift }); }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all active:scale-95 flex-shrink-0 mt-0.5 ${
                                    isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                                  } ${(empNote || shiftNote) ? isDark ? '!bg-amber-900/40 !text-amber-400' : '!bg-amber-100 !text-amber-600' : ''}`}
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Дополнительная секция для записей, где есть только часы (shift==='off') */}
                  {group.filter(w => w.shift === 'off' && (w.hours || w.startTime)).length > 0 && (
                    <div key="hours">
                      <div className={`px-4 py-1.5 flex items-center gap-2 ${isDark ? 'bg-amber-900/60' : 'bg-amber-600'}`}> 
                        <span className="text-sm">⏱️</span>
                        <span className={`text-xs font-semibold ${isDark ? 'text-amber-200' : 'text-white'}`}>Часы</span>
                      </div>
                      <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-50'}`}>
                        {group.filter(w => w.shift === 'off' && (w.hours || w.startTime)).map((w, i) => {
                          const workedHours = w.hours;
                          const empNote = getNote(w.emp.id);
                          const shiftNote = getShiftNote(w.emp.id, dateStr);
                          const deptCfg = DEPARTMENT_CONFIG[w.dept];
                          const displayTime = w.startTime && w.endTime ? `${w.startTime.slice(0,2)}-${w.endTime.slice(0,2)}` : undefined;
                          return (
                            <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${w.isMe ? isDark ? 'bg-indigo-900/30' : 'bg-indigo-50' : ''}`}>
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm mt-0.5"
                                style={{ backgroundColor: w.color }}
                              >
                                {w.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{w.name}</p>
                                  {w.isMe && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Я</span>}
                                  {displayTime ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: deptCfg.color + '20', color: deptCfg.color, border: `1px solid ${deptCfg.color}40` }}>
                                      {w.role} {displayTime}
                                    </span>
                                  ) : workedHours ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: deptCfg.color + '20', color: deptCfg.color, border: `1px solid ${deptCfg.color}40` }}>
                                      {workedHours}ч {deptCfg.label}
                                    </span>
                                  ) : null}
                                </div>
                                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{w.role}</p>
                                {empNote && (
                                  <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                    💬 {empNote}
                                  </p>
                                )}
                                {shiftNote && (
                                  <p className={`text-xs mt-0.5 rounded-lg px-2 py-0.5 font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                    📌 {shiftNote}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}  
                      </div>
                    </div>
                  )}
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
                      <div key={i} className={`flex items-start gap-3 ${a.isMe ? isDark ? 'bg-indigo-900/30 rounded-xl px-2 py-1.5' : 'bg-indigo-50 rounded-xl px-2 py-1.5' : ''}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5" style={{ backgroundColor: a.color }}>
                          {a.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{a.name}</p>
                            {a.isMe && <span className="text-[10px] font-bold text-indigo-500">Я</span>}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-auto ${cfg.bgColor} ${cfg.textColor}`}>{cfg.icon} {cfg.label}</span>
                          </div>
                        </div>
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

      {/* Модалка редактирования смены */}
      {editingShift && (
        <EditShiftModal
          emp={editingShift.emp}
          date={dateStr}
          shift={editingShift.shift}
          initialEdit={getCustomTimes(editingShift.emp.id, dateStr)}
          onClose={() => setEditingShift(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
};

// ── Colleague Selector ────────────────────────────────────────────────
interface ColleagueSelectorProps {
  data: ScheduleData;
  linkedEmpId: string | null;
  selectedIds: string[];
  friendIds: string[];
  isAdmin: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}
const ColleagueSelector: React.FC<ColleagueSelectorProps> = ({ data, linkedEmpId, selectedIds, friendIds, onToggle, onClose }) => {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');

  const allEmps = data.employees.filter(emp => {
    if (emp.id === linkedEmpId) return false;
    if (!search.trim()) return true;
    return normalizeName(emp.name).includes(normalizeName(search));
  });

  const friends    = allEmps.filter(e => friendIds.includes(e.id));
  const nonFriends = allEmps.filter(e => !friendIds.includes(e.id));

  const byDept: Record<Department, Employee[]> = { bar_manager: [], power:[], bar:[], hall:[], kitchen:[] };
  nonFriends.forEach(emp => {
    const dept = emp.department ?? getDepartment(emp.role) ?? 'kitchen';
    byDept[dept].push(emp);
  });

  const EmpBtn = ({ emp }: { emp: Employee }) => {
    const isSelected = selectedIds.includes(emp.id);
    const colleagueColors = loadColleagueColors();
    const empColor = colleagueColors[emp.id] ?? getDeptColorByRole(emp.role, emp.color);
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(emp.id)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                isSelected
                  ? 'border-transparent'
                  : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-gray-100 hover:border-gray-200'
              }`}
              style={isSelected ? { borderColor: empColor, backgroundColor: empColor + '18' } : {}}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: empColor }}
              >
                {emp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`font-semibold text-sm truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{emp.name}</p>
                <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
                  {emp.role}
                </p>
              </div>
            </button>
          </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className={`relative w-full max-w-md rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
          </div>
          <div className={`px-5 pt-2 pb-3 border-b flex-shrink-0 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className={`text-lg font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Показать коллег</h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  Выбери до 3 человек · выбрано {selectedIds.length}/3
                </p>
              </div>
              <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>×</button>
            </div>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени..."
              className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
              }`}
            />
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
            {friends.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">⭐</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-500">Друзья</span>
                </div>
                <div className="space-y-1.5">
                  {friends.map(emp => <EmpBtn key={emp.id} emp={emp} />)}
                </div>
              </div>
            )}
            {DEPT_ORDER.map(dept => {
              const group = byDept[dept];
              if (!group.length) return null;
              const deptCfg = DEPARTMENT_CONFIG[dept];
              return (
                <div key={dept}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{deptCfg.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: deptCfg.color }}>{deptCfg.label}</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.map(emp => <EmpBtn key={emp.id} emp={emp} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </>
  );
};

// ── ShiftsView ────────────────────────────────────────────────────────
interface ShiftsViewProps {
  data: ScheduleData;
  fakeDate: Date | null;
  linkedEmpId: string | null;
  isAdmin?: boolean;
  onMonthChange?: (month: number, year: number) => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({ data, fakeDate, linkedEmpId, isAdmin = false, onMonthChange }) => {
  const { isDark } = useTheme();

  const today = fakeDate ?? new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear]   = useState(today.getFullYear());

  const changeMonth = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
    onMonthChange?.(newMonth, newYear);
  };
  const [selectedDay, setSelectedDay]   = useState<number | null>(null);
  const [showColleagueSelector, setShowColleagueSelector] = useState(false);
  const [colleagueIds, setColleagueIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_COLLEAGUE_IDS) || '[]'); }
    catch { return []; }
  });

  const [friendIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_FRIENDS_IDS) || '[]'); }
    catch { return []; }
  });

  // Force re-render when shift edits change
  const [shiftEditsUpdateKey, setShiftEditsUpdateKey] = useState(0);
  const [shiftEditsMap, setShiftEditsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    const d = fakeDate ?? new Date();
    const newMonth = d.getMonth() + 1;
    const newYear  = d.getFullYear();
    setMonth(newMonth);
    setYear(newYear);
    onMonthChange?.(newMonth, newYear);
  }, [fakeDate]);

  // Listen to shift edits changes from Firebase (real-time updates)
  useEffect(() => {
    let mounted = true;
    const unsubscribers: (() => void)[] = [];

    // Subscribe to shift edits
    const unsubShiftEdits = watchShiftEdits((edits: any[]) => {
      if (!mounted) return;
      // Build map by empId-date key
      const editMap: Record<string, any> = {};
      edits.forEach(edit => {
        editMap[`${edit.empId}-${edit.date}`] = edit;
      });
      console.log('[ShiftsView] *** FIREBASE SHIFT EDITS UPDATED ***', editMap);
      console.log('[ShiftsView] Total shift edits from Firebase:', edits.length);
      setShiftEditsMap(editMap);
      setShiftEditsUpdateKey(k => k + 1);
    });
    unsubscribers.push(unsubShiftEdits);

    return () => {
      mounted = false;
      unsubscribers.forEach(unsub => {
        try { unsub?.(); } catch (err) { console.error('[ShiftsView] Error unsubscribing:', err); }
      });
    };
  }, []);

  const todayStr    = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const getShiftEntry = (empId: string, day: number) => {
    const dateStr = formatDate(year, month, day);
    return data.shifts.find(s => s.employeeId === empId && s.date === dateStr);
  };

  const getShiftsForDay = (day: number): ShiftType[] => {
    const dateStr = formatDate(year, month, day);
    return data.shifts
      .filter(s => s.date === dateStr && s.shift !== 'off')
      .map(s => s.shift);
  };

  const handleColleagueToggle = (id: string) => {
    setColleagueIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 3);
      localStorage.setItem(STORAGE_COLLEAGUE_IDS, JSON.stringify(next));
      // Ensure we assign a stable color for newly selected colleagues
      if (!prev.includes(id) && next.includes(id)) {
        const emp = data.employees.find(e => e.id === id);
        const index = next.indexOf(id);
        if (emp) ensureColleagueColor(emp, index);
      }
      return next;
    });
  };

  const linkedEmp = linkedEmpId ? data.employees.find(e => e.id === linkedEmpId) : null;

  // Get shift edit from Firebase map first, fallback to localStorage
  const getShiftEditFromFirebase = (empId: string, dateStr: string) => {
    const key = `${empId}-${dateStr}`;
    const fbEdit = shiftEditsMap[key];
    if (fbEdit) {
      console.log('[ShiftsView] Retrieved Firebase shift edit for', key, ':', fbEdit);
      return fbEdit;
    }
    // Fallback to localStorage
    const localEdit = getShiftEdit(empId, dateStr);
    if (localEdit) {
      console.log('[ShiftsView] Retrieved localStorage shift edit for', key, ':', localEdit);
    }
    return localEdit;
  };

  const CAL_CELL: Record<ShiftType, string> = isDark ? {
    daily:    'bg-violet-900/40 border-violet-600 text-violet-300',
    day:      'bg-blue-900/40 border-blue-600 text-blue-300',
    night:    'bg-indigo-950 border-indigo-700 text-indigo-300',
    off:      'bg-slate-800/50 border-slate-700 text-slate-600',
    vacation: 'bg-emerald-900/40 border-emerald-600 text-emerald-300',
    sick:     'bg-red-900/40 border-red-600 text-red-300',
  } : {
    daily:    'bg-violet-100 border-violet-400 text-violet-700',
    day:      'bg-blue-100 border-blue-400 text-blue-700',
    night:    'bg-indigo-950 border-indigo-500 text-indigo-200',
    off:      'bg-gray-50 border-gray-100 text-gray-300',
    vacation: 'bg-emerald-100 border-emerald-400 text-emerald-700',
    sick:     'bg-red-100 border-red-400 text-red-700',
  };

  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';
  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';

  // Use shiftEditsUpdateKey to trigger re-renders when shift edits change
  const calendarKey = `${month}-${year}-${shiftEditsUpdateKey}`;
  
  // Debug logging
  if (Object.keys(shiftEditsMap).length > 0) {
    console.log('[ShiftsView] Calendar re-rendering with shiftEditsMap:', calendarKey, Object.keys(shiftEditsMap).length, 'edits');
  }

  return (
    <div className="w-full space-y-0">

      {/* ── Слайдер месяца + кнопка коллег ── */}
      <div className={`flex items-center justify-between px-1 py-2 sticky top-0 z-10 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
        <div className={`flex items-center gap-1 rounded-2xl p-1 flex-1 mr-2 ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
          <button
            onClick={() => { if (month === 1) { changeMonth(12, year - 1); } else changeMonth(month - 1, year); }}
            className={`w-8 h-7 flex items-center justify-center rounded-xl font-bold text-lg transition-all active:scale-95 ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >‹</button>
          <button
            onClick={() => { changeMonth(today.getMonth()+1, today.getFullYear()); }}
            className={`flex-1 text-center text-sm font-bold transition-colors ${isDark ? 'text-slate-100' : 'text-gray-800'}`}
          >
            {MONTHS_RU_FULL[month-1]} {year}
          </button>
          <button
            onClick={() => { if (month === 12) { changeMonth(1, year + 1); } else changeMonth(month + 1, year); }}
            className={`w-8 h-7 flex items-center justify-center rounded-xl font-bold text-lg transition-all active:scale-95 ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >›</button>
        </div>
        <button
          onClick={() => setShowColleagueSelector(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 transition-all active:scale-95 ${
            colleagueIds.length > 0
              ? 'border-indigo-400 ' + (isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600')
              : isDark ? 'border-slate-700 text-slate-400 bg-slate-800' : 'border-gray-200 text-gray-400 bg-white shadow-sm'
          }`}
        >
          <span className="text-base">👥</span>
          {colleagueIds.length > 0 && (
            <div className="flex gap-0.5">
              {colleagueIds.map((cId, i) => {
                const cEmp = data.employees.find(e => e.id === cId);
                const color = cEmp ? getDeptColorByRole(cEmp.role, cEmp.color) : '#888';
                return <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />;
              })}
            </div>
          )}
        </button>
      </div>

      {/* ── Календарь ── */}
      <div key={calendarKey} className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        {/* Дни недели */}
        <div className="grid grid-cols-7 border-b border-inherit">
          {DAY_LABELS_SHORT.map((d, i) => (
            <div key={d} className={`text-center text-[10px] font-bold py-2 ${i >= 5 ? 'text-rose-400' : isDark ? 'text-slate-500' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        {/* Ячейки */}
        <div className="grid grid-cols-7 gap-[2px] p-[3px]">
          {Array.from({ length: startOffset }).map((_,i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_,i) => i+1).map(day => {
            const dateStr   = formatDate(year, month, day);
            const allShifts = getShiftsForDay(day);
            const myEntry   = linkedEmp ? getShiftEntry(linkedEmp.id, day) : null;
            const myShift   = myEntry?.shift ?? 'off';
            const myRole    = myEntry?.role || linkedEmp?.role || '';
            const myHours   = myEntry?.hours;
            const isMyShift = myShift !== 'off' || !!myHours;
            const isToday   = dateStr === todayStr;
            const dow       = new Date(year, month-1, day).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const myTimes   = SHIFT_TIMES[myShift];

            // Get birthday celebrants for this day
            const birthdayCelebrants = getEmployeesBirthdayToday(data.employees, new Date(year, month-1, day));

            const myDeptColor = myRole ? getDeptColorByRole(myRole, '#6366f1') : '#6366f1';
            const isMyWorking = !!myHours || myShift === 'daily' || myShift === 'day' || myShift === 'night' || (myEntry?.multipleShifts && myEntry.multipleShifts.length > 0);

            // Кастомное время для моей смены
            const myCustom    = linkedEmp ? getShiftEditFromFirebase(linkedEmp.id, dateStr) : null;
            
            let myTimeStart = myCustom?.customStart ?? myTimes?.start;
            let myTimeEnd   = myCustom?.customEnd   ?? myTimes?.end;
            let myShortTime: string | undefined = undefined;
            let myMultipleShifts = myEntry?.multipleShifts;
            
            if (myMultipleShifts && myMultipleShifts.length > 0) {
              // Если есть несколько смен — не переопределяем, будут отображены раздельно ниже
              myTimeStart = undefined;
              myTimeEnd = undefined;
              myShortTime = undefined;
            } else if (myHours) {
              myShortTime = `${myHours}ч`;
              myTimeStart = `${myHours} ч`;
              myTimeEnd = undefined;
            } else if (myTimeStart && myTimeEnd) {
              myShortTime = formatHourLabel(myTimeStart, myTimeEnd) || myTimes?.short;
            } else {
              myShortTime = myTimes?.short;
            }

            const colleagueShifts = colleagueIds.map((cId, index) => {
              const cEmp   = data.employees.find(e => e.id === cId);
              if (!cEmp) return null;
              const cEntry = data.shifts.find(s => s.employeeId === cId && s.date === dateStr);
              const cShift = cEntry?.shift ?? 'off';
              const cHours = cEntry?.hours;
              const cMultipleShifts = cEntry?.multipleShifts;
              const cShiftsWithTimes = cEntry?.shiftsWithTimes;
              const color  = ensureColleagueColor(cEmp, index);
              const cCustom = getShiftEditFromFirebase(cId, dateStr);
              const cRole = cEntry?.role || cEmp.role;
              const cDept = getDepartment(cRole);
              const cDeptIcon = cDept ? DEPARTMENT_CONFIG[cDept].icon : '';
              if (cCustom) {
                console.log('[ShiftsView] Colleague shift has custom time:', { cId, dateStr, cCustom });
              }
              return {
                shift: cShift,
                emp: cEmp,
                color,
                deptIcon: cDeptIcon,
                dept: cDept,
                role: cRole,
                hours: cHours,
                multipleShifts: cMultipleShifts,
                shiftsWithTimes: cShiftsWithTimes,
                customStart: cCustom?.customStart,
                customEnd: cCustom?.customEnd,
              };
            }).filter((c): c is NonNullable<typeof c> => c !== null && (c.shift !== 'off' || !!c.hours || !!c.multipleShifts || !!c.shiftsWithTimes));

            const hasColleague = colleagueShifts.length > 0;
            const hasAnyShift  = allShifts.length > 0;
            const hasOverlap   = isMyShift && hasColleague && (myTimes || myHours || (myMultipleShifts && myMultipleShifts.length > 0));

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative flex flex-col items-center justify-start rounded-xl border-2 transition-all active:scale-95 cursor-pointer overflow-hidden pt-1 pb-1
                  ${isToday ? 'ring-2 ring-offset-1 ' + (isDark ? 'ring-indigo-400 ring-offset-slate-800' : 'ring-indigo-500 ring-offset-white') : ''}
                  ${!isMyWorking && isMyShift ? CAL_CELL[myShift] : ''}
                  ${!isMyShift ? (
                    hasAnyShift || hasColleague
                      ? isDark ? 'bg-slate-700/60 border-slate-600 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                      : isDark
                        ? `border-slate-700/50 ${isWeekend ? 'text-rose-500/40' : 'text-slate-700'}`
                        : `border-gray-100 ${isWeekend ? 'text-rose-200' : 'text-gray-200'}`
                  ) : ''}
                `}
                style={{
                  minHeight: '72px',
                  ...(isMyWorking ? {
                    backgroundColor: myDeptColor + '25',
                    borderColor: myDeptColor + '80',
                    color: myDeptColor,
                  } : {}),
                }}
              >
                {/* Birthday indicator */}
                {birthdayCelebrants.length > 0 && (
                  <div className="absolute top-0.5 left-0.5 text-xs">🎂</div>
                )}

                <span className={`text-[12px] font-bold leading-tight ${isWeekend && !isMyShift ? 'text-rose-400' : ''}`}>{day}</span>

                {isMyWorking && (myTimeStart || (myMultipleShifts && myMultipleShifts.length > 0)) ? (
                  <>
                    {hasOverlap ? (
                      <div className="w-full px-0.5 mt-0.5 flex flex-col gap-[2px]">
                        {myMultipleShifts && myMultipleShifts.length > 0 ? (
                          myMultipleShifts.map((ms, idx) => {
                            const deptCfg = DEPARTMENT_CONFIG[ms.dept];
                            const deptIcon = deptCfg?.icon ? `${deptCfg.icon} ` : '';
                            return (
                              <div
                                key={idx}
                                className="w-full text-center text-[8px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                                style={{ backgroundColor: deptCfg?.color + '40', color: deptCfg?.color }}
                              >
                                {deptIcon}{ms.hours}ч
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className="w-full text-center text-[8px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                            style={{ backgroundColor: myDeptColor + '40', color: myDeptColor }}
                          >
                            {myShortTime}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-[2px] mt-0.5 w-full px-1">
                        {myMultipleShifts && myMultipleShifts.length > 0 ? (
                          myMultipleShifts.map((ms, idx) => {
                            const deptCfg = DEPARTMENT_CONFIG[ms.dept];
                            const deptIcon = deptCfg?.icon ? `${deptCfg.icon} ` : '';
                            return (
                              <div
                                key={idx}
                                className="w-full text-center text-[8px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                                style={{ backgroundColor: deptCfg?.color + '40', color: deptCfg?.color }}
                              >
                                {deptIcon}{ms.hours}ч
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <div
                              className="w-full text-center text-[8px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                              style={{ backgroundColor: myDeptColor + '40', color: myDeptColor }}
                            >
                              {myTimeStart}
                            </div>
                            {myTimeEnd && (
                              <div
                                className="w-full text-center text-[8px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                                style={{ backgroundColor: myDeptColor + '40', color: myDeptColor }}
                              >
                                {myTimeEnd}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {colleagueShifts.length > 0 && (
                      <div className="flex flex-col items-center gap-[2px] mt-0.5 w-full px-0.5">
                        {colleagueShifts.map((c, i) => {
                          const cTimes = SHIFT_TIMES[c.shift];
                          const timeStart = c.customStart ?? cTimes?.start;
                          const timeEnd = c.customEnd ?? cTimes?.end;
                          let items: Array<{ text: string; color: string }> = [];
                          const deptIcon = c.deptIcon ? `${c.deptIcon} ` : '';

                          if (c.shiftsWithTimes && c.shiftsWithTimes.length > 0) {
                            items = c.shiftsWithTimes.map(swt => {
                              const icon = DEPARTMENT_CONFIG[swt.dept]?.icon ? `${DEPARTMENT_CONFIG[swt.dept].icon} ` : '';
                              return {
                                text: `${icon}${swt.role} ${swt.startTime.slice(0,2)}-${swt.endTime.slice(0,2)}`,
                                color: c.color,
                              };
                            });
                          } else if (c.multipleShifts && c.multipleShifts.length > 0) {
                            items = c.multipleShifts.map(ms => {
                              const deptCfg = DEPARTMENT_CONFIG[ms.dept];
                              const deptIcon = deptCfg?.icon ? `${deptCfg.icon} ` : '';
                              const text = `${deptIcon}${ms.hours}ч`;
                              return {
                                text,
                                color: deptCfg?.color || c.color,
                              };
                            });
                          } else if (c.hours) {
                            items = [{ text: `${deptIcon}${c.hours}ч`, color: c.color }];
                          } else if (timeStart && timeEnd && (c.customStart || c.customEnd)) {
                            items = [{ text: `${deptIcon}${formatHourLabel(timeStart, timeEnd) || ''}`, color: c.color }];
                          } else if (cTimes?.short) {
                            items = [{ text: `${deptIcon}${cTimes.short}`, color: c.color }];
                          }
                          
                          if (items.length === 0) return null;
                          return (
                            <div key={i} className="w-full flex flex-col gap-[2px]">
                              {items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="w-full text-center text-[7px] font-bold leading-none px-0.5 py-[2px] rounded-[3px] truncate"
                                  style={{ backgroundColor: item.color + '30', color: item.color, border: `1px solid ${item.color}60` }}
                                >
                                  {item.text}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : isMyShift && !isMyWorking ? (
                  <span className="text-[10px] font-bold leading-none mt-0.5">
                    {myShift === 'vacation' ? 'ОТ' : 'Б'}
                  </span>
                ) : hasColleague ? (
                  <div className="flex flex-col items-center gap-[2px] mt-0.5 w-full px-0.5">
                    {colleagueShifts.map((c, i) => {
                      const cTimes = SHIFT_TIMES[c.shift];
                      const timeStart = c.customStart ?? cTimes?.start;
                      const timeEnd = c.customEnd ?? cTimes?.end;
                      let items: Array<{ text: string; color: string }> = [];
                      const deptIcon = c.deptIcon ? `${c.deptIcon} ` : '';

                      if (c.shiftsWithTimes && c.shiftsWithTimes.length > 0) {
                        items = c.shiftsWithTimes.map(swt => {
                          const icon = DEPARTMENT_CONFIG[swt.dept]?.icon ? `${DEPARTMENT_CONFIG[swt.dept].icon} ` : '';
                          return {
                            text: `${icon}${swt.role} ${swt.startTime.slice(0,2)}-${swt.endTime.slice(0,2)}`,
                            color: c.color,
                          };
                        });
                      } else if (c.multipleShifts && c.multipleShifts.length > 0) {
                        items = c.multipleShifts.map(ms => ({
                          text: `${deptIcon}${ms.hours}ч`,
                          color: c.color,
                        }));
                      } else if (c.hours) {
                        items = [{ text: `${deptIcon}${c.hours}ч`, color: c.color }];
                      } else if (timeStart && timeEnd && (c.customStart || c.customEnd)) {
                        items = [{ text: `${deptIcon}${formatHourLabel(timeStart, timeEnd) || ''}`, color: c.color }];
                      } else if (cTimes?.short) {
                        items = [{ text: `${deptIcon}${cTimes.short}`, color: c.color }];
                      }
                      
                      if (items.length === 0) return null;
                      return (
                        <div key={i} className="w-full flex flex-col gap-[2px]">
                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className="w-full text-center text-[7px] font-bold leading-none px-0.5 py-[2px] rounded-[3px] truncate"
                              style={{ backgroundColor: item.color + '30', color: item.color, border: `1px solid ${item.color}60` }}
                            >
                              {item.text}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : hasAnyShift ? (
                  <div className="w-1.5 h-1.5 rounded-full mt-1 opacity-40" style={{ backgroundColor: SHIFT_CONFIG[getDominantShift(allShifts)].color }} />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Легенда */}
        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2.5 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          {(['bar_manager','power','bar','hall','kitchen'] as Department[]).map(d => {
            const cfg = DEPARTMENT_CONFIG[d];
            return (
              <div key={d} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.color + '50', border: `1.5px solid ${cfg.color}` }} />
                <span className={`text-[10px] font-semibold ${sub}`}>{cfg.icon} {cfg.label}</span>
              </div>
            );
          })}
          {colleagueIds.map((cId, index) => {
            const cEmp = data.employees.find(e => e.id === cId);
            if (!cEmp) return null;
            const cColor = ensureColleagueColor(cEmp, index);
            return (
              <div key={cId} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cColor }} />
                <span className="text-[10px] font-semibold" style={{ color: cColor }}>
                  {cEmp.name.split(' ')[1] ?? cEmp.name.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay !== null && (
        <DayModal
          day={selectedDay} month={month} year={year}
          data={data} linkedEmpId={linkedEmpId}
          isAdmin={isAdmin}
          onClose={() => setSelectedDay(null)}
        />
      )}
      {showColleagueSelector && (
        <ColleagueSelector
          data={data} linkedEmpId={linkedEmpId}
          selectedIds={colleagueIds}
          friendIds={friendIds}
          isAdmin={isAdmin}
          onToggle={handleColleagueToggle}
          onClose={() => setShowColleagueSelector(false)}
        />
      )}
    </div>
  );
};
