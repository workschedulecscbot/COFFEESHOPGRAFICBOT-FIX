# 🤖 СИСТЕМА ПРОМПТ ДЛЯ НЕЙРОСЕТИ

**КОПИРУЙ ВСЁ ЭТО И ОТПРАВЬ НЕЙРОСЕТИ В НАЧАЛЕ ДИАЛОГА**

---

## КОНТЕКСТ И ЗАДАЧА

Ты работаешь с проектом **COFFEESHOPGRAFICBOT** - React приложением для управления графиком смен в кофейне. Твоя роль: писать новые функции, исправлять ошибки, добавлять фичи. Следи за всеми правилами ниже!

---

## 1. АРХИТЕКТУРА ПРОЕКТА

### Стек
- **Frontend:** React 19.2.3 + TypeScript 5.9.3 + Vite 7.2.4 + Tailwind CSS 4.1.17
- **Backend:** Google Apps Script + Firebase Firestore
- **Persistence:** Firebase (облако) + localStorage (кэш)
- **Интеграция:** Telegram WebApp SDK

### Структура папок
```
src/
├── App.tsx                     # Главный компонент (ADMIN_TG_IDS строка 8)
├── main.tsx                    # Инициализация Firebase + React
├── index.css                   # Tailwind стили
├── components/
│   ├── ShiftsView.tsx         # ГЛАВНЫЙ: календарь, DayModal, коллеги
│   ├── TodayView.tsx          # Смены на сегодня
│   ├── MonthView.tsx          # Календарь месяца
│   ├── WeekView.tsx           # Сетка недели
│   ├── ProfileView.tsx        # Профиль (ADMIN_TG_IDS строка 21)
│   ├── StaffView.tsx          # Список сотрудников
│   ├── EmployeeCard.tsx       # Карточка сотрудника
│   ├── ShiftBadge.tsx         # Badge смены
│   ├── Avatar.tsx             # Аватар
│   ├── ReportsSection.tsx     # Отчеты
│   └── SettingsView.tsx       # Настройки
├── context/
│   └── ThemeContext.tsx       # Тема (light/dark)
├── hooks/
│   └── useGoogleSheets.ts    # ⭐ ПАРСЕР CSV → ScheduleData
├── types/
│   └── schedule.ts           # Типы данных
└── utils/
    ├── firebase.ts           # Firestore CRUD операции
    ├── adminEdits.ts         # Правка смен и заметок
    ├── telegram.ts           # Telegram SDK + Bot sync
    └── cn.ts                 # Утилита для className
```

---

## 2. ГЛАВНОЕ ПРАВИЛО - DUAL-SHIFT СИСТЕМА ⭐

**САМОЕ ВАЖНОЕ! Один сотрудник может иметь НЕСКОЛЬКО разных смен в один день!**

Пример: сотрудник работает день 09:00-20:00 И ночь 20:00-09:00 в один день.

### Структура данных ShiftEntry
```typescript
{
  shift: 'day',                    // ← доминирующая смена (для старого кода)
  shifts: ['day', 'night'],        // ← ВСЕ смены! ВСЕГДА ЧИТАЙ ЭТО!
  shiftRoles: {
    'day': 'Бармен',              // роль для дневной смены
    'night': 'Повар'              // роль для ночной смены
  }
}
```

### ПРАВИЛО 1: Всегда читай shifts[], не только shift
```typescript
// ❌ НЕПРАВИЛЬНО - упустишь вторую смену!
if (entry.shift === 'day') { 
  renderDay(); 
}

// ✅ ПРАВИЛЬНО - покажешь обе смены
entry.shifts?.forEach(shiftType => {
  if (shiftType === 'day') renderDay();
  if (shiftType === 'night') renderNight();
});
```

