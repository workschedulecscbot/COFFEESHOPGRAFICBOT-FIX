import React, { useState } from 'react';
import {
  ScheduleData, ShiftType, SHIFT_CONFIG,
  DEPARTMENT_CONFIG, getDepartment, Employee,
} from '../types/schedule';
import { getEmpNote, saveEmpNote, getShiftEdit } from '../utils/adminEdits';
import { useTheme } from '../context/ThemeContext';


const DAY_LABELS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const SHIFT_TIMES: Record<ShiftType, { start: string; end: string } | null> = {
  daily: { start: '09:00', end: '09:00' },
  day:   { start: '09:00', end: '20:00' },
  night: { start: '20:00', end: '09:00' },
  off: null, vacation: null, sick: null,
};

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// Цвет отдела по должности на конкретный день
function getDeptColor(role: string, fallback: string): string {
  const dept = getDepartment(role);
  if (dept) return DEPARTMENT_CONFIG[dept].color;
  return fallback;
}

interface EmployeeCardProps {
  emp: Employee;
  data: ScheduleData;
  month: number;
  year: number;
  today: Date;
  isFriend: boolean;
  isAdmin?: boolean;
  onToggleFriend: (id: string) => void;
  onClose: () => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  emp, data, month, year, today, isFriend, isAdmin = false, onToggleFriend, onClose,
}) => {
  const { isDark } = useTheme();
  const [cardMonth, setCardMonth] = useState(month);
  const [cardYear, setCardYear]   = useState(year);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteText, setNoteText] = useState(() => getEmpNote(emp.id) || '');
  const [savedNote, setSavedNote] = useState(() => getEmpNote(emp.id) || '');

  const dept = emp.department ?? getDepartment(emp.role);
  const deptCfg = dept ? DEPARTMENT_CONFIG[dept] : null;

  const todayStr    = formatDate(today.getFullYear(), today.getMonth()+1, today.getDate());
  const daysInMonth = new Date(cardYear, cardMonth, 0).getDate();
  const firstDow    = new Date(cardYear, cardMonth-1, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const getShiftEntry = (day: number) => {
    const dateStr = formatDate(cardYear, cardMonth, day);
    return data.shifts.find(s => s.employeeId === emp.id && s.date === dateStr);
  };

  // Смена сегодня
  const todayEntry  = data.shifts.find(s => s.employeeId === emp.id && s.date === todayStr);
  const todayShift: ShiftType = todayEntry?.shift ?? 'off';
  const todayRole   = todayEntry?.role || emp.role;
  const todayCfg    = SHIFT_CONFIG[todayShift];
  const todayTimes  = SHIFT_TIMES[todayShift];
  
  // Получаем кастомное время на сегодня, если администратор его задал
  const todayCustomEdit = getShiftEdit(emp.id, todayStr);
  const todayDisplayStart = todayCustomEdit?.customStart || todayTimes?.start;
  const todayDisplayEnd = todayCustomEdit?.customEnd || todayTimes?.end;

  // Цвет шапки — по должности сегодня
  const headerDept   = getDepartment(todayRole) ?? dept;
  const headerColor  = headerDept
    ? ({ power: 'linear-gradient(135deg,#b45309,#d97706)', bar: 'linear-gradient(135deg,#7c3aed,#a855f7)', hall: 'linear-gradient(135deg,#0369a1,#0ea5e9)', kitchen: 'linear-gradient(135deg,#15803d,#22c55e)' })[headerDept]
    : 'linear-gradient(135deg,#6366f1,#8b5cf6)';

  const tgUsername = emp.tgUsername || '';
  const showTelegramPref = !!emp.tgUsername; // Показывать кнопку если есть username, независимо от настроек
  const tgError = showTelegramPref && !tgUsername ? 'Telegram не указан администратором' : '';

  const CAL_CELL: Record<ShiftType, string> = isDark ? {
    daily:    'bg-violet-900/40 border-violet-600 text-violet-300',
    day:      'bg-blue-900/40 border-blue-600 text-blue-300',
    night:    'bg-indigo-950 border-indigo-700 text-indigo-300',
    off:      'bg-slate-800/30 border-slate-700/50 text-slate-700',
    vacation: 'bg-emerald-900/40 border-emerald-600 text-emerald-300',
    sick:     'bg-red-900/40 border-red-600 text-red-300',
  } : {
    daily:    'bg-violet-100 border-violet-400 text-violet-700',
    day:      'bg-blue-100 border-blue-400 text-blue-700',
    night:    'bg-indigo-950 border-indigo-500 text-indigo-200',
    off:      'bg-gray-50 border-gray-100 text-gray-200',
    vacation: 'bg-emerald-100 border-emerald-400 text-emerald-700',
    sick:     'bg-red-100 border-red-400 text-red-700',
  };

  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';
  const lbl  = isDark ? 'text-slate-100' : 'text-gray-900';
  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-md rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Шапка */}
          <div className="rounded-t-3xl p-5 text-white" style={{ background: headerColor }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Аватар — цвет отдела */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-inner"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.5)' }}
                >
                  {emp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                </div>

                <div>
                  <h2 className="font-extrabold text-xl leading-tight">{emp.name}</h2>
                  <p className="text-white/70 text-sm mt-0.5">{emp.role}</p>
                  {deptCfg && (
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 inline-block mt-1 ${isDark ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-700'}`}>
                      {deptCfg.icon} {deptCfg.label}
                    </span>
                  )}

                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowNoteEditor(v => !v)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white/70 text-base active:scale-95"
                    title="Добавить заметку"
                  >✏️</button>
                )}
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white/70 text-xl active:scale-95">×</button>
              </div>
            </div>

            {/* Заметка администратора */}
            {savedNote && !showNoteEditor && (
              <div className="mt-3 bg-amber-400/20 border border-amber-400/40 rounded-2xl px-3 py-2 flex items-start gap-2">
                <span className="text-amber-300 text-sm">💬</span>
                <p className="text-amber-100 text-xs leading-relaxed flex-1">{savedNote}</p>
              </div>
            )}

            {/* Редактор заметки */}
            {showNoteEditor && (
              <div className="mt-3 bg-white/10 rounded-2xl p-3">
                <p className="text-white/60 text-xs font-semibold mb-2">📝 Заметка о сотруднике</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Например: работает 0.5 ставки, особые условия..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl text-white text-xs p-2 resize-none outline-none placeholder-white/30 focus:border-white/40"
                  rows={3}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      saveEmpNote(emp.id, noteText);
                      setSavedNote(noteText.trim());
                      setShowNoteEditor(false);
                    }}
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-2 rounded-xl active:scale-95 transition-all"
                  >Сохранить</button>
                  <button
                    onClick={() => { setShowNoteEditor(false); setNoteText(savedNote); }}
                    className="px-4 bg-white/10 text-white/60 text-xs py-2 rounded-xl active:scale-95"
                  >Отмена</button>
                </div>
              </div>
            )}

            {/* Смена сегодня */}
            {todayShift !== 'off' && (
              <div className="mt-4 bg-white/15 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-2xl">{todayCfg.icon}</span>
                <div>
                  <p className="text-white/60 text-xs font-medium">Сегодня</p>
                  <p className="font-bold text-sm">{todayCfg.label}</p>
                  {todayDisplayStart && todayDisplayEnd && (
                    <p className="text-white/70 text-xs">{todayDisplayStart} — {todayDisplayEnd}</p>
                  )}
                </div>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => onToggleFriend(emp.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                  isFriend
                    ? 'bg-white text-indigo-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span>{isFriend ? '⭐' : '☆'}</span>
                <span>{isFriend ? 'В друзьях' : 'Добавить'}</span>
              </button>

              {showTelegramPref ? (
                tgUsername && tgUsername !== 'no' ? (
                  <a
                    href={`https://t.me/${tgUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm bg-white/20 text-white hover:bg-white/30 transition-all active:scale-95"
                  >
                    <span>✈️</span>
                    <span>Написать</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm bg-white/10 text-white/40 cursor-not-allowed"
                  >
                    <span>✈️</span>
                    <span>TG нет</span>
                  </button>
                )
              ) : (
                <button
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm bg-white/10 text-white/40 cursor-not-allowed"
                >
                  <span>✈️</span>
                  <span>TG нет</span>
                </button>
              )}
              {tgError && (
                <p className="text-[10px] text-red-500 mt-1">{tgError}</p>
              )}
            </div>
          </div>

          {/* Личный календарь */}
          <div className={`mx-4 mt-4 mb-6 rounded-2xl border overflow-hidden ${card}`}>
            {/* Слайдер */}
            <div className={`flex items-center p-2 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <button
                onClick={() => { if (cardMonth === 1) { setCardMonth(12); setCardYear(y => y-1); } else setCardMonth(m => m-1); }}
                className={`w-8 h-7 flex items-center justify-center rounded-lg font-bold text-lg ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >‹</button>
              <span className={`flex-1 text-center text-xs font-bold ${lbl}`}>
                {MONTHS_RU_FULL[cardMonth-1]} {cardYear}
              </span>
              <button
                onClick={() => { if (cardMonth === 12) { setCardMonth(1); setCardYear(y => y+1); } else setCardMonth(m => m+1); }}
                className={`w-8 h-7 flex items-center justify-center rounded-lg font-bold text-lg ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >›</button>
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7">
              {DAY_LABELS_SHORT.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-bold py-1.5 ${i >= 5 ? 'text-rose-400' : isDark ? 'text-slate-500' : 'text-gray-400'}`}>{d}</div>
              ))}
            </div>

            {/* Ячейки — цвет зависит от должности в этот день */}
            <div className="grid grid-cols-7 gap-[2px] p-[3px]">
              {Array.from({ length: startOffset }).map((_,i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_,i) => i+1).map(day => {
                const entry    = getShiftEntry(day);
                const shift    = entry?.shift ?? 'off';
                const dayRole  = entry?.role || emp.role;
                const dayColor = getDeptColor(dayRole, emp.color);
                const isToday  = formatDate(cardYear, cardMonth, day) === todayStr;
                const dow      = new Date(cardYear, cardMonth-1, day).getDay();
                const isWeekend= dow === 0 || dow === 6;
                const times    = SHIFT_TIMES[shift];
                
                // Получаем кастомное время, если администратор его задал
                const dateStr = formatDate(cardYear, cardMonth, day);
                const customEdit = getShiftEdit(emp.id, dateStr);
                const displayStart = customEdit?.customStart || times?.start;
                const displayEnd = customEdit?.customEnd || times?.end;

                // Для рабочих смен используем динамический цвет отдела вместо фиксированного класса
                const isWorking = shift === 'daily' || shift === 'day' || shift === 'night';

                return (
                  <div
                    key={day}
                    className={`relative flex flex-col items-center justify-start rounded-xl border-2 overflow-hidden pt-1 pb-1
                      ${isToday ? 'ring-2 ring-offset-1 ' + (isDark ? 'ring-indigo-400 ring-offset-slate-800' : 'ring-indigo-500 ring-offset-white') : ''}
                      ${!isWorking && shift !== 'off' ? CAL_CELL[shift] : ''}
                      ${shift === 'off' ? isDark ? `border-slate-700/50 ${isWeekend ? 'text-rose-500/40' : 'text-slate-700'}` : `border-gray-100 ${isWeekend ? 'text-rose-200' : 'text-gray-200'}` : ''}
                    `}
                    style={isWorking ? {
                      backgroundColor: dayColor + '25',
                      borderColor: dayColor + '80',
                      color: dayColor,
                      minHeight: '60px',
                    } : { minHeight: '60px' }}
                  >
                    <span className={`text-[11px] font-bold leading-tight ${isWeekend && shift === 'off' ? 'text-rose-400' : ''}`}>{day}</span>
                    {isWorking && displayStart && displayEnd && (
                      <div className="flex flex-col items-center gap-[2px] mt-0.5 w-full px-0.5">
                        <div
                          className="w-full text-center text-[7px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                          style={{ backgroundColor: dayColor + '30', color: dayColor }}
                        >
                          {displayStart}
                        </div>
                        <div
                          className="w-full text-center text-[7px] font-bold leading-none px-0.5 py-[2px] rounded-[3px]"
                          style={{ backgroundColor: dayColor + '30', color: dayColor }}
                        >
                          {displayEnd}
                        </div>
                      </div>
                    )}
                    {shift === 'vacation' && <span className="text-[9px] font-bold leading-none mt-0.5">ОТ</span>}
                    {shift === 'sick'     && <span className="text-[9px] font-bold leading-none mt-0.5">Б</span>}
                  </div>
                );
              })}
            </div>

            {/* Легенда — отделы вместо типов смен */}
            <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              {(['bar_manager','power','bar','hall','kitchen'] as const).map(d => {
                const cfg = DEPARTMENT_CONFIG[d];
                return (
                  <div key={d} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.color + '60', border: `1.5px solid ${cfg.color}` }} />
                    <span className={`text-[10px] font-semibold ${sub}`}>{cfg.icon} {cfg.label}</span>
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
