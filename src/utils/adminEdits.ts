// Хранилище для административных правок смен и примечаний

export interface ShiftEdit {
  empId: string;
  date: string;          // yyyy-mm-dd
  customStart?: string;  // "11:00"
  customEnd?: string;    // "20:00"
  note?: string;         // примечание к конкретной смене
}

export interface EmpNote {
  empId: string;
  note: string;          // постоянное примечание к сотруднику
}

const STORAGE_SHIFT_EDITS = 'sf_admin_shift_edits';
const STORAGE_EMP_NOTES   = 'sf_admin_emp_notes';
const STORAGE_KEY_SCRIPT = 'ss_apps_script_url';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1CSkgdNoCfExOQxbCQoceInqFubJlGXKW10awXG99ron29IgTJMZeOx6nCseMGqSx/exec';

// ── Правки смен ─────────────────────────────────────────────────────

export function loadShiftEdits(): ShiftEdit[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_SHIFT_EDITS) || '[]'); }
  catch { return []; }
}

import { addShiftNote, deleteShiftNotes, setShiftEdit, deleteShiftEditDoc, setEmpNote, setUserLink, deleteUserLink, getCurrentUid, setEmpPrefs } from './firebase';

function saveShiftEditToLocal(edit: ShiftEdit) {
  const all = loadShiftEdits();
  const idx = all.findIndex(e => e.empId === edit.empId && e.date === edit.date);
  const updated: ShiftEdit = { empId: edit.empId, date: edit.date, customStart: edit.customStart, customEnd: edit.customEnd, note: edit.note };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  try {
    localStorage.setItem(STORAGE_SHIFT_EDITS, JSON.stringify(all));
    console.log('[AdminEdits] Shift edit cached to localStorage:', { empId: edit.empId, date: edit.date });
  } catch (err) {
    console.error('[AdminEdits] Failed to cache shift edit to localStorage:', err);
  }
}

function deleteShiftEditFromLocal(empId: string, date: string) {
  const all = loadShiftEdits();
  const filtered = all.filter(e => !(e.empId === empId && e.date === date));
  try {
    localStorage.setItem(STORAGE_SHIFT_EDITS, JSON.stringify(filtered));
    console.log('[AdminEdits] Shift edit removed from localStorage:', { empId, date });
  } catch (err) {
    console.error('[AdminEdits] Failed to remove shift edit from localStorage:', err);
  }
}

export function saveShiftEdit(edit: ShiftEdit): void {
  console.log('[AdminEdits] Saving shift edit to Firebase:', { empId: edit.empId, date: edit.date });

  // Persist locally immediately so UI updates without waiting for Firebase
  saveShiftEditToLocal(edit);

  // Save to Firebase first (primary source)
  setShiftEdit({
    empId: edit.empId,
    date: edit.date,
    customStart: edit.customStart,
    customEnd: edit.customEnd,
    note: edit.note,
  }).then(() => {
    console.log('[AdminEdits] Shift edit saved to Firebase successfully');
  }).catch((err) => {
    console.error('[AdminEdits] Failed to save shift edit to Firebase:', err);
    alert('❌ Не удалось сохранить правку смены в Firebase. Проверьте соединение.');
  });

  // Синхронизировать с Apps Script as async task
  syncShiftEditToServer(edit).catch(err => {
    console.error('[AdminEdits] Apps Script sync failed:', err);
  });

  // Also persist note to Firestore shift_notes if provided, or delete if empty
  if (edit.note && edit.note.trim()) {
    addShiftNote(`${edit.empId}-${edit.date}`, edit.note).catch((err) => {
      console.error('[AdminEdits] Failed to sync shift note to Firebase:', err);
    });
  }
  // Note: We don't try to delete shift_notes here, as it's not critical if they exist
}