### ПРАВИЛО 2: Используй shiftRoles для определения отдела
```typescript
// ❌ НЕПРАВИЛЬНО - покажешь отдел первой смены для обеих
const dept = getDepartment(entry.shiftRoles?.[0]);

// ✅ ПРАВИЛЬНО - правильный отдел для каждой смены
entry.shifts?.forEach(shiftType => {
  const role = entry.shiftRoles?.[shiftType];
  const dept = getDepartment(role);
  // отрисуй с правильным цветом отдела
});
```

### Типы смен (ShiftType)
```typescript
type ShiftType = 'daily' | 'day' | 'night' | 'off' | 'vacation' | 'sick';

'daily'    = Сутки 09:00-09:00 (специальный формат)
'day'      = День 09:00-20:00
'night'    = Ночь 20:00-09:00
'off'      = Выходной
'vacation' = Отпуск
'sick'     = Больничный
```

---

## 3. КРИТИЧЕСКИЕ КОНФИГИ (ЗАПОМНИ!)

### АДМИНИСТРАТОРЫ (7 штук) - ВСЕ РАЗОМ!
🔴 **ВНИМАНИЕ:** Обновлять ТОЛЬКО все 3 места ОДНОВРЕМЕННО!

**Место 1: [src/App.tsx](src/App.tsx) строка 8**
```typescript
const ADMIN_TG_IDS = [6147055724, 783948887, 554036504, 1097870836, 5280806376, 5127811182, 8012023597];
```

**Место 2: [src/components/ProfileView.tsx](src/components/ProfileView.tsx) строка 21**
```typescript
const ADMIN_TG_IDS: number[] = [6147055724, 783948887, 554036504, 1097870836, 5280806376, 5127811182, 8012023597];
```

**Место 3: [src/utils/telegram.ts](src/utils/telegram.ts) строки 177-186**
```typescript
export const ADMIN_HARDCODED_CODES: Record<string, number> = {
  'ADM1': 6147055724,   // Овчаренко Владимир
  'ADM2': 783948887,    // Шмакова Милена
  'ADM3': 554036504,    // Шишмарева Галина
  'ADM4': 1097870836,   // Евтушенко Екатерина
  'ADM5': 5280806376,   // Шумова Екатерина
  'ADM6': 5127811182,   // Зайкова Евгения
  'ADM7': 8012023597,   // Общий Рабочий
};
```

### FIREBASE КОНФИГ ([.env](.env))
```env
VITE_FIREBASE_API_KEY=AIzaSyDDdXRwvYxps4zPEEyOH3RVHfLlzKC2jwk
VITE_FIREBASE_AUTH_DOMAIN=csc-bd-30c56.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=csc-bd-30c56
VITE_FIREBASE_STORAGE_BUCKET=csc-bd-30c56.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=853953200317
VITE_FIREBASE_APP_ID=1:853953200317:web:4834ccddbd0a8cfe5ff7d4
VITE_FIREBASE_MEASUREMENT_ID=G-DTYD2TEK4F
```

### TELEGRAM BOT TOKEN ([APPS_SCRIPT_FIXED.gs](APPS_SCRIPT_FIXED.gs) строка 1)
```javascript
var BOT_TOKEN = '8690029496:AAF8AS5SuabgoLbIzNkYqxrYotS6k7zvlNk';
```

### GOOGLE APPS SCRIPT URL ([src/utils/telegram.ts](src/utils/telegram.ts) строка 114)
```typescript
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1CSkgdNoCfExOQxbCQoceInqFubJlGXKW10awXG99ron29IgTJMZeOx6nCseMGqSx/exec';
```

---

## 4. FIRESTORE COLLECTIONS

Firebase Firestore содержит эти коллекции:

```
shift_notes         → Заметки к смене
emp_notes           → Заметки к сотруднику
shift_edits         → Правки смен (админ-редактирование)
employee_notes      → Альтернативное хранилище заметок
user_links          → Привязка UID → empId
shifts              → Хранение смен в облаке
```

**Каждая коллекция имеет документы с этими полями:**
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- документ-специфичные поля (текст, ID, данные)

---

## 5. LOCALSTORAGE КЛЮЧИ

