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
import { Project, User, Asset, SaveProjectResult, ProjectCollaborator, ProjectPermission } from '../types';

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

  async getProjects(userId: string, userEmail?: string): Promise<Project[]> {
    if (!this.isAvailable() || !userId) return [];
    const path = 'projects';
    try {
      const projectsMap = new Map<string, Project>();
      const normalizedEmail = userEmail?.trim().toLowerCase();

      // Query 1: Projects owned by the user
      const qOwner = query(
        collection(db, 'projects'),
        where('userId', '==', userId)
      );
      const ownerSnapshot = await executeWithFirestoreRetry(
        () => getDocs(qOwner),
        { operationName: `getProjects:owner(${userId})` }
      );
      ownerSnapshot.forEach((docSnap) => {
        const p = docSnap.data() as Project;
        p.userPermission = 'owner';
        projectsMap.set(p.id, p);
      });

      // Query 2: Projects shared with user via email
      if (normalizedEmail) {
        try {
          const qShared = query(
            collection(db, 'projects'),
            where('memberEmails', 'array-contains', normalizedEmail)
          );
          const sharedSnapshot = await executeWithFirestoreRetry(
            () => getDocs(qShared),
            { operationName: `getProjects:shared(${normalizedEmail})` }
          );
          sharedSnapshot.forEach((docSnap) => {
            const p = docSnap.data() as Project;
            if (!projectsMap.has(p.id)) {
              if (p.userId === userId) {
                p.userPermission = 'owner';
              } else if (p.editorEmails?.includes(normalizedEmail)) {
                p.userPermission = 'editor';
              } else {
                p.userPermission = 'viewer';
              }
              projectsMap.set(p.id, p);
            }
          });
        } catch (sharedErr) {
          console.warn('[FirestoreService] Querying shared projects failed:', sharedErr);
        }
      }

      const projects = Array.from(projectsMap.values());
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
      return [];
    }
  }

  async getProject(projectId: string, userId: string, userEmail?: string): Promise<Project | null> {
    if (!this.isAvailable() || !projectId) return null;
    const path = `projects/${projectId}`;
    try {
      const snapshot = await executeWithFirestoreRetry(
        () => getDoc(doc(db, 'projects', projectId)),
        { operationName: `getProject(${projectId})` }
      );
      if (!snapshot.exists()) return null;
      const data = snapshot.data() as Project;

      const normalizedEmail = userEmail?.trim().toLowerCase();
      const isOwner = data.userId === userId;
      const isCollaborator = normalizedEmail && data.memberEmails?.includes(normalizedEmail);

      // Server-side / rule boundary: enforce user ownership or collaboration
      if (!isOwner && !isCollaborator) {
        throw new Error('Access denied: You do not have permission to view this project.');
      }

      if (isOwner) {
        data.userPermission = 'owner';
      } else if (normalizedEmail && data.editorEmails?.includes(normalizedEmail)) {
        data.userPermission = 'editor';
      } else {
        data.userPermission = 'viewer';
      }

      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn(`[FirestoreService] Client is offline; deferred getProject for ${path}`);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  }

  async inviteCollaborator(
    projectId: string,
    inviterUserId: string,
    inviterEmail: string,
    inviteeEmail: string,
    role: 'editor' | 'viewer'
  ): Promise<{ success: boolean; collaborators: ProjectCollaborator[]; error?: string }> {
    if (!this.isAvailable() || !projectId) {
      return { success: false, collaborators: [], error: 'Cloud database is unavailable.' };
    }
    const cleanEmail = inviteeEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, collaborators: [], error: 'Please provide a valid email address.' };
    }
    const cleanInviterEmail = (inviterEmail || '').trim().toLowerCase();
    if (cleanEmail === cleanInviterEmail) {
      return { success: false, collaborators: [], error: 'You are already the owner of this project.' };
    }

    try {
      const docRef = doc(db, 'projects', projectId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return { success: false, collaborators: [], error: 'Project not found.' };
      }
      const data = snapshot.data() as Project;
      if (data.userId !== inviterUserId) {
        return { success: false, collaborators: data.collaborators || [], error: 'Only the project owner can invite collaborators.' };
      }

      const existingCollaborators: ProjectCollaborator[] = data.collaborators || [];
      const filtered = existingCollaborators.filter((c) => c.email.toLowerCase() !== cleanEmail);

      const newCollaborator: ProjectCollaborator = {
        email: cleanEmail,
        role,
        invitedAt: new Date().toISOString(),
        invitedBy: cleanInviterEmail || inviterUserId,
      };
      filtered.push(newCollaborator);

      const ownerEmail = data.ownerEmail?.toLowerCase() || cleanInviterEmail;
      const memberEmails = Array.from(new Set([ownerEmail, ...filtered.map((c) => c.email.toLowerCase())])).filter(Boolean);
      const editorEmails = filtered.filter((c) => c.role === 'editor').map((c) => c.email.toLowerCase());
      const viewerEmails = filtered.filter((c) => c.role === 'viewer').map((c) => c.email.toLowerCase());

      const updatePayload = sanitizeFirestoreData({
        ownerEmail,
        collaborators: filtered,
        memberEmails,
        editorEmails,
        viewerEmails,
        updatedAt: new Date().toISOString(),
      });

      await executeWithFirestoreRetry(
        () => setDoc(docRef, updatePayload, { merge: true }),
        { operationName: `inviteCollaborator(${projectId}, ${cleanEmail})` }
      );

      return { success: true, collaborators: filtered };
    } catch (err: any) {
      console.error('[FirestoreService] Failed to invite collaborator:', err);
      return { success: false, collaborators: [], error: err?.message || 'Failed to send project invitation.' };
    }
  }

  async updateCollaboratorRole(
    projectId: string,
    ownerUserId: string,
    targetEmail: string,
    newRole: 'editor' | 'viewer'
  ): Promise<{ success: boolean; collaborators: ProjectCollaborator[]; error?: string }> {
    if (!this.isAvailable() || !projectId) {
      return { success: false, collaborators: [], error: 'Cloud database is unavailable.' };
    }
    const cleanTargetEmail = targetEmail.trim().toLowerCase();

    try {
      const docRef = doc(db, 'projects', projectId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return { success: false, collaborators: [], error: 'Project not found.' };
      }
      const data = snapshot.data() as Project;
      if (data.userId !== ownerUserId) {
        return { success: false, collaborators: data.collaborators || [], error: 'Only the project owner can change permission levels.' };
      }

      const existingCollaborators: ProjectCollaborator[] = data.collaborators || [];
      const updatedList = existingCollaborators.map((c) => {
        if (c.email.toLowerCase() === cleanTargetEmail) {
          return { ...c, role: newRole };
        }
        return c;
      });

      const ownerEmail = data.ownerEmail?.toLowerCase() || '';
      const memberEmails = Array.from(new Set([ownerEmail, ...updatedList.map((c) => c.email.toLowerCase())])).filter(Boolean);
      const editorEmails = updatedList.filter((c) => c.role === 'editor').map((c) => c.email.toLowerCase());
      const viewerEmails = updatedList.filter((c) => c.role === 'viewer').map((c) => c.email.toLowerCase());

      const updatePayload = sanitizeFirestoreData({
        collaborators: updatedList,
        memberEmails,
        editorEmails,
        viewerEmails,
        updatedAt: new Date().toISOString(),
      });

      await executeWithFirestoreRetry(
        () => setDoc(docRef, updatePayload, { merge: true }),
        { operationName: `updateCollaboratorRole(${projectId}, ${cleanTargetEmail})` }
      );

      return { success: true, collaborators: updatedList };
    } catch (err: any) {
      console.error('[FirestoreService] Failed to update collaborator role:', err);
      return { success: false, collaborators: [], error: err?.message || 'Failed to update collaborator role.' };
    }
  }

  async removeCollaborator(
    projectId: string,
    ownerUserId: string,
    targetEmail: string
  ): Promise<{ success: boolean; collaborators: ProjectCollaborator[]; error?: string }> {
    if (!this.isAvailable() || !projectId) {
      return { success: false, collaborators: [], error: 'Cloud database is unavailable.' };
    }
    const cleanTargetEmail = targetEmail.trim().toLowerCase();

    try {
      const docRef = doc(db, 'projects', projectId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return { success: false, collaborators: [], error: 'Project not found.' };
      }
      const data = snapshot.data() as Project;
      if (data.userId !== ownerUserId) {
        return { success: false, collaborators: data.collaborators || [], error: 'Only the project owner can revoke project access.' };
      }

      const existingCollaborators: ProjectCollaborator[] = data.collaborators || [];
      const filtered = existingCollaborators.filter((c) => c.email.toLowerCase() !== cleanTargetEmail);

      const ownerEmail = data.ownerEmail?.toLowerCase() || '';
      const memberEmails = Array.from(new Set([ownerEmail, ...filtered.map((c) => c.email.toLowerCase())])).filter(Boolean);
      const editorEmails = filtered.filter((c) => c.role === 'editor').map((c) => c.email.toLowerCase());
      const viewerEmails = filtered.filter((c) => c.role === 'viewer').map((c) => c.email.toLowerCase());

      const updatePayload = sanitizeFirestoreData({
        collaborators: filtered,
        memberEmails,
        editorEmails,
        viewerEmails,
        updatedAt: new Date().toISOString(),
      });

      await executeWithFirestoreRetry(
        () => setDoc(docRef, updatePayload, { merge: true }),
        { operationName: `removeCollaborator(${projectId}, ${cleanTargetEmail})` }
      );

      return { success: true, collaborators: filtered };
    } catch (err: any) {
      console.error('[FirestoreService] Failed to remove collaborator:', err);
      return { success: false, collaborators: [], error: err?.message || 'Failed to revoke collaborator access.' };
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
      return [];
    }
  }
}

export const firestoreService = new FirestoreService();
