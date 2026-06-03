import React, { useMemo, useState } from 'react';
import { ScheduleData, ShiftEntry, Employee, getDepartment } from '../types/schedule';
import { useTheme } from '../context/ThemeContext';
import { getShiftEdit } from '../utils/adminEdits';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// Ставки по должностям (руб/ч)
const ROLE_RATES: Record<string, number> = {
  'менеджер': 320,
  'барменеджер': 220,
  'бар-менеджер': 220,
  'управляющий': 320,
  'старший менеджер': 320,
  'бармен ст.': 220,
  'бармен ст': 220,
  'старший бармен': 220,
  'бармен': 220,
  'официант ст.': 175,
  'официант ст': 175,
  'старший официант': 175,
  'официант': 175,
  'повар': 350,
  'шеф-повар': 350,
  'шеф': 350,
  'су-шеф': 350,
  'помощник повара': 270,
  'кухонный работник': 270,
  'тех.персонал': 260,
  'тех. персонал': 260,
  'тех.перс': 260,
  'тех. перс': 260,
  'техперс': 260,
  'технический персонал': 260,
  'тех перс': 260,
  'уборщик': 260,
  'уборщица': 260,
  'клинер': 260,
};

function getRateForRole(role: string): number | null {
  const norm = role.toLowerCase().trim();
  if (ROLE_RATES[norm] !== undefined) return ROLE_RATES[norm];
  for (const [key, rate] of Object.entries(ROLE_RATES)) {
    if (norm.includes(key) || key.includes(norm)) return rate;
  }
  return null;
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

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

interface RoleReportItem {
  role: string;
  shifts: number;
  hours: number;
  income: number;
  rate: number;
}

interface MonthlyReport {
  totalShifts: number;
  totalHours: number;
  totalIncome: number;
  byRole: RoleReportItem[];
}

function getShiftSegments(shift: ShiftEntry, emp: Employee): Array<{ role: string; hours: number }> {
  const baseRole = shift.role || emp.role;
  const edit = getShiftEdit(emp.id, shift.date);

  // Если админ изменил время — используем его
  if (edit?.customStart && edit?.customEnd) {
    const hours = calcHoursFromTimeRange(edit.customStart, edit.customEnd);
    return hours > 0 ? [{ role: baseRole, hours }] : [];
  }

  if (shift.shiftsWithTimes && shift.shiftsWithTimes.length > 0) {
    return shift.shiftsWithTimes
      .map(swt => {
        const hours = calcHoursFromTimeRange(swt.startTime, swt.endTime);
        const role = swt.role || baseRole;
        return hours > 0 ? { role, hours } : null;
      })
      .filter(Boolean) as Array<{ role: string; hours: number }>;
  }

  if (shift.multipleShifts && shift.multipleShifts.length > 0) {
    return shift.multipleShifts
      .map(ms => {
        // Сначала используем роль из multipleShifts, потом ищем по отделу, потом базовую роль
        const roleForDept = ms.role || emp.roles?.find(r => getDepartment(r) === ms.dept) || baseRole;
        return ms.hours > 0 ? { role: roleForDept, hours: ms.hours } : null;
      })
      .filter(Boolean) as Array<{ role: string; hours: number }>;
  }

  if (typeof shift.hours === 'number' && shift.hours > 0) {
    return [{ role: baseRole, hours: shift.hours }];
  }

  return [];
}

interface ReportsSectionProps {
  data: ScheduleData;
  linkedEmpId: string | null;
  onRefresh?: (month: number, year: number) => void;
}

function generateReportText(emp: Employee, report: MonthlyReport, monthLabel: string): string {
  if (report.byRole.length === 0) {
    return `📊 Итоги за ${monthLabel}\n\n👤 ${emp.name}\n⏱ Всего часов: 0`;
  }

  if (report.byRole.length === 1) {
    const role = report.byRole[0];
    return `📊 Итоги за ${monthLabel}\n\n👤 ${emp.name} (${role.role})\n⏱ Всего часов: ${Math.round(report.totalHours * 100) / 100}`;
  }

  // Несколько должностей
  let text = `📊 Итоги за ${monthLabel}\n\n👤 ${emp.name}\n`;
  for (const role of report.byRole) {
    text += `${role.role} : ${Math.round(role.hours * 100) / 100} ч\n`;
  }
  return text;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({ data, linkedEmpId, onRefresh }) => {
  const { isDark } = useTheme();
  const now = new Date();

  const [month, setMonth] = useState<Date>(() => {
    const detectedYear = data.year ?? now.getFullYear();
    const detectedMonth = (data.month ? data.month - 1 : now.getMonth());
    return new Date(detectedYear, detectedMonth, 1);
  });

  const linkedEmp = linkedEmpId ? data.employees.find(e => e.id === linkedEmpId) ?? null : null;

  const report = useMemo<MonthlyReport | null>(() => {
    if (!linkedEmp) return null;

    const { start, end } = getMonthBounds(month);
    const shiftsInMonth = data.shifts.filter(s =>
      s.employeeId === linkedEmpId &&
      s.date >= start &&
      s.date <= end
    );

    const segments = shiftsInMonth.flatMap(s => getShiftSegments(s, linkedEmp));
    const totalShifts = segments.length;
    const totalHours = segments.reduce((sum, seg) => sum + seg.hours, 0);

    const byRoleMap: Record<string, RoleReportItem> = {};
    for (const seg of segments) {
      const role = seg.role;
      const rate = getRateForRole(role) ?? 0;
      const income = seg.hours * rate;
      if (!byRoleMap[role]) {
        byRoleMap[role] = { role, shifts: 0, hours: 0, income: 0, rate };
      }
      byRoleMap[role].shifts += 1;
      byRoleMap[role].hours += seg.hours;
      byRoleMap[role].income += income;
    }

    const byRole = Object.values(byRoleMap).sort((a, b) => b.hours - a.hours);
    const totalIncome = byRole.reduce((sum, r) => sum + r.income, 0);

    return { totalShifts, totalHours, totalIncome, byRole };
  }, [data, linkedEmp, linkedEmpId, month]);

  const changeMonth = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const card      = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';
  const lbl       = isDark ? 'text-slate-100' : 'text-gray-900';
  const sub       = isDark ? 'text-slate-400' : 'text-gray-500';

  const monthLabel = `${MONTHS_RU[month.getMonth()]} ${month.getFullYear()}`;

  const refresh = () => {
    if (!onRefresh) return;
    onRefresh(month.getMonth() + 1, month.getFullYear());
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-bold transition-all active:scale-95 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-gray-600'}`}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <div className={`text-sm font-semibold ${lbl}`}>{monthLabel}</div>
          <button
            onClick={refresh}
            title="Обновить данные"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition-all active:scale-95 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-gray-600'}`}
          >
            ⟳
          </button>
        </div>
        <button
          onClick={() => changeMonth(1)}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-bold transition-all active:scale-95 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-gray-600'}`}
        >
          ›
        </button>
      </div>

      {!linkedEmp && (
        <div className={`rounded-2xl p-6 border shadow-sm text-center ${card}`}>
          <p className={`text-sm font-semibold ${lbl}`}>Привяжи аккаунт, чтобы видеть свои отчёты</p>
          <p className={`text-xs mt-1 ${sub}`}>Открой профиль и выбери себя из списка сотрудников.</p>
        </div>
      )}

      {linkedEmp && report && (
        <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>Отчёт за месяц</p>
              <h2 className={`text-2xl font-extrabold ${lbl}`}>Итоги</h2>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${lbl}`}>Смен</p>
              <p className={`text-3xl font-extrabold ${lbl}`}>{report.totalShifts}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-900/40' : 'bg-gray-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>Часы</p>
              <p className={`text-2xl font-extrabold ${lbl}`}>{Math.round(report.totalHours * 100) / 100} ч</p>
            </div>
            <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-900/40' : 'bg-gray-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>Доход</p>
              <p className={`text-2xl font-extrabold ${lbl}`}>{report.totalIncome.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl p-4 border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>Разбивка по должностям</p>
            {report.byRole.length === 0 ? (
              <p className={`text-sm mt-3 ${sub}`}>Нет смен с проставленными часами в этом месяце.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {report.byRole.map(r => (
                  <div key={r.role} className="flex items-center justify-between gap-3">
                    <div className="min-w-[150px]">
                      <p className={`text-sm font-semibold ${lbl}`}>{r.role}</p>
                      <p className={`text-xs ${sub}`}>{r.rate ? `${r.rate} ₽/ч` : 'Ставка не найдена'}</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${lbl}`}>{r.shifts}</p>
                        <p className={`text-xs ${sub}`}>смен</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${lbl}`}>{Math.round(r.hours * 100) / 100}</p>
                        <p className={`text-xs ${sub}`}>ч</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${lbl}`}>{Math.round(r.income).toLocaleString('ru-RU')} ₽</p>
                        <p className={`text-xs ${sub}`}>доход</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`mt-4 rounded-2xl p-4 border flex items-start gap-3 ${isDark ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
            <span className="text-lg">⚠️</span>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
              Отчёт составлен по часам, которые уже проставлены в графике. В расчёт попадают только смены, у которых указаны часы. Доход указан только за проставленные часы и не включает удержаний, премий и других корректировок.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
