import React, { useState } from 'react';
import { SHIFT_CONFIG, ShiftType } from '../types/schedule';
import { useTheme } from '../context/ThemeContext';

interface SettingsViewProps {
  sheetId: string;
  sheetGid: string;
  onSave: (sheetId: string, sheetGid: string) => void;
  lastSync: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  error: string | null;
  fakeDate: Date | null;
  onFakeDateChange: (d: Date | null) => void;
}

function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  sheetId,
  sheetGid,
  onSave,
  lastSync,
  isLoading,
  onRefresh,
  error,
  fakeDate,
  onFakeDateChange,
}) => {
  const { theme, setTheme, isDark } = useTheme();

  const [localSheetId, setLocalSheetId] = useState(sheetId);
  const [localGid, setLocalGid] = useState(sheetGid);
  const [saved, setSaved] = useState(false);
  const [fakeDateEnabled, setFakeDateEnabled] = useState(fakeDate !== null);
  const [fakeDateInput, setFakeDateInput] = useState<string>(
    fakeDate ? toInputValue(fakeDate) : toInputValue(new Date())
  );

  const card = isDark
    ? 'bg-slate-800 border-slate-700 shadow-slate-900/50'
    : 'bg-white border-gray-100';

  const label = isDark ? 'text-slate-200' : 'text-gray-800';
  const sublabel = isDark ? 'text-slate-400' : 'text-gray-400';
  const inputCls = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500 focus:ring-indigo-500'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-300 focus:ring-indigo-400';

  const handleSave = () => {
    onSave(localSheetId.trim(), localGid.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const extractSheetId = (input: string) => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    return input;
  };

  const handlePaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSheetId(extractSheetId(e.target.value));
  };

  const handleFakeDateToggle = (enabled: boolean) => {
    setFakeDateEnabled(enabled);
    if (enabled) {
      const d = new Date(fakeDateInput);
      if (!isNaN(d.getTime())) onFakeDateChange(d);
    } else {
      onFakeDateChange(null);
    }
  };

  const handleFakeDateInput = (val: string) => {
    setFakeDateInput(val);
    if (fakeDateEnabled) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) onFakeDateChange(d);
    }
  };

  const formatSyncTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const shiftTypes: ShiftType[] = ['daily', 'day', 'night', 'vacation', 'sick'];

  const fakeDateDisplay = (() => {
    if (!fakeDate) return null;
    return `${fakeDate.getDate()} ${MONTHS_RU[fakeDate.getMonth()]} ${fakeDate.getFullYear()}`;
  })();

  return (
    <div className="w-full space-y-4">
      {/* Заголовок */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-3xl p-5 text-white shadow-lg">
        <h2 className="text-lg font-bold">⚙️ Настройки</h2>
        <p className="text-slate-400 text-sm mt-1">Подключение и отладка</p>
      </div>

      {/* ─── Тема ──────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
        <h3 className={`font-semibold text-sm mb-3 flex items-center gap-1.5 ${label}`}>
          <span>{isDark ? '🌙' : '☀️'}</span> Тема оформления
        </h3>
        <div className="flex gap-2">
          {/* Светлая */}
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all active:scale-95 ${
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                : isDark ? 'border-slate-600 bg-slate-700' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <span className="text-xl">☀️</span>
            </div>
            <span className={`text-xs font-semibold ${theme === 'light' ? 'text-indigo-600' : isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Светлая
            </span>
            {theme === 'light' && (
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            )}
          </button>

          {/* Тёмная */}
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all active:scale-95 ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-900/30'
                : isDark ? 'border-slate-600 bg-slate-700' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-sm">
              <span className="text-xl">🌙</span>
            </div>
            <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-indigo-400' : isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Тёмная
            </span>
            {theme === 'dark' && (
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* ─── Fake Date ─────────────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border space-y-3 ${card}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-sm flex items-center gap-1.5 ${label}`}>
              <span>🗓</span> Тестовая дата
            </h3>
            <p className={`text-xs mt-0.5 ${sublabel}`}>Эмулировать «сегодня» для отладки</p>
          </div>
          <button
            onClick={() => handleFakeDateToggle(!fakeDateEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              fakeDateEnabled ? 'bg-amber-500' : isDark ? 'bg-slate-600' : 'bg-gray-200'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              fakeDateEnabled ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {fakeDateEnabled && (
          <div className="space-y-2">
            <input
              type="date"
              value={fakeDateInput}
              onChange={e => handleFakeDateInput(e.target.value)}
              className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-slate-700 border-amber-700/50 text-slate-100 focus:ring-amber-500'
                  : 'bg-amber-50 border-amber-200 text-gray-800 focus:ring-amber-400'
              }`}
            />
            {fakeDateDisplay && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                isDark ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'
              }`}>
                <span className="text-amber-500 text-base">⚠️</span>
                <div>
                  <p className="text-xs font-semibold text-amber-600">Активна тестовая дата</p>
                  <p className="text-xs text-amber-500">{fakeDateDisplay}</p>
                </div>
                <button
                  onClick={() => handleFakeDateToggle(false)}
                  className="ml-auto text-amber-400 hover:text-amber-600 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {!fakeDateEnabled && (
          <p className={`text-xs ${sublabel}`}>
            Сейчас используется реальная дата:{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              {new Date().getDate()} {MONTHS_RU[new Date().getMonth()]} {new Date().getFullYear()}
            </span>
          </p>
        )}
      </div>

      {/* ─── Подключение к таблице ─────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border space-y-4 ${card}`}>
        <h3 className={`font-semibold text-sm ${label}`}>🔗 Подключение к Google Таблице</h3>

        <div>
          <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${sublabel}`}>
            ID таблицы или ссылка
          </label>
          <input
            type="text"
            value={localSheetId}
            onChange={handlePaste}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 ${inputCls}`}
          />
          <p className={`text-[11px] mt-1.5 ${sublabel}`}>
            Вставьте полную ссылку — ID извлечётся автоматически
          </p>
        </div>

        <div>
          <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${sublabel}`}>
            GID листа (необязательно)
          </label>
          <input
            type="text"
            value={localGid}
            onChange={e => setLocalGid(e.target.value)}
            placeholder="0"
            className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 ${inputCls}`}
          />
          <p className={`text-[11px] mt-1.5 ${sublabel}`}>
            Найдите <code className={`px-1 rounded text-[10px] ${isDark ? 'bg-slate-600' : 'bg-gray-100'}`}>gid=</code> в URL нужного листа
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {saved ? '✓ Сохранено!' : 'Сохранить и подключить'}
        </button>
      </div>

      {/* ─── Статус синхронизации ──────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-semibold text-sm ${label}`}>Статус синхронизации</h3>
          <button
            onClick={onRefresh}
            disabled={isLoading || !sheetId}
            className="text-xs text-indigo-500 font-semibold disabled:opacity-40 flex items-center gap-1 active:scale-95"
          >
            <span className={`text-base leading-none ${isLoading ? 'animate-spin inline-block' : ''}`}>↻</span>
            Обновить
          </button>
        </div>

        {error ? (
          <div className={`flex items-start gap-2 rounded-xl p-3 border ${
            isDark ? 'bg-red-900/20 border-red-800/40' : 'bg-red-50 border-red-100'
          }`}>
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="text-xs font-semibold text-red-500">Ошибка загрузки</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
              <p className={`text-xs mt-1.5 ${sublabel}`}>
                Убедитесь, что таблица открыта для просмотра всем с ссылкой.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              isLoading ? 'bg-amber-400 animate-pulse' :
              lastSync ? 'bg-emerald-400' : 'bg-gray-300'
            }`} />
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              {isLoading
                ? 'Синхронизация...'
                : lastSync
                  ? `Обновлено в ${formatSyncTime(lastSync)}`
                  : 'Ожидание подключения...'}
            </span>
          </div>
        )}
        <p className={`text-[11px] mt-2 ${sublabel}`}>🔄 Авто-обновление каждые 60 секунд</p>
      </div>

      {/* ─── Как подключить ────────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
        <h3 className={`font-semibold text-sm mb-3 ${label}`}>📋 Как подключить таблицу</h3>
        <ol className="space-y-3">
          {[
            'Откройте таблицу Google Sheets с графиком',
            'Нажмите «Поделиться» → «Открыть доступ» → выберите «Просматривающий» для всех с ссылкой',
            'Скопируйте ссылку и вставьте выше',
            'Нажмите «Сохранить и подключить»',
          ].map((step, i) => (
            <li key={i} className={`flex gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {i + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ─── Структура таблицы ─────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
        <h3 className={`font-semibold text-sm mb-1 ${label}`}>📊 Структура таблицы</h3>
        <p className={`text-xs mb-3 ${sublabel}`}>График должен соответствовать формату:</p>
        <div className={`rounded-xl p-3 text-xs font-mono space-y-1 border ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-gray-50 border-gray-100 text-gray-600'
        }`}>
          <div className={`font-sans font-semibold text-[10px] uppercase tracking-wide mb-2 ${sublabel}`}>Структура CSV:</div>
          <div><span className="text-indigo-400">C1+</span>: Числа месяца (1, 2, 3 ... 31)</div>
          <div><span className="text-indigo-400">A6:A62</span>: Имена сотрудников</div>
          <div><span className="text-indigo-400">B6:B62</span>: Должности сотрудников</div>
          <div><span className="text-indigo-400">C6+</span>: Смены (С / Д / Н)</div>
          <div className="text-amber-500 mt-2 font-sans text-[11px]">
            ⚠ Строки 9,10,11,27,28,29,43,53,56 — разделители
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className={`text-xs font-semibold uppercase tracking-wide ${sublabel}`}>Должности → Отдел:</p>
          {[
            { dept: '👑 Власть', roles: 'Менеджер, Барменеджер' },
            { dept: '🍹 Бар', roles: 'Бармен, Бармен ст.' },
            { dept: '🍽️ Зал', roles: 'Официант, Официант ст.' },
            { dept: '🍳 Кухня', roles: 'Повар, Тех.персонал, ...' },
          ].map(({ dept, roles }) => (
            <div key={dept} className="flex items-start gap-2 text-xs">
              <span className={`font-semibold w-20 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{dept}</span>
              <span className={sublabel}>{roles}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Обозначения смен ──────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${card}`}>
        <h3 className={`font-semibold text-sm mb-3 ${label}`}>🏷 Обозначения смен в таблице</h3>
        <div className="space-y-2">
          {shiftTypes.map(key => {
            const cfg = SHIFT_CONFIG[key];
            return (
              <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 ${
                isDark ? 'bg-slate-700/50 border-slate-600' : `${cfg.bgColor} ${cfg.borderColor}`
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg ${
                  key === 'daily' ? 'bg-violet-600 text-white' :
                  key === 'day' ? 'bg-blue-500 text-white' :
                  key === 'night' ? 'bg-indigo-800 text-white' :
                  key === 'vacation' ? 'bg-emerald-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {cfg.shortLabel}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : cfg.textColor}`}>
                    {cfg.icon} {cfg.label}
                  </p>
                  {cfg.time && <p className={`text-xs ${sublabel}`}>{cfg.time}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-[11px] font-semibold ${sublabel}`}>В таблице:</p>
                  <p className={`text-sm font-extrabold ${isDark ? 'text-slate-300' : cfg.textColor}`}>
                    {key === 'daily' ? '«С» / «с»' :
                     key === 'day' ? '«Д» / «д»' :
                     key === 'night' ? '«Н» / «н»' :
                     key === 'vacation' ? '«ОТ» / «от»' :
                     '«Б» / «б»'}
                  </p>
                </div>
              </div>
            );
          })}
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 ${
            isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold ${
              isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-400'
            }`}>
              —
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>🏖️ Выходной</p>
            </div>
            <div className="text-right">
              <p className={`text-[11px] font-semibold ${sublabel}`}>В таблице:</p>
              <p className={`text-sm font-extrabold ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>пусто / «-»</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
