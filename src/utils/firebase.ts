/**
 * Расширенный комплексный тест Firestore: запись, чтение, обновление и удаление документов
 * для проверки всего функционала. Тестирует основные коллекции и операции CRUD.
 * Выводит подробные логи в консоль.
 */
export interface TestResult {
  collection: string;
  write: { success: boolean; error?: string; docId?: string };
  read: { success: boolean; error?: string; docCount?: number };
  update: { success: boolean; error?: string };
  delete: { success: boolean; error?: string };
  totalTime: number;
}

export async function testFullFirebase(): Promise<TestResult[]> {
  console.log('🔍 [Firebase] Starting comprehensive CRUD test...');
  
  const results: TestResult[] = [];
  const testData = {
    shift_notes: { shiftId: 'test-shift-123', text: 'Test note', authorId: 'test-user' },
    employee_notes: { employeeId: 'test-emp-456', text: 'Employee test note', authorId: 'test-user' },
    shifts: { employeeId: 'test-emp-456', start: new Date(), visible: true },

    emp_notes: { employeeId: 'test-emp-456', text: 'Test emp note', authorId: 'test-user' },
    shift_edits: { shiftId: 'test-shift-123', editorId: 'test-user', changes: { field: 'value' } },
    user_links: { uid: 'test-uid', empId: 'test-emp-456' },
  };

  for (const [collectionName, testPayload] of Object.entries(testData)) {
    const startTime = performance.now();
    const result: TestResult = {
      collection: collectionName,
      write: { success: false },
      read: { success: false },
      update: { success: false },
      delete: { success: false },
      totalTime: 0,
    };

    let docId: string | null = null;

    try {
      // 1. ЗАПИСЬ (CREATE)
      try {
        console.log(`📝 [Firebase] Writing to ${collectionName}...`);
        const docRef = await addDoc(collection(db, collectionName), {
          ...testPayload,
          createdAt: serverTimestamp(),
          testFlag: true,
        });
        docId = docRef.id;
        result.write = { success: true, docId };
        console.log(`✅ [Firebase] ${collectionName}: Write successful (docId: ${docId})`);
      } catch (err: any) {
        result.write = { success: false, error: err.message };
        console.error(`❌ [Firebase] ${collectionName}: Write failed - ${err.code}: ${err.message}`);
      }

      // 2. ЧТЕНИЕ (READ)
      if (docId) {
        try {
          console.log(`📖 [Firebase] Reading from ${collectionName}...`);
          const docSnapshot = await getDocs(
            query(collection(db, collectionName), where('testFlag', '==', true))
          );
          result.read = { success: !docSnapshot.empty, docCount: docSnapshot.size };
          console.log(
            `✅ [Firebase] ${collectionName}: Read successful (found ${docSnapshot.size} test documents)`
          );
          if (!docSnapshot.empty) {
            console.log(`🔎 [Firebase] ${collectionName}: Sample doc data:`, docSnapshot.docs[0].data());
          }
        } catch (err: any) {
          result.read = { success: false, error: err.message };
          console.error(`❌ [Firebase] ${collectionName}: Read failed - ${err.code}: ${err.message}`);
        }
      }

      // 3. ОБНОВЛЕНИЕ (UPDATE)
      if (docId) {
        try {
          console.log(`✏️ [Firebase] Updating ${collectionName}/${docId}...`);
          const docRef = doc(db, collectionName, docId);
          await updateDoc(docRef, {
            updatedAt: serverTimestamp(),
            testFlag: true,
            updatedByTest: true,
          });
          result.update = { success: true };
          console.log(`✅ [Firebase] ${collectionName}: Update successful`);
        } catch (err: any) {
          result.update = { success: false, error: err.message };
          console.error(`❌ [Firebase] ${collectionName}: Update failed - ${err.code}: ${err.message}`);
        }
      }

      // 4. УДАЛЕНИЕ (DELETE)
      if (docId) {
        try {
          console.log(`🗑️ [Firebase] Deleting ${collectionName}/${docId}...`);
          const docRef = doc(db, collectionName, docId);
          await deleteDoc(docRef);
          result.delete = { success: true };
          console.log(`✅ [Firebase] ${collectionName}: Delete successful`);
        } catch (err: any) {
          result.delete = { success: false, error: err.message };
          console.error(`❌ [Firebase] ${collectionName}: Delete failed - ${err.code}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ [Firebase] Unexpected error in ${collectionName}:`, err);
    }

    result.totalTime = performance.now() - startTime;
    results.push(result);
  }

  // Summary
  const passed = results.filter(r => r.write.success && r.read.success && r.delete.success).length;
  const total = results.length;
  console.log(`\n📊 [Firebase] Test Summary: ${passed}/${total} collections passed all tests`);
  console.log('[Firebase] Detailed Results:', results);

  return results;
}

/**
 * Старая функция тестирования (оставлена для совместимости)
 */
export async function testWriteReadDelete(collectionName: string = 'test_index_check') {
  const testId = 'test_doc_' + Math.floor(Math.random() * 1000000);
  const testRef = doc(db, collectionName, testId);
  try {
    // 1. Запись
    await setDoc(testRef, { test: 'index_check', ts: serverTimestamp() });
    console.log(`[Firebase] ✅ Запись в ${collectionName}/${testId} успешна`);
    // 2. Чтение
    const snap = await getDocs(query(collection(db, collectionName), where('__name__', '==', testId)));
    if (!snap.empty) {
      console.log(`[Firebase] ✅ Чтение из ${collectionName}:`, snap.docs[0].id, snap.docs[0].data());
    } else {
      console.warn(`[Firebase] ⚠️ Документ ${testId} не найден при чтении из ${collectionName}`);
    }
    // 3. Удаление
    await deleteDoc(testRef);
    console.log(`[Firebase] ✅ Удаление из ${collectionName}/${testId} успешно`);
  } catch (err: any) {
    console.error(`[Firebase] ❌ Ошибка при тесте записи/чтения/удаления в ${collectionName}:`, err.code, err.message);
  }
}

/**
 * Тестовый запрос для искусственного вызова ошибки индексации Firestore
 */
export async function testFirestoreIndexError() {
  const indexTests = [
    { collection: 'shifts',        whereField: 'employeeId', whereValue: 'test-emp-456', orderField: 'start' },
    { collection: 'shift_notes',   whereField: 'shiftId',    whereValue: 'test-shift-123', orderField: 'createdAt' },
    { collection: 'employee_notes',whereField: 'employeeId', whereValue: 'test-emp-456', orderField: 'createdAt' },

    { collection: 'emp_notes',     whereField: 'employeeId', whereValue: 'test-emp-456', orderField: 'authorId' },
    { collection: 'emp_prefs',     whereField: 'employeeId', whereValue: 'test-emp-456', orderField: 'customUsername' },
    { collection: 'shift_edits',   whereField: 'shiftId',    whereValue: 'test-shift-123', orderField: 'editorId' },
    { collection: 'user_links',    whereField: 'empId',      whereValue: 'test-emp-456', orderField: 'uid' },
  ];
  for (const test of indexTests) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, test.collection),
          where(test.whereField, '==', test.whereValue),
          orderBy(test.orderField)
        )
      );
      console.log(`[Firebase] Индексация: ${test.collection} — найдено документов:`, querySnapshot.size);
      if (!querySnapshot.empty) {
        console.log(`[Firebase] Индексация: ${test.collection} — пример данных:`, querySnapshot.docs[0].data());
      }
    } catch (err: any) {
      console.error(`[Firebase] Ожидаемая ошибка индексации Firestore в ${test.collection}:`, err.code, err.message);
      if (err.message && err.message.includes('index')) {
        console.warn(`[Firebase] Firestore требует создать композитный индекс для ${test.collection}. Это ожидаемая ошибка для теста.`);
      }
    }
  }
}

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  deleteDoc,
  QueryDocumentSnapshot,
  DocumentData,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta.env as any).VITE_FIREBASE_API_KEY,
  authDomain: (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta.env as any).VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta.env as any).VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence for better offline support
