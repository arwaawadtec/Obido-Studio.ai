import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDocFromServer,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  memoryLocalCache,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type PersistenceMode = 'multi_tab' | 'single_tab' | 'memory' | 'unconfigured';

export type ConnectionClassification =
  | 'connected'
  | 'transient_drop'
  | 'permanent_offline'
  | 'failed_precondition'
  | 'permission_denied'
  | 'unknown';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;
let isConfigured = false;
let activePersistenceMode: PersistenceMode = 'unconfigured';
let lastKnownConnectionState: ConnectionClassification = 'connected';

function callInitializeFirestore(targetApp: FirebaseApp, settings: any, databaseId?: string): Firestore {
  return databaseId ? initializeFirestore(targetApp, settings, databaseId) : initializeFirestore(targetApp, settings);
}

function callGetFirestore(targetApp: FirebaseApp, databaseId?: string): Firestore {
  return databaseId ? getFirestore(targetApp, databaseId) : getFirestore(targetApp);
}

/**
 * Robustly initializes Firestore with an explicit persistence retry strategy:
 * 1. Attempts multi-tab persistent cache (`persistentMultipleTabManager`).
 * 2. Catches 'failed-precondition' (e.g. storage contention) or 'unavailable' and falls back to single-tab.
 * 3. Catches remaining failures and falls back to in-memory cache.
 */
function initFirestoreInstance(targetApp: FirebaseApp, databaseId?: string): { db: Firestore; mode: PersistenceMode } {
  const isBrowser = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  if (!isBrowser) {
    try {
      const db = callInitializeFirestore(targetApp, { localCache: memoryLocalCache() }, databaseId);
      return { db, mode: 'memory' };
    } catch {
      return { db: callGetFirestore(targetApp, databaseId), mode: 'memory' };
    }
  }

  // Attempt 1: Multi-tab persistence
  try {
    const cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
    const db = callInitializeFirestore(
      targetApp,
      {
        experimentalForceLongPolling: true,
        localCache: cache,
      },
      databaseId
    );
    return { db, mode: 'multi_tab' };
  } catch (err: any) {
    const code = err?.code || '';
    const msg = err instanceof Error ? err.message : String(err);

    // If initializeFirestore already ran, retrieve existing instance
    if (msg.includes('already been started') || msg.includes('has already been initialized')) {
      return { db: callGetFirestore(targetApp, databaseId), mode: 'multi_tab' };
    }

    if (code === 'failed-precondition' || msg.includes('failed-precondition') || msg.includes('Multiple tabs open')) {
      console.warn('[Firebase] Multi-tab persistence failed-precondition, falling back to single-tab cache.');
      try {
        const singleCache = persistentLocalCache({ tabManager: persistentSingleTabManager({}) });
        const db = callInitializeFirestore(
          targetApp,
          { experimentalForceLongPolling: true, localCache: singleCache },
          databaseId
        );
        return { db, mode: 'single_tab' };
      } catch (innerErr) {
        console.warn('[Firebase] Single-tab fallback also failed, falling back to memory cache:', innerErr);
        try {
          const db = callInitializeFirestore(
            targetApp,
            { experimentalForceLongPolling: true, localCache: memoryLocalCache() },
            databaseId
          );
          return { db, mode: 'memory' };
        } catch {
          return { db: callGetFirestore(targetApp, databaseId), mode: 'memory' };
        }
      }
    }

    // Attempt memory fallback for other persistence initialization errors
    try {
      const db = callInitializeFirestore(
        targetApp,
        { experimentalForceLongPolling: true, localCache: memoryLocalCache() },
        databaseId
      );
      return { db, mode: 'memory' };
    } catch {
      return { db: callGetFirestore(targetApp, databaseId), mode: 'memory' };
    }
  }
}

try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id') {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    
    const dbResult = initFirestoreInstance(app, (firebaseConfig as any).firestoreDatabaseId);
    dbInstance = dbResult.db;
    activePersistenceMode = dbResult.mode;

    try {
      setLogLevel('silent');
    } catch {}
    authInstance = getAuth(app);
    if ((firebaseConfig as any).storageBucket) {
      storageInstance = getStorage(app);
    }
    isConfigured = true;
  }
} catch (err) {
  console.warn('[Firebase] Initialization error:', err);
  isConfigured = false;
}