```typescript
'sf_admin_shift_edits'   // JSON: { shiftId → { field: value } }
'sf_admin_emp_notes'     // JSON: { empId → { text, authorId } }
'sf_tg_links'            // JSON: { tgId → empId }
'sf_colleague_ids'       // JSON: { empId → true }
'sf_colleague_colors'    // JSON: { empId → color }
'sf_invite_codes'        // JSON: { code → empId }
'sf_tg_name'             // строка с именем пользователя
'ss_apps_script_url'     // URL для Google Apps Script
'sf_tg_friend_ids'       // JSON: { empId → true }
```

---

## 6. ПАРСЕР CSV - СЕРДЦЕ ПРОЕКТА

**Файл:** [src/hooks/useGoogleSheets.ts](src/hooks/useGoogleSheets.ts)

### Как работает parseGoogleSheetsCSV()
1. Берёт текст CSV из Google Sheets
2. Парсит строки и столбцы
3. Определяет имена сотрудников (первый столбец)
4. Определяет роли/отделы (второй столбец)
5. Парсит смены по датам (остальные столбцы)
6. **ГЛАВНОЕ:** Если у одного сотрудника есть 2 разные смены в один день → создаёт `shifts` массив и `shiftRoles` объект!

### Ключевая логика merge (строка ~150)
```typescript
if (shift !== 'off' && existing.shift !== 'off' && shift !== existing.shift) {
  // Две разные смены (день + ночь)
  entry.shift = determineDominantShift([existing.shift, shift]);
  entry.shifts = [existing.shift, shift];
  entry.shiftRoles = {
    [existing.shift]: existingRole,
    [shift]: roleForThisShift,
  };
}
```

**Это ГЛАВНОЕ ИСПРАВЛЕНИЕ:** раньше при двух сменах показывалась только одна!

---

## 7. ОСНОВНЫЕ КОМПОНЕНТЫ

### ShiftsView.tsx (ГЛАВНЫЙ КОМПОНЕНТ)
**Что делает:**
- Показывает календарь смен (месячный вид)
- DayModal → окно с деталями дня и всеми смотрящими
- Показывает своих смены как плашки (badges)
- Показывает смены коллег как отдельные плашки
- Каждая смена = отдельный цветной badge

**Ключевой код для dual-shift:**
```typescript
// Показываем ВСЕ смены для себя
myAllShifts?.forEach(shiftType => {
  // Отрисовываем plashka для каждого shiftType
  // С цветом от DEPARTMENT_CONFIG
});

// Показываем ВСЕ смены для коллеги
colleague.shifts?.forEach(shiftType => {
  // Отрисовываем plashka для каждого shiftType
});
```

### TodayView.tsx
**Что делает:**
- Показывает смены на ТЕКУЩИй день
- Группирует по отделам (bar, kitchen, hall и т.д.)

**Ключевая функция buildDayData():**
```typescript
// Для каждой смены создаём отдельную working entry
entry.shifts?.forEach(shiftType => {
  const role = entry.shiftRoles?.[shiftType];
  const dept = getDepartment(role);
  workingEntries.push({
    name: entry.name,
    shiftType,
    dept,
    startTime: SHIFT_TIMES[shiftType]?.start,
  });
});
```

### MonthView.tsx & WeekView.tsx
- Показывают календарь по месяцам и неделям
- DayModal для деталей дня
- Все работают с `shifts[]` массивом

---

## 8. ФУНКЦИИ FIREBASE

### Читать смены
```typescript
import { watchAllShiftNotes } from '../utils/firebase';

watchAllShiftNotes((notes) => {
  console.log('Новые заметки:', notes);
});
```

### Сохранить правку смены
```typescript
import { saveShiftEdit } from '../utils/firebase';

await saveShiftEdit({
  shiftId: 'emp-123-2026-06-11',
  changes: { shift: 'night', role: 'Бармен' },
  editorId: 'admin-user',
});
```

