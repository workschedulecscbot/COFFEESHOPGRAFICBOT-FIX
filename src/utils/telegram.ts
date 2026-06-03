// ── Telegram WebApp SDK helpers ──────────────────────────────────

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/** Получить объект Telegram WebApp */
export function getTg(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/** Получить текущего пользователя Telegram */
export function getTgUser(): TelegramUser | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

/** Получить Telegram ID текущего пользователя */
export function getTgUserId(): number | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
}

/** Полное имя пользователя Telegram */
export function getTgFullName(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

/** Инициализировать Telegram WebApp */
export function initTelegramApp() {
  const tg = getTg();
  if (!tg) return;
  tg.ready();
  tg.expand(); // разворачиваем на весь экран
}

/** Открыть чат с пользователем в Telegram */
export function openTelegramChat(username: string) {
  const tg = getTg();
  const url = `https://t.me/${username.replace('@', '')}`;
  if (tg) {
    tg.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}



// ── Синхронизация с Apps Script ──────────────────────────────────

const STORAGE_KEY_SCRIPT = 'ss_apps_script_url';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1CSkgdNoCfExOQxbCQoceInqFubJlGXKW10awXG99ron29IgTJMZeOx6nCseMGqSx/exec';

/** Синхронизировать привязку tgId → empName в Google Sheets (лист Employees) */
export async function syncTgLink(empName: string, tgId: number): Promise<void> {
  const scriptUrl = localStorage.getItem(STORAGE_KEY_SCRIPT) || DEFAULT_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const payload = { action: 'link', empName, tgId: String(tgId) };
    console.log('syncTgLink -> POST', scriptUrl, payload);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = '';
    try { text = await response.text(); } catch (e) { /* ignore */ }
    if (!response.ok) {
      console.error(`❌ syncTgLink ошибка: ${response.status} ${response.statusText}`, text);
    } else {
      console.log(`✅ syncTgLink успешно: ${empName} (${tgId})`, response.status, text);
    }
  } catch (err) {
    console.error('❌ syncTgLink ошибка сети:', err);
  }
}

// ── Привязка Telegram ID ─────────────────────────────────────────

const STORAGE_TG_LINKS = 'sf_tg_links'; // { tgId: empId }

/** Загрузить все привязки tgId → empId */
export function loadTgLinks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_TG_LINKS) || '{}');
  } catch {
    return {};
  }
}

/** Сохранить привязку tgId → empId */
export function saveTgLink(tgId: number, empId: string) {
  const links = loadTgLinks();
  links[String(tgId)] = empId;
  localStorage.setItem(STORAGE_TG_LINKS, JSON.stringify(links));
}

/** Удалить привязку для tgId */
export function removeTgLink(tgId: number) {
  const links = loadTgLinks();
  delete links[String(tgId)];
  localStorage.setItem(STORAGE_TG_LINKS, JSON.stringify(links));
}

/** Найти empId по tgId */
export function getEmpIdByTgId(tgId: number): string | null {
  const links = loadTgLinks();
  return links[String(tgId)] ?? null;
}

// ── Коды приглашений ─────────────────────────────────────────────

const STORAGE_INVITE_CODES = 'sf_invite_codes'; // { code: empId }

// Хардкодные коды администраторов { код → Telegram ID }
// ADM1 = Овчаренко Владимир, ADM2 = Шмакова Милена
export const ADMIN_HARDCODED_CODES: Record<string, number> = {
  'ADM1': 6147055724, // Овчаренко Владимир
  'ADM2': 783948887,  // Шмакова Милена
};

/** Генерировать случайный 6-значный код */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Загрузить все коды */
export function loadInviteCodes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_INVITE_CODES) || '{}');
  } catch {
    return {};
  }
}

/** Сохранить код для сотрудника */
export function saveInviteCode(code: string, empId: string) {
  const codes = loadInviteCodes();
  codes[code.toUpperCase()] = empId;
  localStorage.setItem(STORAGE_INVITE_CODES, JSON.stringify(codes));
}

/** Найти empId по коду */
export function getEmpIdByCode(code: string): string | null {
  const upper = code.toUpperCase().trim();
  // Сначала проверяем хардкодные коды администраторов
  if (upper in ADMIN_HARDCODED_CODES) {
    const tgId = ADMIN_HARDCODED_CODES[upper];
    // Ищем уже привязанный empId для этого tgId
    const existing = getEmpIdByTgId(tgId);
    if (existing) return existing;
    // Возвращаем специальный маркер — empId будет найден по имени в ProfileView
    return `__admin_tgid_${tgId}__`;
  }
  const codes = loadInviteCodes();
  return codes[upper] ?? null;
}

/**
 * Удалить все привязки Telegram ID для заданного сотрудника.
 * Используется для "выхода" сотрудника из всех сессий.
 */
export function clearTgLinksForEmp(empId: string) {
  const links = loadTgLinks();
  let changed = false;
  
  // Найти все tgId привязанные к этому empId
  for (const tg in links) {
    if (links[tg] === empId) {
      delete links[tg];
      changed = true;
    }
  }
  
  if (changed) {
    localStorage.setItem(STORAGE_TG_LINKS, JSON.stringify(links));
    console.log(`[Telegram] Cleared links for employee ${empId}`);
    
    // Синхронизировать с Firebase в фоне (не ждём результат)
    (async () => {
      try {
        const { deleteUserLink, getCurrentUid } = await import('./firebase');
        const uid = getCurrentUid();
        if (uid) {
          await deleteUserLink(uid);
          console.log(`[Telegram] Firebase sync completed for ${uid}`);
        }
      } catch (err) {
        console.warn('[Telegram] Firebase sync not available or failed:', err);
      }
    })();
  }
}

/** Сгенерировать или получить существующий код для сотрудника */
export function getOrCreateCodeForEmp(empId: string): string {
  const codes = loadInviteCodes();
  // Ищем существующий код
  for (const [code, id] of Object.entries(codes)) {
    if (id === empId) return code;
  }
  // Создаём новый
  let newCode = generateInviteCode();
  while (codes[newCode]) newCode = generateInviteCode(); // избегаем коллизий
  saveInviteCode(newCode, empId);
  return newCode;
}
