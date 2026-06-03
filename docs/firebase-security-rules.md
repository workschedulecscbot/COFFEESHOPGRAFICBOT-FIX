# Применение Firestore Security Rules

## 🚨 ВНИМАНИЕ: Текущие правила НЕРАБОТАЮЩИЕ!

Если вы видете **чёрный экран** при использовании приложения, это вызвано излишне строгими Security Rules.

## ✅ ИСПРАВЛЕННЫЕ ПРАВИЛА (ИСПОЛЬЗУЙТЕ ЭТИ!)

## Шаг 1: Откройте Firebase Console

1. Перейдите на [console.firebase.google.com](https://console.firebase.google.com)
2. Выберите проект `csc-bd-30c56`
3. В левом меню выберите **Firestore Database**

## Шаг 2: Откройте вкладку Rules

В верхней части экрана нажмите на вкладку **Rules**

## Шаг 3: Замените код правил

Удалите всё содержимое и скопируйте **эти правила**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Разрешаем всем аутентифицированным пользователям читать и писать
    // Это безопасно в dev-режиме, так как у нас только anonymous auth
    
    match /shift_notes/{noteId} {
      allow read, write: if request.auth != null;
    }

    match /employee_notes/{noteId} {
      allow read, write: if request.auth != null;
    }

    match /shifts/{shiftId} {
      allow read, write: if request.auth != null;
    }

    match /employee_rules/{ruleId} {
      allow read, write: if request.auth != null;
    }

    match /shift_edits/{docId} {
      allow read, write: if request.auth != null;
    }

    match /emp_notes/{empId} {
      allow read, write: if request.auth != null;
    }

    match /emp_rules/{empId} {
      allow read, write: if request.auth != null;
    }

    match /emp_prefs/{empId} {
      allow read, write: if request.auth != null;
    }

    match /user_links/{uid} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Шаг 4: Опубликуйте изменения

Нажмите кнопку **Publish** в правом нижнем углу

---

## ⚠️ ОБЯЗАТЕЛЬНЫЕ ПРЕДУСЛОВИЯ

Перед применением правил убедитесь, что:

### 1. Anonymous Authentication ВКЛЮЧЕНА

1. Перейдите в **Authentication** (левое меню)
2. Откройте вкладку **Sign-in method**
3. Найдите "Anonymous" и убедитесь что он **ENABLED** (синяя галка)
4. Если отключен - нажимите на него и **Enable**

**Без этого приложение не сможет подключиться к Firebase!**

### 2. Проверьте переменные окружения в `.env`

```
VITE_FIREBASE_API_KEY=AIzaSyDDdXRwvYxps4zPEEyOH3RVHfLlzKC2jwk
VITE_FIREBASE_AUTH_DOMAIN=csc-bd-30c56.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=csc-bd-30c56
VITE_FIREBASE_STORAGE_BUCKET=csc-bd-30c56.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=853953200317
VITE_FIREBASE_APP_ID=1:853953200317:web:4834ccddbd0a8cfe5ff7d4
VITE_FIREBASE_MEASUREMENT_ID=G-DTYD2TEK4F
```

---

## 🔍 Что означают правила

### Структура правил
- **`request.auth != null`** — только аутентифицированные пользователи (в том числе anonymous)
- **Каждая коллекция** имеет свои `allow` правила
- **Иерархия не наследуется** — нужно писать правила для каждой коллекции

### Коллекции и их назначение

| Коллекция | Назначение | Кто может | 
|-----------|-----------|----------|
| `shift_notes` | Заметки по сменам | Аутентифицированные пользователи |
| `employee_notes` | Заметки о сотрудниках | Аутентифицированные пользователи |
| `shifts` | Информация о сменах | Аутентифицированные пользователи |
| `employee_rules` | Правила работы сотрудников | Аутентифицированные пользователи |
| `shift_edits` | Правки смен в localStorage | Аутентифицированные пользователи |
| `emp_notes` | Основные заметки | Аутентифицированные пользователи |
| `emp_rules` | Основные правила | Аутентифицированные пользователи |
| `emp_prefs` | Предпочтения (день рождения, Telegram) | Аутентифицированные пользователи |
| `user_links` | Связь UID ↔ сотрудника | Аутентифицированные пользователи |

---

## 🧪 Проверка Security Rules

После публикации правил проверьте что всё работает:

1. Откройте **Rules Playground** (кнопка в левом меню)
2. Выберите коллекцию `emp_prefs`, операцию `read`
3. Нажмите **Run** 
4. Должно быть: **Outcome: Allow** ✅

Если **Outcome: Deny** ❌ — проверьте что Anonymous Auth включена!

---

## ⚡ БЫСТРОЕ ИСПРАВЛЕНИЕ (если черный экран)

Если срочно нужно чтобы работало, скопируйте в Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write;
    }
  }
}
```

⚠️ **Это открывает БД для ВСЕХ! Используйте только для тестирования!**

---

## 🚀 ПОСЛЕ ИСПРАВЛЕНИЯ

1. Обновите страницу приложения (Ctrl+R)
2. Откройте консоль браузера (F12)
3. Должны появиться сообщения:
   ```
   [Firebase] Anonymous auth established: xxxxx
   [Firebase] Watch emp_prefs updated: 0 items
   ```
4. **Черный экран должен исчезнуть!**

---

## 📖 Дополнительная информация

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/start)
- [Rules Playground Guide](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [см. FIREBASE_DIAGNOSTIC.md для диагностики](../FIREBASE_DIAGNOSTIC.md)


Ошибки правил будут видны в консоли браузера при открытии DevTools (F12):

- `Missing or insufficient permissions` — правила запретили операцию
- Проверьте логирование в [firebase.ts](../src/utils/firebase.ts) — там включены console.log/console.error

Пример логирования:
```
[Firebase] Anonymous auth established: p7x8Q9... 
[Firebase] Employee note added: doc123
[Firebase] Fetched 1 employee notes for emp-1
```

---

## FAQ

**Q: Когда правила вступят в силу?**
A: Сразу после публикации. Но в консоли они могут отображаться с небольшой задержкой.

**Q: Что если я допустил ошибку в правилах?**
A: Вернитесь в Rules, исправьте и снова опубликуйте. Старые правила останутся действительны, пока вы не обновите.

**Q: Нужно ли всё это для локальной разработки?**
A: Да, если хотите тестировать реальные операции с Firestore. В режиме разработки можно временно использовать permissive правила, но это опасно для production.

**Q: Как заблокировать доступ конкретному пользователю?**
A: Создайте список заблокированных UID и проверьте его в правилах:
```
match /shift_notes/{noteId} {
  allow read: if true;
  allow create: if request.auth != null && !["uid1", "uid2"].includes(request.auth.uid);
}
```