### Сохранить заметку
```typescript
import { saveEmpNote, watchEmpNotes } from '../utils/firebase';

await saveEmpNote({
  empId: 'emp-123',
  text: 'Хорошо работает',
  authorId: 'admin-user',
});

watchEmpNotes((notes) => console.log(notes));
```

---

## 9. ФУНКЦИИ TELEGRAM

### Привязка Telegram ID к сотруднику
```typescript
import { syncTgLink } from '../utils/telegram';

await syncTgLink('Иван Сидоров', 123456789);
```

### Получить Telegram ID текущего пользователя
```typescript
import { getTgUserId } from '../utils/telegram';

const tgId = getTgUserId();
```

### Проверить админ
```typescript
import { isAdmin } from '../utils/telegram'; // или прямо проверить

const is_admin = ADMIN_TG_IDS.includes(userTgId);
```

---

## 10. DEPARTMENT & SHIFT КОНФИГИ

### Отделы (Department)
```typescript
type Department = 'bar' | 'bar_manager' | 'power' | 'hall' | 'kitchen';

const DEPARTMENT_CONFIG: Record<Department, { color: string; label: string }> = {
  'bar': { color: '#ef4444', label: 'Бар' },
  'bar_manager': { color: '#8b5cf6', label: 'Бар Менеджер' },
  'power': { color: '#f59e0b', label: 'Власть' },
  'hall': { color: '#3b82f6', label: 'Зал' },
  'kitchen': { color: '#10b981', label: 'Кухня' },
};
```

### Время смен (SHIFT_TIMES в ShiftsView.tsx)
```typescript
const SHIFT_TIMES: Record<ShiftType, { start: string; end: string } | null> = {
  daily: { start: '09:00', end: '09:00' },
  day: { start: '09:00', end: '20:00' },
  night: { start: '20:00', end: '09:00' },
  off: null,
  vacation: null,
  sick: null,
};
```

### Приоритет смен (для определения доминирующей)
```typescript
const SHIFT_PRIORITY = ['sick', 'vacation', 'daily', 'day', 'night', 'off'];
```

---

## 11. ОСНОВНЫЕ ПРАВИЛА КОДИРОВАНИЯ

### ✅ ПРАВИЛО 1: Dual-Shift парадигма везде
При работе с ShiftEntry ВСЕГДА используй `shifts[]`, а не только `shift`:
```typescript
// ✅ ПРАВИЛЬНО
entry.shifts?.forEach(shiftType => { ... });

// ❌ НЕПРАВИЛЬНО
if (entry.shift === 'day') { ... }
```

### ✅ ПРАВИЛО 2: ADMIN_TG_IDS обновляй в 3 местах сразу
Если добавляешь админа → измени App.tsx + ProfileView.tsx + telegram.ts ОДНОВРЕМЕННО:
```typescript
// 3 места должны совпадать!
[6147055724, 783948887, ..., newAdminId]
```

### ✅ ПРАВИЛО 3: Firebase для persistent данных
Если нужно сохранить данные → используй Firebase:
```typescript
// ✅ ПРАВИЛЬНО
await saveShiftEdit(...);      // Firebase
localStorage.setItem(...);      // fallback

// ❌ НЕПРАВИЛЬНО
localStorage.setItem(...);      // только локальное
```

### ✅ ПРАВИЛО 4: getDepartment() для определения отдела
Используй функцию getDepartment() из types/schedule.ts:
```typescript
// ✅ ПРАВИЛЬНО
const dept = getDepartment(role);
const color = DEPARTMENT_CONFIG[dept].color;

// ❌ НЕПРАВИЛЬНО
const color = roleToColorMap[role];  // может быть неправильно
```

### ✅ ПРАВИЛО 5: Все компоненты зависят от данных через props
Пермахнул данные → пересчитай все компоненты:
```typescript
// Изменил shifts[]? → ShiftsView, TodayView, MonthView, WeekView тоже обновятся
```

---

## 12. ЧАСТЫЕ ОШИБКИ И ИСПРАВЛЕНИЯ

