import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
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

try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id') {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    // Critical: The app will break without using firestoreDatabaseId per skill instructions
    dbInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
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
    code === 'failed-precondition' ||
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

// Connection test on boot per skill instructions
export async function testConnection(): Promise<boolean> {
  if (!isFirebaseAvailable || !db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline or database unreachable. Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on dummy doc is normal since test/connection is protected by default deny
    return true;
  }
}

// Run test on load if configured
if (isFirebaseAvailable) {
  testConnection().catch(() => {});
}
