import { useState, useEffect, useCallback, useRef } from 'react';
import { ShiftsView } from './components/ShiftsView';
import { ProfileView } from './components/ProfileView';
import { useDemoData, parseGoogleSheetsCSV, fetchSheetList, fetchSheetListWithApiKey, fetchEmployeeData, EmployeeData } from './hooks/useGoogleSheets';
import { ScheduleData, Employee } from './types/schedule';
import { getTgUserId } from './utils/telegram';

const ADMIN_TG_IDS = [783948887, 6147055724];
import { getEmpPrefs, getLinkedEmpId, saveLinkedEmpId, cacheEmpPrefs } from './utils/adminEdits';
import { watchEmpPrefs } from './utils/firebase';
import { ThemeProvider, useTheme } from './context/ThemeContext';

type TabId = 'shifts' | 'profile';

const DEFAULT_SHEET_ID = '1n5FzbrDQKp_kYCbCQ6DIMmXMWadwcbl7ccrWAzBJEiY';
const DEFAULT_SHEET_GID = '0';
const STORAGE_KEY_ID              = 'ss_sheet_id';
const STORAGE_KEY_GID             = 'ss_sheet_gid';
const STORAGE_KEY_API             = 'ss_sheets_api_key';
const STORAGE_KEY_SCRIPT          = 'ss_apps_script_url';
const STORAGE_KEY_EMPLOYEE_SCRIPT = 'ss_employee_data_script_url';
const DEFAULT_SCRIPT_URL          = 'https://script.google.com/macros/s/AKfycbz1CSkgdNoCfExOQxbCQoceInqFubJlGXKW10awXG99ron29IgTJMZeOx6nCseMGqSx/exec';
const DEFAULT_EMPLOYEE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxO6IFCD60vNdMMTtI71wOhZoRSopZe_2B9R9JZNwazSNIlVjZSKQBgPbPglLpWqf2O/exec';
const STORAGE_FAKE_DATE           = 'ss_fake_date';

if (!localStorage.getItem(STORAGE_KEY_ID)) {
  localStorage.setItem(STORAGE_KEY_ID, DEFAULT_SHEET_ID);
}
if (!localStorage.getItem(STORAGE_KEY_GID)) {
  localStorage.setItem(STORAGE_KEY_GID, DEFAULT_SHEET_GID);
}

// Кэш данных по месяцам: ключ = "sheetId_month_year"
const dataCache = new Map<string, ScheduleData>();