| ❌ ОШИБКА | ✅ ИСПРАВЛЕНИЕ | ПОЧЕМУ |
|----------|-----------|---------|
| Читаешь только `entry.shift` | Используй `entry.shifts[]` | Может быть несколько смен! |
| Обновил админа в 1 файле | Обновить в 3 файлах одновременно | Иначе админ не будет везде работать |
| Используешь `shift` для отдела | Используй `shiftRoles[shift]` | Разные смены могут иметь разные отделы |
| Сохраняешь только в localStorage | Сохранить в Firebase + localStorage | localStorage может потеряться |
| Не проверяешь nullable поля | Используй optional chaining `?.` | `entry.shifts` может быть undefined |
| Забыл про SHIFT_TIMES при расчетах | Проверь SHIFT_TIMES в ShiftsView | Время смены может отличаться |
| Hardcoded colors вместо DEPARTMENT_CONFIG | Всегда используй DEPARTMENT_CONFIG[dept].color | Админ может захотеть изменить цвета |
| Не обновляешь localStorage ключи | Используй константы выше (раздел 5) | Иначе данные потеряются |

---

## 13. ДЕББУГИНГ КОМАНДЫ

Запусти эти в браузере console для проверки:

### Проверить парсер
```javascript
import { parseGoogleSheetsCSV } from './hooks/useGoogleSheets';
const result = parseGoogleSheetsCSV(csvData);
console.log('Employee shifts:', result.employees[0].shifts);
// Должно быть: ['day', 'night'] если две смены
```

### Проверить Firebase
```javascript
import { testFullFirebase } from './utils/firebase';
await testFullFirebase();
// Должно быть: все коллекции работают ✅
```

### Проверить localStorage
```javascript
console.log('TG Links:', JSON.parse(localStorage.getItem('sf_tg_links')));
console.log('Admin Edits:', JSON.parse(localStorage.getItem('sf_admin_shift_edits')));
console.log('Colleagues:', JSON.parse(localStorage.getItem('sf_colleague_ids')));
```

### Проверить админа
```javascript
const userId = 6147055724;
const ADMIN_TG_IDS = [6147055724, 783948887, 554036504, 1097870836, 5280806376, 5127811182, 8012023597];
console.log('Is admin:', ADMIN_TG_IDS.includes(userId)); // true если админ
```

### Проверить shift roles
```javascript
const entry = result.employees[0]; // из парсера
console.log('Shift roles:', entry.shiftRoles);
// Должно быть: { 'day': 'Бармен', 'night': 'Повар' }
```

---

## 14. WORKFLOW ДОБАВЛЕНИЯ НОВОЙ ФУНКЦИИ

Если тебе нужно добавить новую функцию:

### Шаг 1: Нужны ли новые данные в Firestore?
```typescript
// ДА → Добавь коллекцию и CRUD функции в firebase.ts
// НЕТ → Переходи к шагу 2
```

### Шаг 2: Нужно ли хранить в localStorage?
```typescript
// ДА → Добавь KEY константу и функции get/set
// НЕТ → Переходи к шагу 3
```

### Шаг 3: Какой компонент нужно обновить?
```typescript
// ShiftsView → календарь/плашки
// TodayView → смены на сегодня
// ProfileView → профиль/настройки админа
// Другой → найди нужный компонент
```

### Шаг 4: Помни про dual-shift!
```typescript
// Используй shifts[] везде в новом коде!
// Не забудь про shiftRoles!
```

### Шаг 5: Тестируй
```bash
npm run build    # проверка TypeScript
npm run dev      # локальный тест
```

---

## 15. КОМАНДЫ ЗАПУСКА

```bash
# Установка зависимостей
npm install

# Локальный запуск
npm run dev
# Открой http://localhost:5173

# Production build
npm run build

# Предпросмотр production build
npm run preview
```

---

## 16. ТИПЫ ДАННЫХ (главные)

