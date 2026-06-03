import React, { useState, useEffect } from 'react';
import {
  ScheduleData, DEPARTMENT_CONFIG, Department, getDepartment, Employee,
} from '../types/schedule';
import { useTheme } from '../context/ThemeContext';
import { EmployeeCard } from './EmployeeCard';
import { ReportsSection } from './ReportsSection';
import {
  getTgUser, getTgUserId, getTgFullName, initTelegramApp,
  saveTgLink, getEmpIdByTgId, syncTgLink, clearTgLinksForEmp,
} from '../utils/telegram';
import { saveEmpNote, getEmpNote, saveLinkedEmpId, getLinkedEmpId, saveEmpPrefs, getEmpPrefs } from '../utils/adminEdits';
import { fetchEmployeeNotes, testFullFirebase, testFirestoreIndexError } from '../utils/firebase';
import { watchEmpNotes } from '../utils/firebase';

const MONTHS_RU_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DEPT_ORDER: Department[] = ['bar_manager', 'power', 'bar', 'hall', 'kitchen'];
const STORAGE_TG_NAME     = 'sf_tg_name';
const STORAGE_FRIENDS_IDS = 'sf_friends_ids';

const ADMIN_TG_IDS: number[] = [783948887, 6147055724];

type ProfileSection = 'reports' | 'staff' | 'settings' | 'bugreport';