function AppInner() {
  const { isDark } = useTheme();

  const [activeTab, setActiveTab]   = useState<TabId>(() =>
    getLinkedEmpId() ? 'shifts' : 'profile'
  );
  const [sheetId, setSheetId]       = useState<string>(() => localStorage.getItem(STORAGE_KEY_ID) || DEFAULT_SHEET_ID);
  const [sheetGid, setSheetGid]     = useState<string>(() => localStorage.getItem(STORAGE_KEY_GID) || DEFAULT_SHEET_GID);
  const [sheetsApiKey, setSheetsApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEY_API) || '');
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SCRIPT);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_SCRIPT, DEFAULT_SCRIPT_URL);
      return DEFAULT_SCRIPT_URL;
    }
    return stored;
  });
  const [employeeDataScriptUrl, setEmployeeDataScriptUrl] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_EMPLOYEE_SCRIPT);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_SCRIPT, DEFAULT_EMPLOYEE_SCRIPT_URL);
      return DEFAULT_EMPLOYEE_SCRIPT_URL;
    }
    return stored;
  });
  const [employeeDataMap, setEmployeeDataMap] = useState<Map<string, EmployeeData>>(new Map());
  const employeeDataMapRef = useRef<Map<string, EmployeeData>>(new Map());
  const [isEmployeeDataLoaded, setIsEmployeeDataLoaded] = useState(false);

  // Текущий месяц для просмотра
  const today = new Date();
  const [viewMonth, setViewMonth]   = useState(today.getMonth() + 1);
  const [viewYear, setViewYear]     = useState(today.getFullYear());

  // Карта листов: month_year → gid
  const [sheetMap, setSheetMap]     = useState<Map<string, string>>(new Map());
  const sheetMapLoaded              = useRef(false);

  const [liveData, setLiveData]     = useState<ScheduleData | null>(null);

  const handleUpdateEmployee = useCallback((emp: Employee) => {
    setLiveData(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        employees: prev.employees.map(e => e.id === emp.id ? emp : e),
      };
      return next;
    });
  }, []);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError]   = useState<string | null>(null);
  const [lastSync, setLastSync]     = useState<string | null>(null);

  const [linkedEmpId, setLinkedEmpId] = useState<string | null>(
    () => getLinkedEmpId(),
  );

  // Синхронизировать activeTab с linkedEmpId при загрузке и при изменении
  useEffect(() => {
    if (linkedEmpId) {
      setActiveTab('shifts');
    }
  }, [linkedEmpId]);

  const [fakeDate, setFakeDate] = useState<Date | null>(() => {
    const stored = localStorage.getItem(STORAGE_FAKE_DATE);
    if (stored) { const d = new Date(stored); return isNaN(d.getTime()) ? null : d; }
    return null;
  });

  const handleFakeDateChange = (d: Date | null) => {
    setFakeDate(d);
    if (d) localStorage.setItem(STORAGE_FAKE_DATE, d.toISOString());
    else   localStorage.removeItem(STORAGE_FAKE_DATE);
  };

  const demoData       = useDemoData();
  const effectiveToday = fakeDate ?? new Date();

  const tgId   = getTgUserId();
  const isAdmin = tgId !== null && ADMIN_TG_IDS.includes(tgId);

  // ── Загружаем список листов таблицы ──
  const loadSheetMap = useCallback(async (id: string, apiKey?: string) => {
    if (!id) return;
    try {
      let sheets;
      const key = apiKey ?? sheetsApiKey;
      if (key) {
        // Sheets API v4 — надёжный способ, требует API key
        sheets = await fetchSheetListWithApiKey(id, key);
      } else {
        // Fallback — gviz (публичный, но менее надёжный)
        sheets = await fetchSheetList(id);
      }
      const map = new Map<string, string>();
      for (const s of sheets) {
        if (s.month && s.year) {
          map.set(`${s.month}_${s.year}`, s.gid);
        }
      }
      if (!map.size) {
        map.set(`${today.getMonth() + 1}_${today.getFullYear()}`, DEFAULT_SHEET_GID);
      }
      setSheetMap(map);
      sheetMapLoaded.current = true;
    } catch {
      sheetMapLoaded.current = true;
    }
  }, [sheetsApiKey]);

  // ── Загружаем CSV для конкретного месяца/года ──
  const fetchSheetForMonth = useCallback(async (id: string, month: number, year: number, gidOverride?: string) => {
    if (!id || !month || !year || month < 1 || month > 12) {
      console.error('[App] Invalid parameters:', { id, month, year });
      return;
    }

    const cacheKey = `${id}_${month}_${year}`;
    const gid = gidOverride ?? sheetMap.get(`${month}_${year}`) ?? sheetGid;

    setLiveLoading(true);
    setLiveError(null);
    console.log('[App] Fetching sheet for month:', { id, month, year, gid });

    try {
      // Используем Apps Script если задан — он возвращает нужный лист по имени
      const scriptUrl = localStorage.getItem('ss_apps_script_url') || appsScriptUrl;
      let parsed;

      if (scriptUrl) {
        console.log('[App] Using Apps Script:', scriptUrl);
        // Строим название листа для поиска
        const MONTH_NAMES_RU = ['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
        if (!month || month < 1 || month > 12) {
          throw new Error(`Неверный месяц: ${month}`);
        }
        const sheetName = `${MONTH_NAMES_RU[month].toUpperCase()} ${year}`;
        const url = `${scriptUrl}?sheet=${encodeURIComponent(sheetName)}`;
        console.log('[App] Fetching from Apps Script:', url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('Apps Script вернул HTML — проверь настройки доступа');
        const json = JSON.parse(text);
        if (json.error) throw new Error(json.error);
        if (!json.values || !json.values.length) throw new Error('Нет данных от Apps Script');
        // Передаём массив напрямую — parseGoogleSheetsCSV принимает string[][]
        parsed = parseGoogleSheetsCSV(json.values as string[][]);
        console.log('[App] Apps Script returned:', json.values.length, 'rows');
        // Обновляем карту листов из ответа
        if (json.sheets) {
          setSheetMap(prev => {
            const next = new Map(prev);
            for (const [key, val] of Object.entries(json.sheets as Record<string, {gid: string}>)) {
              next.set(key, val.gid);
            }
            return next;
          });
        }
      } else {
        // Fallback — CSV
        const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
        console.log('[App] Using CSV fallback:', csvUrl);
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Не удалось загрузить таблицу`);
        const text = await res.text();
        if (text.trim().startsWith('<!')) throw new Error('Таблица недоступна. Проверьте доступ (Все с ссылкой)');
        parsed = parseGoogleSheetsCSV(text);
        console.log('[App] CSV fallback returned:', text.split('\n').length, 'rows');
      }

      // Применяем данные сотрудников (Birthday, Telegram, Preferences)
      // Данные с Apps Script применяются по имени, preferences из Firebase применяются по ID
      console.log('[App] 📋 Employee names from schedule:', parsed.employees.map(e => e.name.toLowerCase()).sort());
      const employeesWithData = parsed.employees.map(emp => {
        // 1. Заполняем из Apps Script (birthday, tgUsername)
        const empNameLower = emp.name.toLowerCase();
        const empData = employeeDataMapRef.current.get(empNameLower);
        console.log(`[App] 🔍 Searching for "${emp.name}" (${empNameLower}) in map... Found:`, !!empData);
        if (empData) {
          emp.birthday = empData.birthday || undefined;
          emp.tgUsername = empData.tgUsername || undefined;
          if (empData.birthday) {
            console.log(`[App] 🎂 Applied birthday to ${emp.name}: ${empData.birthday}`);
          }
          if (empData.tgUsername) {
            console.log(`[App] 💬 Applied Telegram to ${emp.name}: @${empData.tgUsername}`);
          }
        } else {
          console.log(`[App] ❌ No data found for "${emp.name}" in employeeDataMap (size: ${employeeDataMapRef.current.size})`);
        }
        
        // 2. Меняем из Firebase emp_prefs (showTelegram, customUsername)
        const empPrefs = getEmpPrefs(emp.id);
        if (empPrefs) {
          emp.showTelegram = empPrefs.showTelegram;
          emp.customUsername = empPrefs.customUsername;
          console.log(`[App] ⚙️ Applied prefs to ${emp.name}: showTelegram=${empPrefs.showTelegram}`);
        }
        
        return emp;
      });
      console.log('[App] 🎂 Employees with birthdays:', parsed.employees.filter(e => e.birthday).map(e => `${e.name} (${e.birthday})`).join(', ') || 'нет');
      console.log('[App] 💬 Employees with Telegram:', parsed.employees.filter(e => e.tgUsername).map(e => `${e.name} (@${e.tgUsername})`).join(', ') || 'нет');
      parsed.employees = employeesWithData;
      dataCache.set(cacheKey, parsed);
      setLiveData(parsed);
      setLastSync(new Date().toISOString());
      console.log('[App] Sheet loaded successfully:', { employees: parsed.employees.length, shifts: parsed.shifts.length });

      // Обновляем gid в sheetMap если парсер определил месяц
      if (parsed.month && parsed.year) {
        setSheetMap(prev => {
          const next = new Map(prev);
          next.set(`${parsed.month}_${parsed.year}`, gid);
          return next;
        });
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Ошибка загрузки';
      console.error('[App] Error fetching sheet:', errorMsg);
      setLiveError(errorMsg);
      // Если кэш есть — используем его
      if (dataCache.has(cacheKey)) {
        console.log('[App] Using cached data for:', cacheKey);
        setLiveData(dataCache.get(cacheKey)!);
      }
    } finally {
      setLiveLoading(false);
    }
  }, [sheetMap, sheetGid, employeeDataMap]);

  // ── При смене месяца — загружаем нужный лист ──
  const handleMonthChange = useCallback((month: number, year: number) => {
    setViewMonth(month);
    setViewYear(year);

    const cacheKey = `${sheetId}_${month}_${year}`;
    if (dataCache.has(cacheKey)) {
      // Есть кэш — сразу показываем
      setLiveData(dataCache.get(cacheKey)!);
      return;
    }
    fetchSheetForMonth(sheetId, month, year);
  }, [sheetId, fetchSheetForMonth]);

  const handleRefresh = useCallback((month?: number, year?: number) => {
    const m = month ?? viewMonth;
    const y = year ?? viewYear;
    fetchSheetForMonth(sheetId, m, y);
  }, [sheetId, viewMonth, viewYear, fetchSheetForMonth]);

  // ── Первичная загрузка — получаем список листов, потом данные текущего месяца ──
  useEffect(() => {
    if (!sheetId || !isEmployeeDataLoaded) return;
    const currentMonth = effectiveToday.getMonth() + 1;
    const currentYear  = effectiveToday.getFullYear();

    const init = async () => {
      // Сначала загружаем список листов
      await loadSheetMap(sheetId);
      // Потом загружаем текущий месяц
      fetchSheetForMonth(sheetId, currentMonth, currentYear);
    };
    init();

    // Автообновление каждую минуту
    const interval = setInterval(() => {
      fetchSheetForMonth(sheetId, viewMonth, viewYear);
    }, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  // ── Загрузка данных сотрудников (Birthday, Telegram) ──
  useEffect(() => {
    if (!employeeDataScriptUrl) {
      console.log('[App] Employee data script URL не установлен');
      return;
    }

    const loadEmployeeData = async () => {
      try {
        const data = await fetchEmployeeData(employeeDataScriptUrl);
        console.log('[App] 🔍 Raw employee data from script:', data);
        const map = new Map<string, EmployeeData>();
        
        for (const emp of data) {
          map.set(emp.name.toLowerCase(), emp);
          if (emp.birthday) {
            console.log(`[App] 📌 Added to map: "${emp.name.toLowerCase()}" => birthday: ${emp.birthday}`);
          }
        }
        
        setEmployeeDataMap(map);
        employeeDataMapRef.current = map;
        console.log('[App] ✅ Loaded data map:', map.size, 'employees');
        console.log('[App] 🔍 Map contents (sample):', Array.from(map.entries()).slice(0, 5));
        console.log('[App] 📋 All employee names in map:', Array.from(map.keys()).sort());
        console.log('[App] 🎂 All birthdays in map:', Array.from(map.values()).filter(e => e.birthday).map(e => `${e.name}: ${e.birthday}`).join(', ') || 'none');
        setIsEmployeeDataLoaded(true);
      } catch (err) {
        console.error('[App] Ошибка загрузки данных сотрудников:', err);
        setIsEmployeeDataLoaded(true); // Даже при ошибке считаем загруженным
      }
    };

    loadEmployeeData();
  }, [employeeDataScriptUrl]);

  // ── Загрузка emp_prefs из Firebase и кэширование ──
  useEffect(() => {
    console.log('[App] Setting up emp_prefs listener...');
    const unsubscribe = watchEmpPrefs((prefs) => {
      console.log('[App] 🔄 emp_prefs updated from Firebase:', prefs.length, 'items');
      // Cache to localStorage for next load
      cacheEmpPrefs(prefs);
    });

    return () => unsubscribe();
  }, []);

  // ── Перезагружаем лист когда employeeDataMap обновится ──
  useEffect(() => {
    if (isEmployeeDataLoaded && sheetId && viewMonth && viewYear) {
      console.log('[App] 📂 employeeDataMap updated, reloading sheet with birthday data...');
      fetchSheetForMonth(sheetId, viewMonth, viewYear);
    }
  }, [isEmployeeDataLoaded, sheetId, viewMonth, viewYear]);


  const handleSaveSettings = (id: string, gid: string, apiKey?: string, scriptUrl?: string, employeeScriptUrl?: string) => {
    const cleanId = id.includes('spreadsheets/d/')
      ? id.split('spreadsheets/d/')[1].split('/')[0]
      : id.trim();
    setSheetId(cleanId);
    setSheetGid(gid);
    localStorage.setItem(STORAGE_KEY_ID, cleanId);
    localStorage.setItem(STORAGE_KEY_GID, gid);
      if (apiKey !== undefined) {
      setSheetsApiKey(apiKey);
      if (apiKey) localStorage.setItem(STORAGE_KEY_API, apiKey);
      else        localStorage.removeItem(STORAGE_KEY_API);
    }
    if (scriptUrl !== undefined) {
      setAppsScriptUrl(scriptUrl);
      if (scriptUrl) localStorage.setItem(STORAGE_KEY_SCRIPT, scriptUrl);
      else           localStorage.removeItem(STORAGE_KEY_SCRIPT);
    }
    if (employeeScriptUrl !== undefined) {
      setEmployeeDataScriptUrl(employeeScriptUrl);
      if (employeeScriptUrl) localStorage.setItem(STORAGE_KEY_EMPLOYEE_SCRIPT, employeeScriptUrl);
      else                   localStorage.removeItem(STORAGE_KEY_EMPLOYEE_SCRIPT);
    }
    // Сбрасываем кэш и карту листов
    dataCache.clear();
    sheetMapLoaded.current = false;
    setSheetMap(new Map());
    // Перезагружаем
    const month = effectiveToday.getMonth() + 1;
    const year  = effectiveToday.getFullYear();
    const key   = apiKey ?? sheetsApiKey;
    loadSheetMap(cleanId, key).then(() => {
      fetchSheetForMonth(cleanId, month, year, gid);
    });
  };

  const scheduleData = liveData ?? demoData;

  // Разрешить вкладку смены для всех (убрать принудительный редирект)
  const effectiveTab = activeTab;



  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'shifts',  label: 'Смены',   icon: '📅' },
    { id: 'profile', label: 'Профиль', icon: '👤' },
  ];

  const bgPage   = isDark ? 'bg-slate-900' : 'bg-slate-100';
  const bgHeader = isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/90 border-gray-100';
  const bgBottom = isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-gray-100';

  return (
    <div className={`min-h-screen flex flex-col max-w-md mx-auto ${bgPage}`}>

      {/* ── Header ── */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b shadow-sm ${bgHeader}`}>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                <span className="text-white text-sm font-bold">C</span>
              </div>
              <div>
                <h1 className={`font-bold text-sm leading-tight ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                  CoffeeShop Company
                </h1>
                <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {liveError ? `❌ ${liveError}` : liveLoading ? '⏳ Синхронизация...' : liveData ? `✓ Загружено (${liveData.employees.length} чел.)` : '📊 Демо данные'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {fakeDate && (
                <div
                  className="flex items-center gap-1 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5 cursor-pointer active:scale-95"
                  onClick={() => setActiveTab('profile')}
                >
                  <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wide">тест</span>
                </div>
              )}
              {liveError && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              {!liveError && liveLoading  && <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
              {!liveError && !liveLoading && liveData  && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
              {!liveError && !liveLoading && !liveData && <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`} />}
              <span className={`text-[10px] ${liveError ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {liveError ? '❌ Ошибка' : liveLoading ? '⏳ Синхр' : liveData ? '✓ Синхр' : '📊 Демо'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {liveError && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <p className="font-semibold mb-1">⚠️ {liveError}</p>
            <p className="text-[11px] text-red-600">
              Показываются демо данные. Проверьте:
              <ul className="mt-1 ml-3 list-disc space-y-0.5">
                <li>ID таблицы в настройках</li>
                <li>Доступность Google Sheets</li>
                <li>Apps Script URL (если указан)</li>
              </ul>
            </p>
          </div>
        )}
        {effectiveTab === 'shifts' && (
          <ShiftsView
            data={scheduleData}
            fakeDate={fakeDate}
            linkedEmpId={linkedEmpId}
            isAdmin={isAdmin}
            onMonthChange={handleMonthChange}
          />
        )}
        {effectiveTab === 'profile' && (
          <ProfileView
            data={scheduleData}
            month={viewMonth}
            year={viewYear}
            fakeDate={fakeDate}
            sheetId={sheetId}
            sheetGid={sheetGid}
            onSave={handleSaveSettings}
            lastSync={lastSync}
            isLoading={liveLoading}
            onRefresh={handleRefresh}
            error={liveError}
            onFakeDateChange={handleFakeDateChange}
            onLinkedEmpChange={(id) => {
              setLinkedEmpId(id);
              saveLinkedEmpId(id);
              // Не переводим автоматически на shifts — пусть пользователь сам выберет
            }}
            onMonthChange={handleMonthChange}
            sheetsApiKey={sheetsApiKey}
            appsScriptUrl={appsScriptUrl}
            employeeDataScriptUrl={employeeDataScriptUrl}
            onEmployeeUpdate={handleUpdateEmployee}
          />
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md backdrop-blur-md border-t z-30 shadow-lg ${bgBottom}`}>
        <div className="flex">
          {TABS.map(tab => {
            // Вкладка смены теперь всегда доступна
            const isActive = effectiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-all relative ${
                  'active:scale-95'
                } ${isActive ? 'text-indigo-500' : isDark ? 'text-slate-500' : 'text-gray-400'}`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className={`text-[9px] font-semibold leading-tight ${
                  isActive ? 'text-indigo-500' : isDark ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-500 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Fake date banner ── */}
      {fakeDate && effectiveTab === 'shifts' && (
        <div
          className="fixed bottom-20 z-20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all text-xs font-semibold px-4 py-2 rounded-full shadow-lg left-1/2 -translate-x-1/2 bg-amber-400 text-white"
          onClick={() => setActiveTab('profile')}
        >
          <span>🗓</span>
          <span>Тест: {fakeDate.getDate()}.{String(fakeDate.getMonth()+1).padStart(2,'0')}.{fakeDate.getFullYear()} →</span>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