enableIndexedDbPersistence(db).catch((err: any) => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Multiple windows open, offline persistence disabled');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Browser doesn\'t support offline persistence');
  }
});

// Helper function for retry logic with exponential backoff
async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        const delay = delayMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Ensure anonymous auth — call once on app start (returns current uid)
export function ensureAnonymousAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        console.log('[Firebase] Anonymous auth established:', user.uid);
        resolve(user.uid);
      }
    }, (err) => {
      unsubscribe();
      console.error('[Firebase] Auth error:', err);
      reject(err);
    });

    // if no user after subscription, try signInAnonymously
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        // common failure: anonymous auth not enabled in Firebase project
        if (err && err.code === 'auth/configuration-not-found') {
          console.warn('[Firebase] Anonymous auth appears to be disabled in the Firebase console.');
          console.warn('           Go to Firebase → Authentication → Sign-in method and enable "Anonymous".');
        } else {
          console.error('[Firebase] Failed to sign in anonymously:', err);
        }
        // ignore — onAuthStateChanged will catch errors too
      });
    }
  });
}

export function getCurrentUid(): string | null {
  return auth.currentUser ? auth.currentUser.uid : null;
}

/**
 * Comprehensive Firebase connection test — checks auth, Firestore, and various collections.
 * Logs detailed results to console for debugging.
 */
