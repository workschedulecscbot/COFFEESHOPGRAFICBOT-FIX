// Типы смен: С = сутки (24ч), Д = дневная, Н = ночная, О = выходной
export type ShiftType = 'daily' | 'day' | 'night' | 'off' | 'vacation' | 'sick';

export interface ShiftConfig {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  time?: string;
}

export const SHIFT_CONFIG: Record<ShiftType, ShiftConfig> = {
  daily: {
    label: 'Сутки',
    shortLabel: 'С',
    color: '#7c3aed',
    bgColor: 'bg-violet-100',
    borderColor: 'border-violet-400',
    textColor: 'text-violet-700',
    icon: '🔄',
    time: '08:00–08:00',
  },
  day: {
    label: 'День',
    shortLabel: 'Д',
    color: '#2563eb',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-700',
    icon: '☀️',
    time: '08:00–20:00',
  },
  night: {
    label: 'Ночь',
    shortLabel: 'Н',
    color: '#4338ca',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-400',
    textColor: 'text-indigo-700',
    icon: '🌙',
    time: '20:00–08:00',
  },
  off: {
    label: 'Выходной',
    shortLabel: '—',
    color: '#9ca3af',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-400',
    icon: '🏖️',
  },
  vacation: {
    label: 'Отпуск',
    shortLabel: 'ОТ',
    color: '#059669',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-400',
    textColor: 'text-emerald-700',
    icon: '✈️',
  },
  sick: {
    label: 'Больничный',
    shortLabel: 'Б',
    color: '#dc2626',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-400',
    textColor: 'text-red-700',
    icon: '🤒',
  },
};

// ======== Отделы ========
export type Department = 'bar_manager' | 'power' | 'bar' | 'hall' | 'kitchen';

export interface DepartmentConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  textColor: string;
  roles: string[]; // роли которые входят в этот отдел (lower case)
}

export const DEPARTMENT_CONFIG: Record<Department, DepartmentConfig> = {
  bar_manager: {
    label: 'Бар-менеджер',
    icon: '⭐',
    color: '#FFD700', // ярко-золотой
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    roles: ['бар-менеджер', 'барменеджер', 'bar-manager', 'bar manager', 'бармен менеджер', 'менеджер бара'],
  },
  power: {
    label: 'Менеджер',
    icon: '👑',
    color: '#b45309',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    // Точные названия должностей для этого отдела
    roles: ['менеджер', 'управляющий', 'старший менеджер'],
  },
  bar: {
    label: 'Бар',
    icon: '🍹',
    color: '#7c3aed',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-800',
    // Важно: «бармен» идёт после «барменеджер» в power, здесь точные совпадения
    roles: ['бармен ст.', 'бармен ст', 'старший бармен', 'бармен'],
  },
  hall: {
    label: 'Зал',
    icon: '🍽️',
    color: '#0369a1',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-800',
    roles: ['официант ст.', 'официант ст', 'старший официант', 'официант'],
  },
  kitchen: {
    label: 'Кухня',
    icon: '🍳',
    color: '#15803d',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    roles: [
      'су-шеф', 'шеф-повар', 'шеф', 'повар', 'помощник повара',
      'посудомойщик', 'кухонный работник', 'кухня',
      'тех.персонал', 'тех. персонал', 'тех.перс', 'тех. перс', 'техперс',
      'техперсонал', 'технический персонал', 'тех перс', 'тех.перс.',
      'уборщик', 'уборщица', 'клинер', 'мойщик', 'мойщица',
    ],
  },
};

/** Определяет отдел сотрудника по его должности */
export function getDepartment(role: string): Department | null {
  const normalized = role.toLowerCase().trim();

  // Порядок проверки важен: сначала более специфичные (барменеджер → bar_manager, бармен → bar)
  const ORDER: Department[] = ['bar_manager', 'power', 'bar', 'hall', 'kitchen'];

  // 1. Точное совпадение с любым из roles
  for (const dept of ORDER) {
    const cfg = DEPARTMENT_CONFIG[dept];
    for (const r of cfg.roles) {
      if (normalized === r) return dept;
    }
  }

  // 2. normalized содержит точное слово из roles (word boundary через пробел/начало/конец)
  for (const dept of ORDER) {
    const cfg = DEPARTMENT_CONFIG[dept];
    for (const r of cfg.roles) {
      // Проверяем что в строке должности встречается ровно этот токен
      // используем регулярку с границами слова (кириллица)
      const escaped = r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s,/])${escaped}($|[\\s,/.])`, 'i');
      if (regex.test(normalized) || normalized === r) return dept;
    }
  }

  // 3. Специальные паттерны через includes (для сокращений вроде "тех.перс")
  if (normalized.startsWith('тех') || normalized.includes('техн') || normalized.includes('уборщ') || normalized.includes('клинер') || normalized.includes('мойщ')) {
    return 'kitchen';
  }

  return null;
}

export interface Employee {
  id: string;
  name: string;
  role: string;       // основная должность (из колонки B)
  roles?: string[];   // может быть несколько должностей в зависимости от дня
  color: string;
  rowIndex: number;   // номер строки в таблице (для отладки)
  department?: Department | null;
  showTelegram?: boolean;  // показывать ли кнопку Telegram на странице сотрудника
  birthday?: string;       // день рождения в формате MM-DD (без года)
  tgUsername?: string;     // @username в Telegram
  customUsername?: string; // вручную введённый @username
}

export interface MultipleShift {
  dept: Department;
  hours: number;
  role?: string;  // роль для этого отдела (например, "Повар" для kitchen)
}

export interface ShiftWithTime {
  role: string;        // должность "Бармен"
  dept: Department;    // отдел "bar"  
  startTime: string;   // "12:00"
  endTime: string;     // "15:00"
}

export interface ShiftEntry {
  employeeId: string;
  date: string;       // ISO yyyy-mm-dd
  shift: ShiftType;
  role?: string;      // должность на конкретный день (если отличается от основной)
  hours?: number;     // необязательное поле — количество часов, если в таблице указано число
  multipleShifts?: MultipleShift[];  // несколько смен в день с часами (например, 3ч бар + 2ч кухня)
  shiftsWithTimes?: ShiftWithTime[];  // несколько смен с временем (например, Бармен 12-15, Повар 15-17)
}

export interface ScheduleData {
  employees: Employee[];
  shifts: ShiftEntry[];
  lastSync: string;
  sheetName?: string;
  month?: number;
  year?: number;
}
