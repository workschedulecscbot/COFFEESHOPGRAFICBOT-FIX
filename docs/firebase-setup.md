Краткая инструкция по подключению Firebase для проекта

1) Создать проект в Firebase
- Откройте https://console.firebase.google.com и создайте новый проект.
- В проекте включите Firestore Database.
- В разделе Project settings -> SDK добавьте веб-приложение и скопируйте конфиг.
- В разделе "Authentication" → "Sign-in method" включите "Anonymous" (Enable).

2) Добавить переменные окружения (Vite)
Создайте файл `.env` в корне проекта и добавьте:

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

Перезапустите dev сервер после добавления переменных.

3) Установить npm-пакет

```bash
npm install firebase
```

4) Что я добавил в проект
- `src/utils/firebase.ts` — инициализация и helper-методы:
  - Shifts: `createShift`, `updateShift`, `setShiftVisibility`, `deleteShift`, `fetchShifts`, `watchShifts`
  - Shift notes: `addShiftNote`, `fetchShiftNotes`, `watchShiftNotes`
  - Employee notes: `addEmployeeNote`, `fetchEmployeeNotes`, `watchEmployeeNotes`

5) Правила безопасности (рекомендация)
В Firestore -> Rules временно для теста можно поставить разрешение на чтение/запись, но рекомендуется настроить так:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shift_notes/{noteId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.authorId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.authorId == request.auth.uid;
    }
    match /employee_notes/{noteId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.authorId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.authorId == request.auth.uid;
    }
    match /shifts/{shiftId} {
      allow read: if true;
      allow write: if request.auth != null; // уточните роли
    }
  }
}
```

6) Как использовать в коде
- Импортируйте функции из `src/utils/firebase.ts` и замените локальное `localStorage`-сохранение для примечаний/видимости смен на вызовы этих helper-методов.

Дополнение — анонимная авторизация
- Включите Anonymous sign-in (см. выше).
- В приложении вызывайте `ensureAnonymousAuth()` один раз при старте (например, в `src/main.tsx` или `App.tsx`). Это создаст/восстановит анонимный `uid` и функции `addShiftNote` / `addEmployeeNote` будут подставлять `authorId` автоматически.

Пример в `src/main.tsx`:
```ts
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ensureAnonymousAuth } from './utils/firebase'

ensureAnonymousAuth().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
```

7) Замечания
- Я не менял Apps Script (как вы просили).
- Для админских операций (изменение смен/видимости) рекомендуется делать проверки ролей через Firebase Auth или проксировать через защищённый сервер.