export async function testConnection(): Promise<void> {
  console.log('🔍 [Firebase] Starting comprehensive connection test...');
  
  try {
    // 1. Check current auth state
    console.log('📝 Current user:', auth.currentUser);
    console.log('📝 Current UID:', getCurrentUid());
    
    // 2. Test Firestore connectivity with multiple collections
    const collections_to_test = [
      'employee_notes',
      'shift_notes',
      'shifts',
      'shift_edits',
      'emp_notes',
      'emp_prefs',
      'user_links'
    ];
    
    for (const colName of collections_to_test) {
      try {
        const snap = await getDocs(collection(db, colName));
        console.log(`✅ [Firebase] ${colName}: ${snap.size} documents`);
      } catch (err: any) {
        console.error(`❌ [Firebase] ${colName} error:`, err.code, err.message);
      }
    }
    
    console.log('✨ [Firebase] Test completed successfully!');
  } catch (err) {
    console.error('❌ [Firebase] testConnection critical error:', err);
    throw err;
  }
}

// Shifts
export async function createShift(shift: {
  id?: string;
  employeeId: string;
  start: string | number | Date;
  end?: string | number | Date;
  notes?: string;
  visible?: boolean;
}) {
  return await addDoc(collection(db, 'shifts'), {
    ...shift,
    createdAt: serverTimestamp(),
  });
}