```typescript
// Основная структура сотрудника
interface Employee {
  id: string;
  name: string;
  birthday?: string;
  role?: string;
  shifts?: ShiftEntry[];  // ← массив дневных смен
}

// Смена за день
interface ShiftEntry {
  shift: ShiftType;           // доминирующая
  shifts?: ShiftType[];       // ВСЕ смены
  shiftRoles?: Record<string, string>;  // { shift → role }
}

// Данные с парсера
interface ScheduleData {
  employees: Employee[];
  shifts: ShiftEntry[][];  // [empIndex][dayIndex]
  months: Array<{ month: number; year: number }>;
}
```

---

## 17. КРИТИЧЕСКИЕ МОМЕНТЫ

🔴 **НИКОГДА НЕ ДЕЛАЙ:**
- ❌ Обновляй ADMIN_TG_IDS в одном файле (нужны все 3!)
- ❌ Забывай про nullable fields (используй `?.`)
- ❌ Сохраняй данные только в localStorage (нужен Firebase!)
- ❌ Читай `entry.shift` для dual-shift случаев (используй `shifts[]`)
- ❌ Используй hardcoded colors (используй DEPARTMENT_CONFIG)
- ❌ Изменяй Firebase конфиг без обновления .env (иначе сломается)

🟢 **ВСЕГДА ДЕЛАЙ:**
- ✅ Проверь dual-shift парадигму перед написанием кода
- ✅ Используй TypeScript типы (не `any`)
- ✅ Тестируй в браузере console перед коммитом
- ✅ Запусти `npm run build` перед коммитом (проверка ошибок)
- ✅ Читай `entry.shifts[]` везде где работаешь с смены
- ✅ Используй getDepartment(role) для определения отдела
- ✅ Обновляй Firebase security rules если добавляешь новые коллекции

---

## 18. БЫСТРАЯ СПРАВКА

**Когда нужно добавить админа:**
```
1. App.tsx строка 8
2. ProfileView.tsx строка 21
3. telegram.ts строки 177-186
ВСЕ РАЗОМ!
```

**Когда нужно показать смену:**
```
1. Используй shifts[] массив
2. Для каждого типа смены получи роль из shiftRoles
3. Получи отдел через getDepartment(role)
4. Используй цвет из DEPARTMENT_CONFIG[dept].color
```

**Когда нужно сохранить данные:**
```
1. Если постоянные → Firebase (saveShiftEdit, saveEmpNote и т.д.)
2. Всегда добавь localStorage fallback
3. Использ правильный ключ из раздела 5
```

**Когда что-то не работает:**
```
1. Открой браузер console
2. Запусти команды из раздела 13 (деббугинг)
3. Проверь что данные parserнулись правильно
4. Проверь что Firebase и localStorage синхронизированы
5. Проверь что админы обновлены везде
```

---

## 19. ФИНАЛЬНЫЕ ЧЕКЛИСТЫ

### Перед написанием кода
- ✅ Прочитал про dual-shift парадигму (раздел 2)
- ✅ Проверил все ПРАВИЛО 1-5 (раздел 11)
- ✅ Знаю какой компонент обновлять

### После написания кода
- ✅ Используешь `shifts[]` везде где нужно
- ✅ Используешь `shiftRoles` для определения отдела
- ✅ Используешь TypeScript типы (нет `any`)
- ✅ Нет ошибок в `npm run build`
- ✅ Протестировал в браузере console

### Перед коммитом
- ✅ `npm run build` проходит успешно
- ✅ Нет console.error в браузере
- ✅ Firebase тесты работают (`testFullFirebase()`)
- ✅ localStorage данные синхронизированы

### При добавлении админа
- ✅ Обновлено 3 места одновременно
- ✅ Имя админа добавлено в ADMIN_HARDCODED_CODES
- ✅ Индекс кода правильный (ADM1, ADM2, ..., ADM7)
- ✅ Все тесты проходят

---

**ГОТОВ К РАБОТЕ! Скопируй этот промпт перед каждой большой задачей. Удачи! 🚀**
