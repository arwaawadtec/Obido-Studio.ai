import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  db,
  isFirebaseAvailable,
  handleFirestoreError,
  isOfflineError,
  classifyConnectionError,
  reconnectNetwork,
  getConnectionStatus,
  getPersistenceMode,
  executeWithFirestoreRetry,
  OperationType,
  ConnectionClassification,
} from './firebase';
import { Project, User, Asset, SaveProjectResult } from '../types';

export type ProfileReadStatus = 'found' | 'not_found' | 'unavailable';

export interface UserProfileResult {
  status: ProfileReadStatus;
  user?: User;
  source?: 'server' | 'cache';
  reason?: string;
  error?: unknown;
}

/**
 * Recursively sanitizes data before writing to Cloud Firestore.
 * Removes all properties whose values are `undefined`, as Firestore
 * rejects documents containing `undefined` with "Function setDoc() called with invalid data. Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }

  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }

  if (typeof val === 'object') {
    // Preserve Date instances, Firestore server timestamps or field values if any
    if (val instanceof Date || (val as any).constructor?.name === 'FieldValue') {
      return val;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(val)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeFirestoreData(value);
      }
    }
    return cleanObj as T;
  }

  return val;
}

export class FirestoreService {
  isAvailable(): boolean {
    return isFirebaseAvailable && !!db;
  }

  // --- User Profiles ---
  async saveUserProfile(user: User): Promise<void> {
    if (!this.isAvailable()) return;
    const path = `users/${user.id}`;
    try {
      const sanitizedUser: Record<string, any> = {
        id: user.id,
        name: user.name || 'Creator',
        email: user.email,
        role: user.role || 'creator',
        tier: user.tier || 'free',
        hasCompletedOnboarding: !!user.hasCompletedOnboarding,
        preferences: sanitizeFirestoreData(user.preferences || {}),
        createdAt: user.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      if (user.avatar) {
        sanitizedUser.avatar = user.avatar;
      }
      const cleanPayload = sanitizeFirestoreData(sanitizedUser);
      await executeWithFirestoreRetry(
        () => setDoc(doc(db, 'users', user.id), cleanPayload, { merge: true }),
        { operationName: `saveUserProfile(${user.id})` }
      );
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred profile write for ${path}`);
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getUserProfileWithStatus(userId: string): Promise<UserProfileResult> {
    if (!this.isAvailable() || !userId) {
      return { status: 'unavailable', reason: 'Firestore is not initialized or unavailable' };
    }
    const path = `users/${userId}`;
    const docRef = doc(db, 'users', userId);

    const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

    // --- 1. Immediate Cache Read ---
    // In browser with persistence enabled, reading from cache takes <2ms and prevents network delay
    try {
      const cacheSnap = await getDocFromCache(docRef);
      if (cacheSnap.exists()) {
        return {
          status: 'found',
          user: cacheSnap.data() as User,
          source: 'cache',
          reason: 'cached_profile_instant_read',
        };
      }
    } catch {}

    // --- 2. Permanent Offline Mode ---
    if (!isBrowserOnline) {
      return {
        status: 'unavailable',
        reason: 'permanent_offline',
      };
    }

    // --- 3. Online Mode with Exponential Backoff Persistence Retry ---
    const maxAttempts = 3;
    const retryDelays = [400, 1200];
    let lastOfflineError: unknown = null;
    let hadPersistenceContention = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // getDoc allows connection handshake negotiation and serves directly
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { status: 'not_found' };
        }
        return {
          status: 'found',
          user: snapshot.data() as User,
          source: snapshot.metadata?.fromCache ? 'cache' : 'server',
        };
      } catch (error: any) {
        const classification = classifyConnectionError(error);

        // Case A: 'failed-precondition' (e.g. multi-tab lock / persistence contention)
        if (classification === 'failed_precondition') {
          hadPersistenceContention = true;
          // Attempt immediate read from cache under multi-tab contention
          try {
            const cacheSnap = await getDocFromCache(docRef);
            if (cacheSnap.exists()) {
              return {
                status: 'found',
                user: cacheSnap.data() as User,
                source: 'cache',
                reason: 'failed_precondition_cache_fallback',
              };
            }
          } catch {}

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt - 1] || 500));
            continue;
          }

          return {
            status: 'unavailable',
            reason: 'failed_precondition',
            error,
          };
        }

        // Case B: 'transient_drop' (temporary network drop, handshake latency, 'unavailable')
        if (classification === 'transient_drop') {
          lastOfflineError = error;
          if (attempt < maxAttempts) {
            await reconnectNetwork().catch(() => {});
            const delay = retryDelays[attempt - 1] || 800;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          break;
        }

        // Case C: 'permission_denied' or permanent configuration error
        const errorCode = error?.code || (error instanceof Error ? error.message : String(error));
        return {
          status: 'unavailable',
          reason: errorCode,
          error,
        };
      }
    }

    // Fallback: Check if local cache has the profile before declaring unavailable
    try {
      const cacheSnap = await getDocFromCache(docRef);
      if (cacheSnap.exists()) {
        return {
          status: 'found',
          user: cacheSnap.data() as User,
          source: 'cache',
          reason: 'transient_drop_served_from_cache',
        };
      }
    } catch {}

    return {
      status: 'unavailable',
      reason: hadPersistenceContention ? 'failed_precondition' : 'transient_drop',
      error: lastOfflineError,
    };
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const result = await this.getUserProfileWithStatus(userId);
    if (result.status === 'found' && result.user) {
      return result.user;
    }
    return null;
  }

  // --- Projects ---
  async saveProject(project: Project, userId: string): Promise<SaveProjectResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        syncStatus: 'failed',
        source: 'cache_queued',
        error: new Error('Cloud database is not available.'),
      };
    }
    const path = `projects/${project.id}`;
    try {
      const payload: Project = sanitizeFirestoreData({
        ...project,
        userId,
        isLocalOnly: false,
        cloudSyncStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
      });
      await executeWithFirestoreRetry(
        () => setDoc(doc(db, 'projects', project.id), payload, { merge: true }),
        { operationName: `saveProject(${project.id})` }
      );
      return {
        success: true,
        syncStatus: 'synced',
        source: 'server',
      };
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; queued project write for ${path}`);
        return {
          success: false,
          syncStatus: 'pending',
          source: 'cache_queued',
          error,
        };
      }
      handleFirestoreError(error, OperationType.WRITE, path);
      return {
        success: false,
        syncStatus: 'failed',
        source: 'cache_queued',
        error,
      };
    }
  }

  async getProjects(userId: string): Promise<Project[]> {
    if (!this.isAvailable() || !userId) return [];
    const path = 'projects';
    try {
      // Query enforces owner isolation matching security rules
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', userId)
      );
      const snapshot = await executeWithFirestoreRetry(
        () => getDocs(q),
        { operationName: `getProjects(${userId})` }
      );
      const projects: Project[] = [];
      snapshot.forEach((docSnap) => {
        projects.push(docSnap.data() as Project);
      });
      // Sort client-side by updatedAt descending
      return projects.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred getProjects for ${path}`);
        return [];
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async getProject(projectId: string, userId: string): Promise<Project | null> {
    if (!this.isAvailable() || !projectId) return null;
    const path = `projects/${projectId}`;
    try {
      const snapshot = await executeWithFirestoreRetry(
        () => getDoc(doc(db, 'projects', projectId)),
        { operationName: `getProject(${projectId})` }
      );
      if (!snapshot.exists()) return null;
      const data = snapshot.data() as Project;
      // Server-side / rule boundary: enforce user ownership
      if (data.userId !== userId) {
        throw new Error('Access denied: You do not have permission to view this project.');
      }
      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred getProject for ${path}`);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    if (!this.isAvailable() || !projectId) return;
    const path = `projects/${projectId}`;
    try {
      // Check ownership before deletion
      const snapshot = await getDoc(doc(db, 'projects', projectId));
      if (snapshot.exists()) {
        const data = snapshot.data() as Project;
        if (data.userId !== userId) {
          throw new Error('Access denied: Cannot delete a project owned by another user.');
        }
      }
      await executeWithFirestoreRetry(
        () => deleteDoc(doc(db, 'projects', projectId)),
        { operationName: `deleteProject(${projectId})` }
      );
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred deleteProject for ${path}`);
        return;
      }
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  // --- Assets ---
  async saveAsset(asset: Asset, userId: string): Promise<void> {
    if (!this.isAvailable()) return;
    const path = `assets/${asset.id}`;
    try {
      const payload: Asset & { userId: string } = sanitizeFirestoreData({
        ...asset,
        userId,
      });
      await setDoc(doc(db, 'assets', asset.id), payload, { merge: true });
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred saveAsset for ${path}`);
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getProjectAssets(projectId: string, userId: string): Promise<Asset[]> {
    if (!this.isAvailable() || !projectId) return [];
    const path = 'assets';
    try {
      const q = query(
        collection(db, 'assets'),
        where('projectId', '==', projectId),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const assets: Asset[] = [];
      snapshot.forEach((d) => assets.push(d.data() as Asset));
      return assets;
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred getProjectAssets for ${path}`);
        return [];
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
}

export const firestoreService = new FirestoreService();
