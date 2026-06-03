import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ensureAnonymousAuth, testConnection, testFullFirebase } from './utils/firebase';

console.log('[Main] Starting app initialization...');

ensureAnonymousAuth().then(uid => {
  console.log('[Main] Firebase auth ready, UID:', uid);
  // Тестируем что можем читать из Firestore
  testConnection().catch(err => {
    console.error('[Main] Firebase test connection failed:', err);
  });
  // Запускаем полный CRUD тест в фоне
  testFullFirebase().catch(err => {
    console.error('[Main] Firebase full CRUD test failed:', err);
  });
  
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('[Main] App mounted successfully');
}).catch(err => {
  console.error('[Main] Firebase auth failed:', err);
  // fallback to render app even if auth fails
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('[Main] App mounted with auth error');
});