function normalizeName(s: string) { return s.toLowerCase().replace(/\s+/g,' ').trim(); }
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1;
  const wA = na.split(' '), wB = nb.split(' ');
  let m = 0;
  for (const wa of wA) for (const wb of wB)
    if (wa.length > 1 && (wa === wb || wb.startsWith(wa) || wa.startsWith(wb))) m++;
  return m / Math.max(wA.length, wB.length);
}
function findMatchingEmployees(data: ScheduleData, q: string) {
  if (!q.trim()) return [];
  return data.employees
    .map(emp => ({ emp, score: nameSimilarity(emp.name, q) }))
    .filter(({ score }) => score > 0.3)
    .sort((a,b) => b.score - a.score)
    .map(({ emp }) => emp);
}
function toInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Settings Section ──────────────────────────────────────────────
interface SettingsSectionProps {
  sheetId: string; sheetGid: string;
  sheetsApiKey?: string;
  appsScriptUrl?: string;
  employeeDataScriptUrl?: string;
  onSave: (id: string, gid: string, apiKey?: string, scriptUrl?: string, employeeScriptUrl?: string) => void;
  lastSync: string | null;
  isLoading: boolean; onRefresh: () => void;
  error: string | null;
  fakeDate: Date | null;
  onFakeDateChange: (d: Date | null) => void;
  onOpenAdminPanel?: () => void;
  isAdmin?: boolean;
  linkedEmp?: Employee | null;
  tgUser?: any;
  tgId?: number | null;
  onEmployeeUpdate?: (emp: Employee) => void;
}
const SettingsSection: React.FC<SettingsSectionProps> = ({
  sheetId, sheetGid, sheetsApiKey = '', appsScriptUrl = '', employeeDataScriptUrl = '', onSave, lastSync, isLoading, onRefresh, error,
  fakeDate, onFakeDateChange, onOpenAdminPanel, isAdmin = false, linkedEmp, tgUser, tgId,
  onEmployeeUpdate,
}) => {
  const { isDark, setTheme } = useTheme();
  // alias to avoid potential scoping issues inside nested callbacks
  const updateEmployee = onEmployeeUpdate;
  const [localId, setLocalId]         = useState(sheetId);
  const [localGid, setLocalGid]       = useState(sheetGid);
  const [localApiKey, setLocalApiKey] = useState(sheetsApiKey);
  const [localScript, setLocalScript] = useState(appsScriptUrl);
  const [localEmployeeScript, setLocalEmployeeScript] = useState(employeeDataScriptUrl);
  const [fakeDateEnabled, setFakeDateEnabled] = useState(!!fakeDate);
  const [fakeDateVal, setFakeDateVal] = useState<string>(fakeDate ? toInputValue(fakeDate) : toInputValue(new Date()));
  const [copyingDebug, setCopyingDebug] = useState(false);

  // Очистка localStorage
  const handleClearLocalStorage = () => {
    const tg = window.Telegram?.WebApp;
    const confirm = tg
      ? tg.showConfirm
      : (msg: string, cb: (confirmed: boolean) => void) => cb(window.confirm(msg));
    confirm('Вы уверены, что хотите полностью очистить все локальные данные?\n\nВас потребуется заново привязать профиль.', (confirmed: boolean) => {
      if (!confirmed) return;
      const keys = [
        'sf_linked_emp_id',
        'sf_tg_links',
        'sf_emp_prefs',
        'sf_admin_shift_edits',
        'sf_admin_emp_notes',
        'sf_admin_emp_rules',
        'ss_sheet_id',
        'ss_sheet_gid',
        'ss_sheets_api_key',
        'ss_apps_script_url',
        'sf_friends_ids',
        'sf_invite_codes',
        'sf_tg_name',
      ];
      keys.forEach(k => localStorage.removeItem(k));
      if (tg && tg.showAlert) {
        tg.showAlert('✅ Данные успешно очищены!\nСтраница будет перезагружена.', () => window.location.reload());
      } else {
        alert('✅ Данные успешно очищены!\nСтраница будет перезагружена.');
        window.location.reload();
      }
    });
  };

  // Реалтайм-подписка на примечания к сотрудникам
  useEffect(() => {
    if (!linkedEmp) return;
    console.log('[ProfileView] Setting up Firebase listeners for:', linkedEmp.id);
    const unsubscribers: (() => void)[] = [];
    
    try {
      // Подписка на employee notes (заметки)
      const unsubNotes = watchEmpNotes((allNotes) => {
        try {
          const note = allNotes.find(n => n.empId === linkedEmp.id);
          if (note) {
            console.log('[ProfileView] Notes updated for:', linkedEmp.id);
            // Можно добавить setNoteText(note.note) если нужно live-отображение
          }
        } catch (err) {
          console.error('[ProfileView] Error processing notes:', err);
        }
      });
      unsubscribers.push(unsubNotes);
    } catch (err) {
      console.error('[ProfileView] Failed to set up Firebase listeners:', err);
    }

    return () => {
      console.log('[ProfileView] Cleaning up Firebase listeners for:', linkedEmp.id);
      unsubscribers.forEach(unsub => {
        try { unsub?.(); } catch (err) { console.error('[ProfileView] Error unsubscribing:', err); }
      });
    };
  }, [linkedEmp]);

  useEffect(() => {
    setFakeDateEnabled(!!fakeDate);
    if (fakeDate) setFakeDateVal(toInputValue(fakeDate));
  }, [fakeDate]);

  const handleSave = () => {
    const id = localId.includes('spreadsheets/d/')
      ? localId.split('spreadsheets/d/')[1].split('/')[0]
      : localId.trim();
    onSave(id, localGid, localApiKey.trim() || undefined, localScript.trim() || undefined, localEmployeeScript.trim() || undefined);
  };

  const handleFakeDateToggle = (v: boolean) => {
    setFakeDateEnabled(v);
    if (!v) { onFakeDateChange(null); return; }
    const d = new Date(fakeDateVal);
    if (!isNaN(d.getTime())) onFakeDateChange(d);
  };

  const handleFakeDateValueChange = (v: string) => {
    setFakeDateVal(v);
    if (fakeDateEnabled) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) onFakeDateChange(d);
    }
  };

  const inp  = isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400';
  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';
  const lbl  = isDark ? 'text-slate-100' : 'text-gray-900';
  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';

  
  return (
    <div className="space-y-4 pb-6">
      {/* debug block был удалён */}
      {/* Баннер ошибки синхронизации prefs удалён */}
      {/* Тема */}
      <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
        <h3 className={`font-bold text-sm mb-3 ${lbl}`}>🎨 Тема оформления</h3>
        <div className={`flex p-1 rounded-xl gap-1 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
          <button
            onClick={() => isDark && setTheme('light')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 ${!isDark ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}
          >☀️ Светлая</button>
          <button
            onClick={() => !isDark && setTheme('dark')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 ${isDark ? 'bg-slate-600 text-slate-100 shadow-sm' : 'text-gray-400'}`}
          >🌙 Тёмная</button>
        </div>
      </div>

      {/* Очистка localStorage */}
      <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
        <h3 className={`font-bold text-sm mb-3 ${lbl}`}>🧹 Очистить данные</h3>
        <p className={`text-xs mb-3 ${sub}`}>Полностью удалить все локальные данные и привязки на этом устройстве.</p>
        <button
          onClick={handleClearLocalStorage}
          className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all hover:bg-red-600"
        >Очистить данные</button>
      </div>

      {/* Google Sheets — только администраторы */}
      {isAdmin && (
        <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
          <h3 className={`font-bold text-sm mb-3 ${lbl}`}>🔗 Google Таблица</h3>
          <div className="space-y-3">
            <div>
              <label className={`text-xs font-semibold mb-1.5 block ${sub}`}>ID таблицы или ссылка</label>
              <input
                type="text" value={localId}
                onChange={e => setLocalId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className={`w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${inp}`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold mb-1.5 block ${sub}`}>GID листа (0 = первый лист)</label>
              <input
                type="text" value={localGid}
                onChange={e => setLocalGid(e.target.value)}
                placeholder="0"
                className={`w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${inp}`}
              />
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🗝️</span>
                <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Google Sheets API Key</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-slate-600 text-slate-400' : 'bg-amber-100 text-amber-600'}`}>необязательно</span>
              </div>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-amber-600'}`}>
                Без ключа листы по месяцам не работают.
              </p>
              <input
                type="text" value={localApiKey}
                onChange={e => setLocalApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={`w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 ${inp}`}
              />
            </div>
            {/* Apps Script URL */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-violet-50 border-violet-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">⚡</span>
                <span className={`text-xs font-bold ${isDark ? 'text-violet-400' : 'text-violet-700'}`}>Apps Script URL</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-slate-600 text-slate-400' : 'bg-violet-100 text-violet-500'}`}>необязательно</span>
              </div>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-violet-600'}`}>
                Нужен для навигации по месяцам и синхронизации уведомлений.
              </p>
              <input
                type="text" value={localScript}
                onChange={e => setLocalScript(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 ${inp}`}
              />
            </div>
            {/* Employee Data Script URL */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">👥</span>
                <span className={`text-xs font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>Employee Data Script URL</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-slate-600 text-slate-400' : 'bg-green-100 text-green-600'}`}>необязательно</span>
              </div>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-green-600'}`}>
                Скрипт для загрузки данных сотрудников (день рождения, Telegram).
              </p>
              <input
                type="text" value={localEmployeeScript}
                onChange={e => setLocalEmployeeScript(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400 ${inp}`}
              />
            </div>
            <button
              onClick={handleSave}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm active:scale-95 transition-all hover:bg-indigo-600"
            >Подключить таблицу</button>
          </div>
          {(lastSync || isLoading || error) && (
            <div className={`mt-3 flex items-center justify-between text-xs p-2.5 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
              <span className={sub}>{isLoading ? '⏳ Синхронизация...' : error ? `❌ ${error}` : '✅ Синхронизировано'}</span>
              {!isLoading && (
                <button onClick={onRefresh} className="text-indigo-500 font-semibold active:scale-95">↻ Обновить</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Тестовая дата — только администраторы */}
      {isAdmin && (
        <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={`font-bold text-sm ${lbl}`}>🗓 Тестовая дата</h3>
              <p className={`text-xs mt-0.5 ${sub}`}>Симулировать другой день</p>
            </div>
            <button
              onClick={() => handleFakeDateToggle(!fakeDateEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${fakeDateEnabled ? 'bg-amber-400' : isDark ? 'bg-slate-700' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${fakeDateEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {fakeDateEnabled && (
            <input
              type="date" value={fakeDateVal}
              onChange={e => handleFakeDateValueChange(e.target.value)}
              className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 ${inp}`}
            />
          )}
          {fakeDateEnabled && fakeDate && (
            <p className="text-xs text-amber-500 font-semibold mt-2">
              ⚠️ Активна: {fakeDate.getDate()} {MONTHS_RU_FULL[fakeDate.getMonth()].toLowerCase()} {fakeDate.getFullYear()}
            </p>
          )}
        </div>
      )}

      {/* Панель администратора */}
      {isAdmin && (
        <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
          <h3 className={`font-bold text-sm mb-2 ${lbl}`}>🛡 Администратор</h3>
          <button
            onClick={onOpenAdminPanel}
            className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-semibold text-sm active:scale-95 transition-all"
          >
            👥 Панель сотрудников →
          </button>
        </div>
      )}

      {/* Отправка отладки администраторам — теперь: копирование или открытие чата */}
      {linkedEmp && (
        <div className={`rounded-2xl p-4 border shadow-sm ${card}`}>
          <h3 className={`font-bold text-sm mb-3 ${lbl}`}>🐛 Отладка</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={async () => {
                setCopyingDebug(true);
                try {
                  const allRoles = linkedEmp.roles && linkedEmp.roles.length > 0 ? linkedEmp.roles : [linkedEmp.role];
                  const dept = linkedEmp.department ?? getDepartment(linkedEmp.role);
                  const usernameText = tgUser?.username ? '@' + tgUser.username : 'не указан';
                  const info = [
                    '🐛 ОТЛАДКА ОТ ПОЛЬЗОВАТЕЛЯ',
                    '',
                    `Сотрудник: ${linkedEmp.name}`,
                    `Отдел: ${dept}`,
                    `Должности: ${allRoles.join(', ')}`,
                    `Username: ${usernameText}`,
                    `TG ID: ${tgId ?? 'не указан'}`,
                    '',
                    `Отправлено: ${new Date().toLocaleString('ru-RU')}`,
                  ].join('\n');
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(info);
                  } else {
                    const ta = document.createElement('textarea');
                    ta.value = info;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                  }
                  alert('✅ Информация для отладки скопирована в буфер обмена');
                } catch (err) {
                  console.error('Ошибка копирования отладки:', err);
                  alert('❌ Не удалось скопировать отладку');
                } finally {
                  setCopyingDebug(false);
                }
              }}
              disabled={copyingDebug}
              className={`py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all ${
                copyingDebug ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-amber-400 hover:bg-amber-500 text-white'
              }`}
            >
              {copyingDebug ? '⏳ Копирую...' : '📋 Копировать отладку'}
            </button>

            <button
              onClick={() => {
                const url = 'https://t.me/milkaaasss';
                window.open(url, '_blank');
              }}
              className="py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all bg-sky-500 hover:bg-sky-600 text-white"
            >
              💬 Отправить
            </button>
            <button
              onClick={async () => {
                try {
                  alert('🔍 Запускается комплексный тест Firebase (CRUD)...');
                  const results = await testFullFirebase();
                  alert(`✅ Тест завершён! Пройдено коллекций: ${results.filter(r => r.write.success && r.delete.success).length}/${results.length}. Подробности в консоли`);
                } catch (e) {
                  alert(`❌ Ошибка теста: ${e}`);
                }
              }}
              className="py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all bg-blue-500 hover:bg-blue-600 text-white"
            >
              🧪 Полный CRUD тест Firebase
            </button>
            {/* Удалена дублирующаяся кнопка Firestore Index Error Test */}
          </div>
          <p className={`text-xs mt-2 ${sub}`}>Скопируйте отладку и отправьте в чат @milkaaasss</p>
        </div>
      )}
            <button
              onClick={async () => {
                try {
                  alert('🧪 Запуск теста индексации Firestore...');
                  await testFirestoreIndexError();
                  alert('✅ Тест индексации завершён! Подробности в консоли.');
                } catch (e) {
                  alert(`❌ Ошибка теста индексации: ${e}`);
                }
              }}
              className="py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all bg-red-500 hover:bg-red-600 text-white"
            >
              🔥 Firestore Index Error Test
            </button>

    </div>
  );
};

// ── Admin Panel ───────────────────────────────────────────────────
interface AdminPanelProps {
  data: ScheduleData;
  onClose: () => void;
  lastSync?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEmployeeUpdate?: (emp: Employee) => void;
  isAdmin?: boolean;
}
const AdminPanel: React.FC<AdminPanelProps> = ({ data, onClose, lastSync, isLoading, error, onRefresh, onEmployeeUpdate, isAdmin = false }) => {
  const { isDark } = useTheme();
  const [activeDept, setActiveDept] = useState<Department | 'all'>('all');

  // state for editing notes via admin panel
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const handler = (e: any) => {
      const empId = e?.detail?.empId;
      if (!empId) return;
      const emp = data.employees.find(x => x.id === empId) || null;
      if (emp) {
        setEditingEmp(emp);
        setNoteText(getEmpNote(emp.id));
      }
    };
    window.addEventListener('open-emp-editor', handler as EventListener);
    return () => window.removeEventListener('open-emp-editor', handler as EventListener);
  }, [data.employees]);

  const lbl  = isDark ? 'text-slate-100' : 'text-gray-900';
  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';

  const filteredEmps = activeDept === 'all'
    ? data.employees
    : data.employees.filter(e => {
        const allRoles = e.roles && e.roles.length > 0 ? e.roles : [e.role];
        return allRoles.some(r => getDepartment(r) === activeDept);
      });

  // Employee list item component (fetches latest employee note from Firestore)
  const EmployeeListItem: React.FC<{ emp: Employee }> = ({ emp }) => {
    const { isDark } = useTheme();
    const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';
    const lbl  = isDark ? 'text-slate-100' : 'text-gray-900';
    const sub  = isDark ? 'text-slate-400' : 'text-gray-500';
    const dept = emp.department ?? getDepartment(emp.role);
    const deptCfg = dept ? DEPARTMENT_CONFIG[dept] : null;
    
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          await fetchEmployeeNotes(emp.id);
          if (!mounted) return;
          // Fetch triggers Firebase logging without storing in local state
        } catch (e) {
          // ignore
        }
      })();
      return () => { mounted = false; };
    }, [emp.id]);

    return (
      <div className={`rounded-2xl border p-3 flex items-center gap-3 ${card}`}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: emp.color }}>
          {emp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${lbl}`}>{emp.name}</p>
          <p className={`text-xs truncate ${sub}`}>{emp.roles && emp.roles.length > 1 ? emp.roles.join(' / ') : emp.role}</p>
          {deptCfg && <span className="text-[10px] font-semibold" style={{ color: deptCfg.color }}>{deptCfg.icon} {deptCfg.label}</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // open editor via DOM event: set editingEmp in parent by dispatching custom event
              const ev = new CustomEvent('open-emp-editor', { detail: { empId: emp.id } });
              window.dispatchEvent(ev as any);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all active:scale-95 ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            title="Редактировать примечание"
          >✏️</button>
          <button
            onClick={() => {
              if (window.confirm('Разорвать все сессии Telegram для этого сотрудника?')) {
                clearTgLinksForEmp(emp.id);
                window.alert('Готово. Сотрудник будет выведен со всех аккаунтов.');
              }
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all active:scale-95 ${isDark ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
            title="Выйти из всех сессий"
          >🚪</button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: isDark ? '#0f172a' : '#f1f5f9' }}>
      <div className={`flex items-center gap-3 px-4 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <button onClick={onClose} className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90 ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>←</button>
        <div className="flex-1">
          <h2 className={`font-bold text-base ${lbl}`}>👥 Сотрудники</h2>
          <p className={`text-xs ${sub}`}>Список всех сотрудников из графика</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
          {!isLoading && !error && lastSync && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
          {!isLoading && error && <div className="w-2 h-2 bg-red-400 rounded-full" />}
          {onRefresh && !isLoading && (
            <button onClick={onRefresh} className="text-indigo-500 text-xs font-semibold active:scale-95">↻</button>
          )}
          {/* rules button for admins */}
          <button
            onClick={() => window.alert('📄 Правила сотрудников')}
            title="Правила"
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg active:scale-95"
          >📄</button>
        </div>
      </div>

      {(lastSync || error) && (
        <div className={`px-4 py-2 text-xs border-b ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
          {error ? `❌ ${error}` : `✅ Синхронизировано: ${new Date(lastSync!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}

      <div className={`px-4 py-3 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { id: 'all', label: 'Все', icon: '👥' },
            ...DEPT_ORDER.map(d => ({ id: d, label: DEPARTMENT_CONFIG[d].label, icon: DEPARTMENT_CONFIG[d].icon })),
          ] as { id: Department | 'all'; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveDept(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                activeDept === tab.id
                  ? 'bg-indigo-500 text-white'
                  : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-gray-100 text-gray-500'
              }`}
            >{tab.icon} {tab.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filteredEmps.map(emp => (
          <EmployeeListItem key={emp.id} emp={emp} />
        ))}
      </div>

      {/* модалка редактирования примечания */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditingEmp(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-md rounded-t-3xl shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
            </div>
            <div className={`px-5 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
                    ⚙️ Настройки сотрудника
                  </p>
                  <h2 className={`text-lg font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{editingEmp.name}</h2>
                </div>
                <button onClick={() => setEditingEmp(null)} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>×</button>
              </div>
              <div className="flex gap-2">
                {/* Кнопка удаления заметок только для админов и только на вкладке заметки */}
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!editingEmp) return;
                      if (!window.confirm('Удалить все старые заметки этого сотрудника?')) return;
                      try {
                        const { deleteEmployeeNotes } = await import('../utils/firebase');
                        await deleteEmployeeNotes(editingEmp.id);
                        // Clear cached note locally as well
                        saveEmpNote(editingEmp.id, '');
                        setNoteText('');
                        alert('✅ Все заметки сотрудника удалены из Firebase');
                      } catch (err) {
                        alert('❌ Ошибка при удалении заметок: ' + (err instanceof Error ? err.message : 'Unknown error'));
                      }
                    }}
                    className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-semibold transition-all bg-red-500 text-white hover:bg-red-600 active:scale-95`}
                    style={{ minWidth: 0 }}
                    title="Удалить все заметки сотрудника"
                  >🗑️ Удалить заметки</button>
                )}
              </div>
            </div>
            <div className="px-5 py-4">
              <>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  💬 Примечание к сотруднику
                </p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={() => editingEmp && saveEmpNote(editingEmp.id, noteText)}
                  placeholder="Например: работает 0.5 ставки, особые условия..."
                  rows={4}
                  className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}
                />
              </>
            </div>
            <div className={`px-5 pb-6 flex gap-2 border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
              <button
                onClick={() => setEditingEmp(null)}
                className={`flex-1 py-3 rounded-2xl text-sm font-semibold border transition-all active:scale-95 ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (editingEmp) {
                    saveEmpNote(editingEmp.id, noteText);
                    setEditingEmp(null);
                  }
                }}
                className="flex-grow flex-2 py-3 rounded-2xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all active:scale-95"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ── Staff Section ─────────────────────────────────────────────────
interface StaffSectionProps {
  data: ScheduleData;
  today: Date;
  month: number;
  year: number;
  linkedEmpId: string | null;
  isAdmin?: boolean;
}
const StaffSection: React.FC<StaffSectionProps> = ({ data, today, month, year, isAdmin = false }) => {
  const { isDark } = useTheme();
  const [activeDept, setActiveDept]   = useState<Department | 'all'>('all');
  const [friendIds, setFriendIds]     = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_FRIENDS_IDS) || '[]'); } catch { return []; }
  });
  const [search, setSearch]           = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const toggleFriend = (id: string) => {
    setFriendIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(STORAGE_FRIENDS_IDS, JSON.stringify(next));
      return next;
    });
  };

  const filtered = data.employees.filter(emp => {
    if (search && !emp.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeDept === 'all') return true;
    const allRoles = emp.roles && emp.roles.length > 0 ? emp.roles : [emp.role];
    return allRoles.some(r => getDepartment(r) === activeDept);
  });

  const friends    = filtered.filter(e => friendIds.includes(e.id));
  const byDept     = DEPT_ORDER.reduce((acc, d) => {
    acc[d] = filtered.filter(e => {
      const allRoles = e.roles && e.roles.length > 0 ? e.roles : [e.role];
      return allRoles.some(r => getDepartment(r) === d);
    });
    return acc;
  }, {} as Record<Department, Employee[]>);

  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';
  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';

  if (selectedEmp) {
    return (
      <EmployeeCard
        emp={selectedEmp}
        data={data}
        today={today}
        month={month}
        year={year}
        isAdmin={isAdmin}
        isFriend={friendIds.includes(selectedEmp.id)}
        onToggleFriend={toggleFriend}
        onClose={() => setSelectedEmp(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Поиск */}
      <div className={`rounded-2xl border shadow-sm p-3 ${card}`}>
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск сотрудника..."
          className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'}`}
        />
      </div>

      {/* Фильтр */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {([
          { id: 'all', label: 'Все', icon: '👥' },
          ...DEPT_ORDER.map(d => ({ id: d, label: DEPARTMENT_CONFIG[d].label, icon: DEPARTMENT_CONFIG[d].icon })),
        ] as { id: Department | 'all'; label: string; icon: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveDept(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              activeDept === tab.id
                ? 'bg-indigo-500 text-white shadow-sm'
                : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >{tab.icon} {tab.label}</button>
        ))}
      </div>

      {/* Друзья */}
      {friends.length > 0 && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`px-4 py-2.5 border-b ${isDark ? 'border-slate-700 bg-slate-700/50' : 'border-gray-50 bg-amber-50'}`}>
            <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⭐ ДРУЗЬЯ</span>
          </div>
          {friends.map((emp, i) => (
            <EmpRow key={emp.id} emp={emp} isFriend={true} onToggleFriend={toggleFriend}
              onOpen={() => setSelectedEmp(emp)} isLast={i === friends.length - 1} />
          ))}
        </div>
      )}

      {/* По отделам */}
      {DEPT_ORDER.map(dept => {
        const emps = byDept[dept];
        if (!emps || emps.length === 0) return null;
        const cfg = DEPARTMENT_CONFIG[dept];
        return (
          <div key={dept} className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
            <div className={`px-4 py-2.5 border-b ${isDark ? 'border-slate-700' : 'border-gray-50'}`}
              style={{ backgroundColor: cfg.color + '15' }}>
              <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.icon} {cfg.label.toUpperCase()}</span>
            </div>
            {emps.map((emp, i) => (
              <EmpRow key={emp.id + dept} emp={emp} isFriend={friendIds.includes(emp.id)}
                onToggleFriend={toggleFriend} onOpen={() => setSelectedEmp(emp)} isLast={i === emps.length - 1} />
            ))}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className={`rounded-2xl p-8 border text-center ${card}`}>
          <p className="text-3xl mb-2">🔍</p>
          <p className={`text-sm ${sub}`}>Никого не найдено</p>
        </div>
      )}
    </div>
  );
};

// ── Emp Row ───────────────────────────────────────────────────────
interface EmpRowProps {
  emp: Employee; isFriend: boolean;
  onToggleFriend: (id: string) => void;
  onOpen: () => void; isLast: boolean;
}
const EmpRow: React.FC<EmpRowProps> = ({ emp, isFriend, onToggleFriend, onOpen, isLast }) => {
  const { isDark } = useTheme();
  const sub = isDark ? 'text-slate-400' : 'text-gray-500';
  const lbl = isDark ? 'text-slate-100' : 'text-gray-900';
  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-all ${!isLast ? isDark ? 'border-b border-slate-700' : 'border-b border-gray-50' : ''}`}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 cursor-pointer active:scale-95"
        style={{ backgroundColor: emp.color }} onClick={onOpen}
      >
        {emp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className={`text-sm font-semibold truncate ${lbl}`}>{emp.name}</p>
        <p className={`text-xs truncate ${sub}`}>{emp.role}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggleFriend(emp.id); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 flex-shrink-0 ${
          isFriend ? 'bg-amber-100 text-amber-500' : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {isFriend ? '⭐' : '☆'}
      </button>
    </div>
  );
};

// ── ProfileView ───────────────────────────────────────────────────
interface ProfileViewProps {
  data: ScheduleData;
  month: number; year: number;
  fakeDate: Date | null;
  sheetId: string; sheetGid: string;
  sheetsApiKey?: string;
  appsScriptUrl?: string;
  employeeDataScriptUrl?: string;
  onSave: (id: string, gid: string, apiKey?: string, scriptUrl?: string, employeeScriptUrl?: string) => void;
  lastSync: string | null;
  isLoading: boolean;
  onRefresh: (month?: number, year?: number) => void;
  error: string | null;
  onFakeDateChange: (d: Date | null) => void;
  onLinkedEmpChange: (id: string | null) => void;
  onMonthChange?: (month: number, year: number) => void;
  onEmployeeUpdate?: (emp: Employee) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  data, month, year, fakeDate, sheetId, sheetGid, sheetsApiKey = '', appsScriptUrl = '', employeeDataScriptUrl = '',
  onSave, lastSync, isLoading, onRefresh, error,
  onFakeDateChange, onLinkedEmpChange, onMonthChange: _onMonthChange,
  onEmployeeUpdate,
}) => {
  const { isDark } = useTheme();
  const today = fakeDate ?? new Date();

  const [activeSection, setActiveSection] = useState<ProfileSection>('staff');
  const [linkedEmpId, setLinkedEmpId]     = useState<string | null>(() => getLinkedEmpId());
  const [tgName, setTgName]               = useState<string | null>(() => localStorage.getItem(STORAGE_TG_NAME));
  const [isLinking, setIsLinking]         = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const tgUser = getTgUser();
  const tgId   = getTgUserId();
  const isAdmin = tgId !== null && ADMIN_TG_IDS.includes(tgId);

  useEffect(() => { initTelegramApp(); }, []);

  // Автологин через Telegram ID (только при первой загрузке)
  useEffect(() => {
    if (tgId && !linkedEmpId && data.employees.length > 0) {
      const empId = getEmpIdByTgId(tgId);
      if (empId && data.employees.find(e => e.id === empId)) {
        setLinkedEmpId(empId);
        onLinkedEmpChange(empId);
        saveLinkedEmpId(empId);
      }
    }
  }, [tgId]); // Убрали data.employees и linkedEmpId из зависимостей

  const linkedEmp = linkedEmpId ? data.employees.find(e => e.id === linkedEmpId) ?? null : null;
  const dept      = linkedEmp ? (linkedEmp.department ?? getDepartment(linkedEmp.role)) : null;
  const deptCfg   = dept ? DEPARTMENT_CONFIG[dept] : null;

  // Привязка — без каких-либо ограничений
  const handleLinkEmployee = (id: string, name: string) => {
    setLinkedEmpId(id);
    onLinkedEmpChange(id);
    saveLinkedEmpId(id);
    if (tgId) { saveTgLink(tgId, id); syncTgLink(name, tgId); }
    const displayName = tgUser ? getTgFullName(tgUser) : name;
    setTgName(displayName);
    localStorage.setItem(STORAGE_TG_NAME, displayName);
    
    setIsLinking(false);
    setSearchQuery('');
    setSearchResults([]);
  };



  const headerGradient = dept
    ? ({
        bar_manager: 'linear-gradient(135deg,#FFD700,#FFD538)',
        power: 'linear-gradient(135deg,#b45309,#d97706)',
        bar: 'linear-gradient(135deg,#7c3aed,#a855f7)',
        hall: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        kitchen: 'linear-gradient(135deg,#15803d,#22c55e)',
      } as Record<Department, string>)[dept]
    : 'linear-gradient(135deg,#6366f1,#8b5cf6)';

  const sub  = isDark ? 'text-slate-400' : 'text-gray-500';
  const lbl  = isDark ? 'text-slate-100' : 'text-gray-900';
  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';

  const SECTIONS: { id: ProfileSection; label: string; icon: string }[] = [
    { id: 'reports',   label: 'Отчёты',     icon: '📊' },
    { id: 'staff',     label: 'Сотрудники', icon: '👥' },
    { id: 'settings',  label: 'Настройки',  icon: '⚙️' },
    { id: 'bugreport', label: 'Баг-репорт', icon: '🐛' },
  ];

  // ── Экран привязки ──
  if (!linkedEmp || isLinking) {
    return (
      <div className="space-y-4 pb-6">
        {/* Шапка */}
        <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <div className="flex items-center gap-3 mb-3">
            {tgUser?.photo_url ? (
              <img src={tgUser.photo_url} alt="" className="w-14 h-14 rounded-2xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                {tgUser ? (tgUser.first_name[0] + (tgUser.last_name?.[0] ?? '')).toUpperCase() : '👤'}
              </div>
            )}
            <div>
              <h2 className="font-bold text-lg leading-tight">
                {tgUser ? getTgFullName(tgUser) : 'Мой профиль'}
              </h2>
              {tgUser?.username && <p className="text-white/60 text-sm">@{tgUser.username}</p>}
              {tgId && <p className="text-white/40 text-xs">ID: {tgId}</p>}
            </div>
          </div>
          <p className="text-white/70 text-sm">Найди себя в списке сотрудников чтобы начать</p>
        </div>

        {/* Поиск */}
        <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
          <h3 className={`font-bold text-sm mb-1 ${lbl}`}>🔍 Найди себя в графике</h3>
          <p className={`text-xs mb-3 ${sub}`}>Введи своё имя или фамилию</p>
          <input
            type="text" value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSearchResults(findMatchingEmployees(data, e.target.value));
            }}
            placeholder="Иванов Иван..."
            className={`w-full text-sm border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'}`}
          />
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map(emp => {
                const empDept = emp.department ? DEPARTMENT_CONFIG[emp.department] : null;
                return (
                  <button key={emp.id} onClick={() => handleLinkEmployee(emp.id, emp.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${isDark ? 'bg-slate-700 border-slate-600 hover:border-indigo-500' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: emp.color }}>
                      {emp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-semibold text-sm ${lbl}`}>{emp.name}</p>
                      <p className={`text-xs ${sub}`}>{emp.role}</p>
                    </div>
                    {empDept && <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: empDept.color, backgroundColor: empDept.color + '20' }}>{empDept.icon} {empDept.label}</span>}
                    <span className={`text-sm ${sub}`}>›</span>
                  </button>
                );
              })}
            </div>
          )}
          {searchQuery.length > 1 && searchResults.length === 0 && (
            <p className={`text-xs mt-3 text-center ${sub}`}>Никого не найдено. Проверь написание имени.</p>
          )}
        </div>

        {/* Настройки доступны без привязки */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <button
            onClick={() => setActiveSection(activeSection === 'settings' ? 'staff' : 'settings')}
            className={`w-full flex items-center justify-between px-4 py-3.5 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>⚙️</div>
              <span className={`font-semibold text-sm ${lbl}`}>Настройки</span>
            </div>
            <span className={`text-sm ${sub}`}>{activeSection === 'settings' ? '▲' : '▼'}</span>
          </button>
          {activeSection === 'settings' && (
            <div className="px-4 pt-2">
              <SettingsSection
                sheetId={sheetId} sheetGid={sheetGid}
                sheetsApiKey={sheetsApiKey}
                appsScriptUrl={appsScriptUrl}
                employeeDataScriptUrl={employeeDataScriptUrl}
                onSave={onSave} lastSync={lastSync}
                isLoading={isLoading} onRefresh={onRefresh}
                error={error} fakeDate={fakeDate}
                onFakeDateChange={onFakeDateChange}
                isAdmin={isAdmin}
                onOpenAdminPanel={() => setShowAdminPanel(true)}
                linkedEmp={null}
                tgUser={tgUser}
                tgId={tgId}
                onEmployeeUpdate={onEmployeeUpdate}
              />
            </div>
          )}
        </div>

        {isLinking && linkedEmpId && (
          <button onClick={() => setIsLinking(false)} className={`w-full py-3 rounded-2xl font-semibold text-sm border transition-all active:scale-95 ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>← Отмена</button>
        )}
      </div>
    );
  }

  // ── Основной профиль ──
  return (
    <div className="w-full space-y-4 pb-6">
      {/* Шапка */}
      <div className="rounded-3xl overflow-hidden shadow-lg">
        <div className="p-5 text-white" style={{ background: headerGradient }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {tgUser?.photo_url ? (
                <div className="relative">
                  <img src={tgUser.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-extrabold shadow-inner">
                  {linkedEmp.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                </div>
              )}
              <div>
                <h2 className="font-extrabold text-xl leading-tight">{tgName ?? linkedEmp.name}</h2>
                {tgName && tgName !== linkedEmp.name && <p className="text-white/60 text-xs">{linkedEmp.name}</p>}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {deptCfg && <span className="text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">{deptCfg.icon} {deptCfg.label}</span>}
                  <span className="text-xs bg-white/10 rounded-full px-2 py-0.5">{linkedEmp.role}</span>
                </div>
              </div>
            </div>
            {isAdmin && <button onClick={() => setIsLinking(true)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white/70 text-sm active:scale-95">✎</button>}
          </div>
        </div>
      </div>

      {/* Навигация — горизонтальная сетка */}
      <div className="grid grid-cols-4 gap-2">
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95 ${
              activeSection === sec.id
                ? 'bg-indigo-500 border-indigo-500 shadow-md'
                : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
            }`}
          >
            <span className="text-xl">{sec.icon}</span>
            <span className={`text-[10px] font-semibold text-center leading-tight ${
              activeSection === sec.id ? 'text-white' : isDark ? 'text-slate-300' : 'text-gray-600'
            }`}>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* Контент */}
      {activeSection === 'reports' && (
        <ReportsSection data={data} linkedEmpId={linkedEmpId} onRefresh={onRefresh} />
      )}

      {activeSection === 'staff' && (
        <StaffSection data={data} today={today} month={month} year={year} linkedEmpId={linkedEmpId} />
      )}

      {activeSection === 'settings' && (
        <SettingsSection
          sheetId={sheetId} sheetGid={sheetGid}
          sheetsApiKey={sheetsApiKey}
          appsScriptUrl={appsScriptUrl}
          employeeDataScriptUrl={employeeDataScriptUrl}
          onSave={onSave} lastSync={lastSync}
          isLoading={isLoading} onRefresh={onRefresh}
          error={error} fakeDate={fakeDate}
          onFakeDateChange={onFakeDateChange}
          isAdmin={isAdmin}
          onOpenAdminPanel={() => setShowAdminPanel(true)}
          linkedEmp={linkedEmp}
          tgUser={tgUser}
          tgId={tgId}
          onEmployeeUpdate={onEmployeeUpdate}
        />
      )}

      {showAdminPanel && (
        <AdminPanel
          data={data}
          onClose={() => setShowAdminPanel(false)}
          lastSync={lastSync}
          isLoading={isLoading}
          error={error}
          onRefresh={onRefresh}
          onEmployeeUpdate={onEmployeeUpdate}
          isAdmin={isAdmin}
        />
      )}

      {activeSection === 'bugreport' && (
        <div className={`rounded-2xl p-5 border shadow-sm ${card}`}>
          <div className="text-center mb-5">
            <p className="text-4xl mb-2">🐛</p>
            <p className={`font-bold text-base mb-1 ${lbl}`}>Обратная связь</p>
            <p className={`text-sm ${sub}`}>Нашёл ошибку или есть идея? Напиши нам!</p>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href="https://t.me/silaysilaysilay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              <span className="text-2xl">🐞</span>
              <div className="flex-1 text-left">
                <p className="text-white font-semibold text-sm">Баги и ошибки</p>
                <p className="text-red-100 text-xs">@silaysilaysilay</p>
              </div>
              <span className="text-white text-lg">→</span>
            </a>
            <a
              href="https://t.me/milkaaasss"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 transition-colors"
            >
              <span className="text-2xl">💡</span>
              <div className="flex-1 text-left">
                <p className="text-white font-semibold text-sm">Идеи и предложения</p>
                <p className="text-indigo-100 text-xs">@milkaaasss</p>
              </div>
              <span className="text-white text-lg">→</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