export function deleteShiftEdit(empId: string, date: string): void {
  console.log('[AdminEdits] Deleting shift edit:', { empId, date });

  // Delete locally first so UI updates immediately
  deleteShiftEditFromLocal(empId, date);

  // Delete the shift edit document completely from Firebase (primary)
  deleteShiftEditDoc(empId, date).then(() => {
    console.log('[AdminEdits] Shift edit deleted from Firebase successfully');
  }).catch((err) => {
    console.error('[AdminEdits] Failed to delete shift edit from Firebase:', err);
    alert('❌ Не удалось удалить правку смены из Firebase. Проверьте соединение.');
  });

  // Also delete associated shift notes (async, non-critical)
  const shiftKey = `${empId}-${date}`;
  deleteShiftNotes(shiftKey).catch((err) => {
    // Non-critical error - just log it
    console.log('[AdminEdits] Shift notes cleanup info (non-critical):', err?.message || 'unknown');
  });

  // Sync deletion to Apps Script as async task
  syncShiftDeleteToServer(empId, date).catch(err => {
    console.error('[AdminEdits] Apps Script delete sync failed:', err);
  });
}

export function getShiftEdit(empId: string, date: string): ShiftEdit | null {
  return loadShiftEdits().find(e => e.empId === empId && e.date === date) ?? null;
}

// ── Примечания к сотрудникам ─────────────────────────────────────────

export function loadEmpNotes(): EmpNote[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_EMP_NOTES) || '[]'); }
  catch { return []; }
}

function saveEmpNoteToLocal(empId: string, note: string): void {
  const finalNote = note.trim();
  const all = loadEmpNotes();
  const idx = all.findIndex(e => e.empId === empId);

  if (finalNote) {
    if (idx >= 0) all[idx] = { empId, note: finalNote };
    else all.push({ empId, note: finalNote });
  } else if (idx >= 0) {
    all.splice(idx, 1);
  }

  try {
    localStorage.setItem(STORAGE_EMP_NOTES, JSON.stringify(all));
    console.log('[AdminEdits] Employee note saved to localStorage (cache)', { empId });
  } catch (err) {
    console.error('[AdminEdits] Failed to cache employee note to localStorage:', err);
  }
}

export function saveEmpNote(empId: string, note: string): void {
  const finalNote = note.trim();

  // Persist locally right away so UI stays consistent and changes survive reloads
  saveEmpNoteToLocal(empId, finalNote);

  console.log('[AdminEdits] Saving employee note to Firebase:', { empId, length: finalNote.length });
  
  // Save to Firebase first (primary source)
  setEmpNote(empId, finalNote).then(() => {
    console.log('[AdminEdits] Employee note saved to Firebase successfully');
  }).catch((err) => {
    console.error('[AdminEdits] Failed to save employee note to Firebase:', err);
    alert('❌ Не удалось сохранить примечание в Firebase. Проверьте соединение.');
  });
  
  // Синхронизировать с Apps Script as async task
  syncEmpNoteToServer(empId, finalNote).catch(err => {
    console.error('[AdminEdits] Apps Script sync failed:', err);
  });
}

export function getEmpNote(empId: string): string {
  return loadEmpNotes().find(e => e.empId === empId)?.note ?? '';
}

// ── User-Employee Link (привязка текущего пользователя к сотруднику) ──
const STORAGE_LINKED_ID = 'sf_linked_emp_id';

export function saveLinkedEmpId(empId: string | null): void {
  if (!empId) {
    console.log('[AdminEdits] saveLinkedEmpId: Clearing linked employee (empId=null)');
    const uid = getCurrentUid();
    if (uid) {
      // Remove from Firebase first (primary)
      deleteUserLink(uid).then(() => {
        console.log('[AdminEdits] User link cleared from Firebase');
      }).catch((err) => {
        console.error('[AdminEdits] Failed to clear user link in Firebase:', err);
      }).finally(() => {
        // Then clear localStorage as fallback
        localStorage.removeItem(STORAGE_LINKED_ID);
        console.log('[AdminEdits] localStorage.removeItem(STORAGE_LINKED_ID) called');
      });
    } else {
      localStorage.removeItem(STORAGE_LINKED_ID);
      console.log('[AdminEdits] localStorage.removeItem(STORAGE_LINKED_ID) called (no UID)');
    }
    return;
  }
  console.log('[AdminEdits] saveLinkedEmpId: Saving linked employee:', empId);
  const uid = getCurrentUid();
  if (uid) {
    // Save to Firebase first (primary)
    setUserLink(uid, empId).then(() => {
      console.log('[AdminEdits] User link saved to Firebase successfully');
      // Keep a local copy so auto-login works on reload even when Firebase isn't queried.
      localStorage.setItem(STORAGE_LINKED_ID, empId);
      console.log('[AdminEdits] localStorage.setItem(STORAGE_LINKED_ID, empId) called (cached)');
    }).catch((err) => {
      console.error('[AdminEdits] Failed to sync user link to Firebase:', err);
      // Fallback to localStorage
      localStorage.setItem(STORAGE_LINKED_ID, empId);
      console.warn('[AdminEdits] Saved to localStorage as emergency backup (Firebase down?)');
    });
  } else {
    // No UID, just save to localStorage
    localStorage.setItem(STORAGE_LINKED_ID, empId);
    console.log('[AdminEdits] localStorage.setItem(STORAGE_LINKED_ID, empId) called (no UID)', empId);
  }
}