export async function updateShift(shiftId: string, patch: Record<string, any>) {
  const ref = doc(db, 'shifts', shiftId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function setShiftVisibility(shiftId: string, visible: boolean) {
  const ref = doc(db, 'shifts', shiftId);
  await setDoc(ref, { visible, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteShift(shiftId: string) {
  const ref = doc(db, 'shifts', shiftId);
  await deleteDoc(ref);
}

export async function fetchShifts() {
  const q = query(collection(db, 'shifts'), orderBy('start', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
}

export function watchShifts(cb: (items: any[]) => void) {
  try {
    const q = query(collection(db, 'shifts'), orderBy('start', 'desc'));
    return onSnapshot(
      q,
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          cb(snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error('[Firebase] Error processing shifts snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with shifts (will retry automatically):', errorCode);
        } else {
          console.error('[Firebase] Watch error for shifts:', errorCode, err?.message);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for shifts:', err);
    return () => {};
  }
}

// Shift notes
export async function addShiftNote(shiftId: string, text: string, authorId?: string) {
  try {
    const uid = authorId ?? getCurrentUid() ?? 'unknown';
    const docRef = await retryAsync(async () => {
      return await addDoc(collection(db, 'shift_notes'), {
        shiftId,
        text,
        authorId: uid,
        createdAt: serverTimestamp(),
      });
    });
    console.log('[Firebase] Shift note added:', docRef.id);
    return docRef;
  } catch (err) {
    console.error('[Firebase] Failed to add shift note after retries:', err);
    throw err;
  }
}

export async function fetchShiftNotes(shiftId: string) {
  try {
    const notes = await retryAsync(async () => {
      const q = query(
        collection(db, 'shift_notes'),
        where('shiftId', '==', shiftId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
    });
    console.log(`[Firebase] Fetched ${notes.length} shift notes for ${shiftId}`);
    return notes;
  } catch (err) {
    console.error('[Firebase] Failed to fetch shift notes after retries:', err);
    return [];
  }
}

export function watchShiftNotes(shiftId: string, cb: (items: any[]) => void) {
  try {
    const q = query(
      collection(db, 'shift_notes'),
      where('shiftId', '==', shiftId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const notes = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
          console.log(`[Firebase] Watch: ${notes.length} shift notes for ${shiftId}`);
          cb(notes);
        } catch (err) {
          console.error('[Firebase] Error processing shift notes snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue (will retry automatically):', errorCode);
        } else {
          console.error('[Firebase] Watch error for shift notes:', errorCode, err?.message);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for shift notes:', err);
    return () => {};
  }
}

export function watchAllShiftNotes(cb: (items: any[]) => void) {
  try {
    const q = query(collection(db, 'shift_notes'));
    return onSnapshot(
      q,
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const notes = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              note: data.text || data.note || '', // Map 'text' field to 'note' for consistency
            };
          });
          console.log(`[Firebase] Watch: ${notes.length} total shift notes`);
          cb(notes);
        } catch (err) {
          console.error('[Firebase] Error processing shift notes snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        const errorMsg = err?.message || 'Unknown error';
        
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with shift_notes (will retry automatically):', errorMsg);
        } else if (errorCode === 'permission-denied') {
          console.error('[Firebase] PERMISSION DENIED: shift_notes collection needs read access');
        } else {
          console.error('[Firebase] Watch error for shift notes:', errorCode, errorMsg);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for all shift notes:', err);
    return () => {};
  }
}

// Employee notes
export async function addEmployeeNote(employeeId: string, text: string, authorId?: string) {
  try {
    const uid = authorId ?? getCurrentUid() ?? 'unknown';
    const docRef = await retryAsync(async () => {
      return await addDoc(collection(db, 'employee_notes'), {
        employeeId,
        text,
        authorId: uid,
        createdAt: serverTimestamp(),
      });
    });
    console.log('[Firebase] Employee note added:', docRef.id);
    return docRef;
  } catch (err) {
    console.error('[Firebase] Failed to add employee note after retries:', err);
    throw err;
  }
}

export async function fetchEmployeeNotes(employeeId: string) {
  try {
    const notes = await retryAsync(async () => {
      const q = query(
        collection(db, 'employee_notes'),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
    });
    console.log(`[Firebase] Fetched ${notes.length} employee notes for ${employeeId}`);
    return notes;
  } catch (err) {
    console.error('[Firebase] Failed to fetch employee notes after retries:', err);
    return [];
  }
}

export function watchEmployeeNotes(employeeId: string, cb: (items: any[]) => void) {
  try {
    const q = query(
      collection(db, 'employee_notes'),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const notes = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
          console.log(`[Firebase] Watch: ${notes.length} employee notes for ${employeeId}`);
          cb(notes);
        } catch (err) {
          console.error('[Firebase] Error processing employee notes snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with employee notes:', errorCode);
        } else {
          console.error('[Firebase] Watch error for employee notes:', errorCode, err?.message);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for employee notes:', err);
    return () => {};
  }
}

// Delete employee notes (all documents) — used when clearing a note
export async function deleteEmployeeNotes(employeeId: string) {
  try {
    const q = query(collection(db, 'employee_notes'), where('employeeId', '==', employeeId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => deleteDoc(doc(db, 'employee_notes', d.id))));
    console.log(`[Firebase] Deleted ${snap.docs.length} employee notes for ${employeeId}`);
  } catch (err) {
    console.error('[Firebase] Failed to delete employee notes:', err);
  }
}

// Delete shift notes by shiftId (all documents) — used when removing shift edits
export async function deleteShiftNotes(shiftId: string) {
  try {
    // Guard against empty shiftId
    if (!shiftId || shiftId.trim().length === 0) {
      console.log('[Firebase] deleteShiftNotes: Empty shiftId, skipping');
      return;
    }
    
    const q = query(collection(db, 'shift_notes'), where('shiftId', '==', shiftId));
    const snap = await getDocs(q);
    
    if (snap.size === 0) {
      console.log(`[Firebase] No shift notes found for ${shiftId} (this is normal)`);
      return;
    }
    
    const deletePromises = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => 
      deleteDoc(doc(db, 'shift_notes', d.id))
    );
    await Promise.all(deletePromises);
    console.log(`[Firebase] Deleted ${snap.docs.length} shift notes for ${shiftId}`);
  } catch (err: any) {
    // Log but don't throw - this is non-critical cleanup
    console.log('[Firebase] Note: Could not delete shift notes (non-critical):', err?.code || err?.message || 'unknown error');
  }
}

// Employee rules (custom working hours)
export async function addEmployeeRule(employeeId: string, hours: { start: string; end: string }, authorId?: string) {
  try {
    const uid = authorId ?? getCurrentUid() ?? 'unknown';
    const docRef = await retryAsync(async () => {
      return await addDoc(collection(db, 'emp_rules'), {
        employeeId,
        hours,
        authorId: uid,
        createdAt: serverTimestamp(),
      });
    });
    console.log('[Firebase] Employee rule added:', docRef.id);
    return docRef;
  } catch (err) {
    console.error('[Firebase] Failed to add employee rule after retries:', err);
    throw err;
  }
}

export async function fetchEmployeeRules(employeeId: string) {
  try {
    const rules = await retryAsync(async () => {
      const q = query(
        collection(db, 'emp_rules'),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
    });
    console.log(`[Firebase] Fetched ${rules.length} employee rules for ${employeeId}`);
    return rules;
  } catch (err) {
    console.error('[Firebase] Failed to fetch employee rules after retries:', err);
    return [];
  }
}

export function watchEmployeeRules(employeeId: string, cb: (items: any[]) => void) {
  try {
    const q = query(
      collection(db, 'emp_rules'),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const rules = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
          console.log(`[Firebase] Watch: ${rules.length} employee rules for ${employeeId}`);
          cb(rules);
        } catch (err) {
          console.error('[Firebase] Error processing employee rules snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with employee rules:', errorCode);
        } else {
          console.error('[Firebase] Watch error for employee rules:', errorCode, err?.message);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for employee rules:', err);
    return () => {};
  }
}

// Delete employee rules (all documents) — used when clearing a rule
export async function deleteEmployeeRules(employeeId: string) {
  try {
    const q = query(collection(db, 'emp_rules'), where('employeeId', '==', employeeId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => deleteDoc(doc(db, 'emp_rules', d.id))));
    console.log(`[Firebase] Deleted ${snap.docs.length} employee rules for ${employeeId}`);
  } catch (err) {
    console.error('[Firebase] Failed to delete employee rules:', err);
  }
}

// ======== Shift Edits (synchronized from localStorage) ========
interface ShiftEditDoc {
  empId: string;
  date: string;
  customStart?: string;
  customEnd?: string;
  note?: string;
  updatedAt?: any;
}

export async function setShiftEdit(edit: ShiftEditDoc): Promise<void> {
  try {
    const docId = `${edit.empId}_${edit.date}`;
    const docRef = doc(db, 'shift_edits', docId);
    
    // Build payload - only include defined fields
    const payload: any = {
      empId: edit.empId,
      date: edit.date,
      updatedAt: serverTimestamp(),
    };
    
    if (edit.customStart !== undefined) payload.customStart = edit.customStart;
    if (edit.customEnd !== undefined) payload.customEnd = edit.customEnd;
    if (edit.note !== undefined) payload.note = edit.note;
    
    await setDoc(docRef, payload, { merge: true });
    console.log('[Firebase] Shift edit saved:', docId, 'fields:', Object.keys(payload).length);
  } catch (err) {
    console.error('[Firebase] Failed to save shift edit:', err);
    throw err;
  }
}

export async function deleteShiftEditDoc(empId: string, date: string): Promise<void> {
  try {
    const docId = `${empId}_${date}`;
    const docRef = doc(db, 'shift_edits', docId);
    await deleteDoc(docRef);
    console.log('[Firebase] Shift edit deleted:', docId);
  } catch (err) {
    console.error('[Firebase] Failed to delete shift edit:', err);
  }
}

// Реалтайм слушатель для правок смен (shift_edits) - теперь используется для live sync
export function watchShiftEdits(cb: (items: ShiftEditDoc[]) => void) {
  try {
    return onSnapshot(
      collection(db, 'shift_edits'),
      {
        // Network request settings to handle QUIC protocol issues
        source: 'default', // Try cache first, then network
      },
      (snap: any) => {
        try {
          const edits = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data() } as ShiftEditDoc));
          console.log('[Firebase] Watch shift_edits updated:', edits.length, 'items');
          cb(edits);
        } catch (err) {
          console.error('[Firebase] Error processing shift_edits snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        // Handle different network and firestore errors gracefully
        const errorCode = err?.code || 'unknown';
        const errorMsg = err?.message || 'Unknown error';
        
        // Network errors (QUIC, connection timeouts, etc) - these are recoverable
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with shift_edits (will retry automatically):', errorMsg);
        } else if (errorCode === 'permission-denied') {
          console.error('[Firebase] PERMISSION DENIED: shift_edits collection needs read access');
        } else {
          console.error('[Firebase] Watch error for shift_edits:', errorCode, errorMsg);
        }
        // Keep the listener active - Firebase SDK will retry automatically
        // Don't call cb([]) here, as that would show empty data on network hiccup
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for shift_edits:', err);
    return () => {};
  }
}

// ======== Employee Notes (synchronized from localStorage) ========
interface EmpNoteDoc {
  empId: string;
  note: string;
  updatedAt?: any;
}

export async function setEmpNote(empId: string, note: string): Promise<void> {
  try {
    const docRef = doc(db, 'emp_notes', empId);
    if (note.trim() === '') {
      await deleteDoc(docRef);
      console.log('[Firebase] Employee note deleted:', empId);
    } else {
      await setDoc(docRef, {
        empId,
        note,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log('[Firebase] Employee note saved:', empId);
    }
  } catch (err) {
    console.error('[Firebase] Failed to save employee note:', err);
    throw err;
  }
}

export async function fetchEmpNotes(): Promise<EmpNoteDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'emp_notes'));
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data() } as EmpNoteDoc));
  } catch (err) {
    console.error('[Firebase] Failed to fetch employee notes:', err);
    return [];
  }
}

// Employee Rules removed - use only Employee Preferences instead

// ======== User-Employee Link (current user → employee) ========
export interface UserLinkDoc {
  uid: string;
  empId: string;
  updatedAt?: any;
}

export async function setUserLink(uid: string, empId: string): Promise<void> {
  try {
    const docRef = doc(db, 'user_links', uid);
    await setDoc(docRef, {
      uid,
      empId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[Firebase] User link saved:', { uid, empId });
  } catch (err) {
    console.error('[Firebase] Failed to save user link:', err);
    throw err;
  }
}

export async function getUserLink(uid: string): Promise<string | null> {
  try {
    const snap = await getDocs(query(collection(db, 'user_links'), where('uid', '==', uid)));
    if (snap.empty) return null;
    return snap.docs[0].data().empId;
  } catch (err) {
    console.error('[Firebase] Failed to fetch user link:', err);
    return null;
  }
}

export async function deleteUserLink(uid: string): Promise<void> {
  try {
    const docRef = doc(db, 'user_links', uid);
    await deleteDoc(docRef);
    console.log('[Firebase] User link deleted:', uid);
  } catch (err) {
    console.error('[Firebase] Failed to delete user link:', err);
  }
}

// Реалтайм слушатель для заметок по сотрудникам (emp_notes)
export function watchEmpNotes(cb: (items: EmpNoteDoc[]) => void) {
  try {
    return onSnapshot(
      collection(db, 'emp_notes'),
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const notes = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data() } as EmpNoteDoc));
          console.log('[Firebase] Watch emp_notes updated:', notes.length, 'items');
          cb(notes);
        } catch (err) {
          console.error('[Firebase] Error processing emp_notes snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        const errorMsg = err?.message || 'Unknown error';
        
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with emp_notes (will retry automatically):', errorMsg);
        } else if (errorCode === 'permission-denied') {
          console.error('[Firebase] PERMISSION DENIED: emp_notes collection needs read access');
        } else {
          console.error('[Firebase] Watch error for emp_notes:', errorCode, errorMsg);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for emp_notes:', err);
    return () => {};
  }
}

// ======== Employee Preferences (birthday, showTelegram, tgUsername, customUsername) ========
export interface EmpPrefsDoc {
  empId: string;
  birthday?: string;        // "mm-dd" format
  showTelegram?: boolean;
  tgUsername?: string;      // Telegram username without @
  customUsername?: string;  // Custom display name
  updatedAt?: any;
}

export async function setEmpPrefs(prefs: EmpPrefsDoc): Promise<void> {
  try {
    if (!prefs.empId) throw new Error('empId is required');
    const docRef = doc(db, 'emp_prefs', prefs.empId);
    await setDoc(docRef, {
      empId: prefs.empId,
      birthday: prefs.birthday,
      showTelegram: prefs.showTelegram,
      tgUsername: prefs.tgUsername,
      customUsername: prefs.customUsername,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[Firebase] Employee prefs saved:', { empId: prefs.empId, birthday: prefs.birthday, showTelegram: prefs.showTelegram });
  } catch (err) {
    console.error('[Firebase] Failed to save employee prefs:', err);
    throw err;
  }
}

export async function getEmpPrefs(empId: string): Promise<EmpPrefsDoc | null> {
  try {
    const docRef = doc(db, 'emp_prefs', empId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as EmpPrefsDoc;
  } catch (err) {
    console.error('[Firebase] Failed to fetch employee prefs:', err);
    return null;
  }
}

export async function fetchAllEmpPrefs(): Promise<EmpPrefsDoc[]> {
  try {
    const snap = await getDocs(collection(db, 'emp_prefs'));
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data() } as EmpPrefsDoc));
  } catch (err) {
    console.error('[Firebase] Failed to fetch all employee prefs:', err);
    return [];
  }
}

export function watchEmpPrefs(cb: (items: EmpPrefsDoc[]) => void) {
  try {
    return onSnapshot(
      collection(db, 'emp_prefs'),
      { source: 'default' }, // Try cache first, then network
      (snap: any) => {
        try {
          const prefs = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ ...d.data() } as EmpPrefsDoc));
          console.log('[Firebase] Watch emp_prefs updated:', prefs.length, 'items');
          cb(prefs);
        } catch (err) {
          console.error('[Firebase] Error processing emp_prefs snapshot:', err);
          cb([]);
        }
      },
      (err: any) => {
        const errorCode = err?.code || 'unknown';
        const errorMsg = err?.message || 'Unknown error';
        
        if (errorCode.includes('QUIC') || errorCode.includes('NETWORK') || errorCode === 'unavailable') {
          console.warn('[Firebase] Temporary network issue with emp_prefs (will retry automatically):', errorMsg);
        } else if (errorCode === 'permission-denied') {
          console.error('[Firebase] PERMISSION DENIED: emp_prefs collection needs read access');
        } else {
          console.error('[Firebase] Watch error for emp_prefs:', errorCode, errorMsg);
        }
      }
    );
  } catch (err) {
    console.error('[Firebase] Failed to set up watch for emp_prefs:', err);
    return () => {};
  }
}