export const isFirebaseAvailable = isConfigured && !!dbInstance && !!authInstance;
export const db = dbInstance as Firestore;
export const firebaseAuth = authInstance as Auth;
export const cloudStorage = storageInstance as FirebaseStorage;
export const currentFirebaseConfig = firebaseConfig;

export function isOfflineError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('the client is offline') ||
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('network-request-failed') ||
    msg.includes('token-service-api-has-not-been-used')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  if (isOfflineError(error)) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[Firestore Offline]: ${operationType} on ${path || 'database'} deferred because the client is offline: ${errorMsg}`);
    throw (error instanceof Error ? error : new Error(errorMsg));
  }

  const currentAuth = authInstance?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.uid ?? null,
      email: currentAuth?.email ?? null,
      emailVerified: currentAuth?.emailVerified ?? null,
      isAnonymous: currentAuth?.isAnonymous ?? null,
      tenantId: currentAuth?.tenantId ?? null,
      providerInfo: currentAuth?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Security/Operation Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test helper
export async function testConnection(): Promise<boolean> {
  if (!isFirebaseAvailable || !db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('[Firebase] Client is offline or backend temporarily unreachable.');
      return false;
    }
    // Permission denied on dummy doc is expected because test/connection is protected by default deny rules
    return true;
  }
}

/**
 * Specifically classifies Firestore operation errors into actionable domain categories.
 * Distinguishes between permanent offline mode (device disconnected), transient connection
 * drops (network is active but long-polling/websocket connection dropped), and persistence
 * contention ('failed-precondition').
 */
export function classifyConnectionError(error: unknown): ConnectionClassification {
  if (!error) return 'connected';
  const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);

  if (
    code === 'failed-precondition' ||
    msg.includes('failed-precondition') ||
    msg.includes('Multiple tabs open') ||
    msg.includes('persistence can only be enabled in one tab')
  ) {
    return 'failed_precondition';
  }

  if (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions')
  ) {
    return 'permission_denied';
  }

  if (
    code === 'unavailable' ||
    isOfflineError(error)
  ) {
    return isBrowserOnline ? 'transient_drop' : 'permanent_offline';
  }

  return 'unknown';
}

/**
 * Re-enables network synchronization for the Firestore instance with bounded retries.
 * Used to recover from transient connection drops without restarting the entire app.
 */
export async function reconnectNetwork(options?: { force?: boolean }): Promise<boolean> {
  if (!dbInstance) return false;
  const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  // If in permanent offline mode (no internet), do not trigger pointless network calls
  if (!isBrowserOnline && !options?.force) {
    lastKnownConnectionState = 'permanent_offline';
    return false;
  }

  try {
    await enableNetwork(dbInstance);
    lastKnownConnectionState = 'connected';
    return true;
  } catch (err: any) {
    const classification = classifyConnectionError(err);
    lastKnownConnectionState = classification;
    if (classification === 'failed_precondition') {
      console.warn('[Firebase] Persistence contention during network enable:', err?.message || err);
    }
    return false;
  }
}

export function getPersistenceMode(): PersistenceMode {
  return activePersistenceMode;
}

export function getConnectionStatus(): ConnectionClassification {
  const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isBrowserOnline) return 'permanent_offline';
  return lastKnownConnectionState;
}

/**
 * Executes a Firestore asynchronous operation with bounded exponential backoff
 * and explicit handling of 'failed-precondition' and 'unavailable' error codes.
 */
export async function executeWithFirestoreRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let delay = options.initialDelayMs ?? 400;
  const maxDelay = options.maxDelayMs ?? 2500;
  const factor = options.backoffFactor ?? 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      const classification = classifyConnectionError(err);
      if (classification === 'permanent_offline') {
        throw err;
      }
      if (classification === 'failed_precondition' || classification === 'transient_drop') {
        if (attempt < maxAttempts) {
          if (classification === 'transient_drop') {
            await reconnectNetwork().catch(() => {});
          }
          await new Promise((res) => setTimeout(res, delay));
          delay = Math.min(delay * factor, maxDelay);
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error(`[Firestore] Operation ${options.operationName || 'unknown'} exhausted ${maxAttempts} retries.`);
}