export function getLinkedEmpId(): string | null {
  return localStorage.getItem(STORAGE_LINKED_ID) ?? null;
}

// ── Синхронизация с Apps Script ──────────────────────────────────────

/**
 * Синхронизировать правку смены на сервер
 */
async function syncShiftEditToServer(edit: ShiftEdit): Promise<void> {
  const scriptUrl = localStorage.getItem(STORAGE_KEY_SCRIPT) || DEFAULT_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const payload = {
      action: 'editshift',
      empId: edit.empId,
      date: edit.date,
      customStart: edit.customStart,
      customEnd: edit.customEnd,
      note: edit.note,
    };
    console.log('syncShiftEditToServer -> POST', scriptUrl, payload);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = '';
    try { text = await response.text(); } catch (e) { /* ignore */ }
    if (!response.ok) {
      console.error(`❌ syncShiftEdit ошибка: ${response.status} ${response.statusText}`, text);
    } else {
      console.log(`✅ syncShiftEdit успешно: ${edit.empId} ${edit.date}`, response.status, text);
    }
  } catch (err) {
    console.error('❌ syncShiftEdit ошибка сети:', err);
  }
}

/**
 * Синхронизировать удаление правки смены на сервер
 */
async function syncShiftDeleteToServer(empId: string, date: string): Promise<void> {
  const scriptUrl = localStorage.getItem(STORAGE_KEY_SCRIPT) || DEFAULT_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const payload = { action: 'deleteshift', empId, date };
    console.log('syncShiftDeleteToServer -> POST', scriptUrl, payload);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = '';
    try { text = await response.text(); } catch (e) { /* ignore */ }
    if (!response.ok) {
      console.error(`❌ syncShiftDelete ошибка: ${response.status} ${response.statusText}`, text);
    } else {
      console.log(`✅ syncShiftDelete успешно: ${empId} ${date}`, response.status, text);
    }
  } catch (err) {
    console.error('❌ syncShiftDelete ошибка сети:', err);
  }
}

/**
 * Синхронизировать примечание к сотруднику на сервер
 */
async function syncEmpNoteToServer(empId: string, note: string): Promise<void> {
  const scriptUrl = localStorage.getItem(STORAGE_KEY_SCRIPT) || DEFAULT_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const payload = { action: 'empnote', empId, note };
    console.log('syncEmpNoteToServer -> POST', scriptUrl, payload);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = '';
    try { text = await response.text(); } catch (e) { /* ignore */ }
    if (!response.ok) {
      console.error(`❌ syncEmpNote ошибка: ${response.status} ${response.statusText}`, text);
    } else {
      console.log(`✅ syncEmpNote успешно: ${empId}`, response.status, text);
    }
  } catch (err) {
    console.error('❌ syncEmpNote ошибка сети:', err);
  }
}

/**
 * Отправить информацию об отладке администраторам
 */
async function syncDebugToServer(empName: string, empDept: string | null, empRoles: string[], tgUsername: string | undefined, tgId: number | null, appsScriptUrl?: string): Promise<void> {
  const scriptUrl = appsScriptUrl || localStorage.getItem(STORAGE_KEY_SCRIPT) || DEFAULT_SCRIPT_URL;
  if (!scriptUrl) return;
  try {
    const payload = {
      action: 'senddebug',
      empName,
      empDept,
      empRoles,
      tgUsername,
      tgId,
    };
    console.log('syncDebugToServer -> POST', scriptUrl, payload);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let text = '';
    try { text = await response.text(); } catch (e) { /* ignore */ }
    if (!response.ok) {
      console.error(`❌ syncDebug ошибка: ${response.status} ${response.statusText}`, text);
    } else {
      console.log(`✅ syncDebug успешно отправлена отладка`, response.status, text);
    }
  } catch (err) {
    console.error('❌ syncDebug ошибка сети:', err);
  }
}

/**
 * Экспортируемая функция для отправки отладки
 */
export async function sendDebugToAdmins(params: {
  empName: string;
  empDept: string | null;
  empRoles: string[];
  tgUsername?: string;
  tgId: number | null;
  appsScriptUrl?: string;
}): Promise<void> {
  return syncDebugToServer(params.empName, params.empDept, params.empRoles, params.tgUsername, params.tgId, params.appsScriptUrl);
}

// ── Employee Preferences (birthday, showTelegram, tgUsername) ──────

const STORAGE_EMP_PREFS = 'sf_emp_prefs_cache';

export interface EmployeePrefs {
  empId: string;
  birthday?: string;        // "mm-dd" format
  showTelegram?: boolean;
  tgUsername?: string;      // Telegram username without @
  customUsername?: string;  // Custom display name
}

export function loadEmpPrefs(): EmployeePrefs[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_EMP_PREFS) || '[]');
  } catch {
    return [];
  }
}

export function getEmpPrefs(empId: string): EmployeePrefs | null {
  const all = loadEmpPrefs();
  return all.find(p => p.empId === empId) ?? null;
}

function saveEmpPrefsToLocal(prefs: EmployeePrefs): void {
  const all = loadEmpPrefs();
  const idx = all.findIndex(p => p.empId === prefs.empId);
  
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...prefs };
  } else {
    all.push(prefs);
  }
  
  try {
    localStorage.setItem(STORAGE_EMP_PREFS, JSON.stringify(all));
    console.log('[AdminEdits] Employee prefs saved to localStorage (cache)', { empId: prefs.empId });
  } catch (err) {
    console.error('[AdminEdits] Failed to cache employee prefs to localStorage:', err);
  }
}

export function cacheEmpPrefs(prefsList: EmployeePrefs[]): void {
  try {
    const existing = loadEmpPrefs();
    const map = new Map<string, EmployeePrefs>();
    
    // Load existing into map
    for (const p of existing) {
      if (p.empId) map.set(p.empId, p);
    }
    
    // Merge new prefs
    for (const p of prefsList) {
      if (p.empId) {
        map.set(p.empId, { ...map.get(p.empId), ...p });
      }
    }
    
    // Convert back to array and save
    const merged = Array.from(map.values());
    localStorage.setItem(STORAGE_EMP_PREFS, JSON.stringify(merged));
    console.log('[AdminEdits] Cached employee prefs to localStorage (merged)', merged.length, 'items');
  } catch (err) {
    console.error('[AdminEdits] Failed to cache employee prefs to localStorage:', err);
  }
}

export function saveEmpPrefs(prefs: EmployeePrefs): void {
  console.log('[AdminEdits] Saving employee prefs:', { empId: prefs.empId, birthday: prefs.birthday, showTelegram: prefs.showTelegram, tgUsername: prefs.tgUsername });
  
  // Persist locally immediately
  saveEmpPrefsToLocal(prefs);
  
  // Save to Firebase (primary source)
  setEmpPrefs({
    empId: prefs.empId,
    birthday: prefs.birthday,
    showTelegram: prefs.showTelegram,
    tgUsername: prefs.tgUsername,
    customUsername: prefs.customUsername,
  }).then(() => {
    console.log('[AdminEdits] Employee prefs saved to Firebase successfully');
  }).catch((err) => {
    console.error('[AdminEdits] Failed to save employee prefs to Firebase:', err);
    // Don't show alert - this is non-critical for shifting functionality
  });
}
