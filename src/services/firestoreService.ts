import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, isFirebaseAvailable, handleFirestoreError, OperationType } from './firebase';
import { Project, User, Asset } from '../types';

export class FirestoreService {
  isAvailable(): boolean {
    return isFirebaseAvailable && !!db;
  }

  // --- User Profiles ---
  async saveUserProfile(user: User): Promise<void> {
    if (!this.isAvailable()) return;
    const path = `users/${user.id}`;
    try {
      const sanitizedUser: Partial<User> = {
        id: user.id,
        name: user.name || 'Creator',
        email: user.email,
        role: user.role || 'creator',
        tier: user.tier || 'free',
        hasCompletedOnboarding: !!user.hasCompletedOnboarding,
        preferences: user.preferences || {},
        createdAt: user.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.id), sanitizedUser, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getUserProfile(userId: string): Promise<User | null> {
    if (!this.isAvailable() || !userId) return null;
    const path = `users/${userId}`;
    try {
      const snapshot = await getDoc(doc(db, 'users', userId));
      if (!snapshot.exists()) return null;
      return snapshot.data() as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // --- Projects ---
  async saveProject(project: Project, userId: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Cloud database is not available.');
    }
    const path = `projects/${project.id}`;
    try {
      const payload: Project = {
        ...project,
        userId,
        isLocalOnly: false,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'projects', project.id), payload, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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
      const snapshot = await getDocs(q);
      const projects: Project[] = [];
      snapshot.forEach((docSnap) => {
        projects.push(docSnap.data() as Project);
      });
      // Sort client-side by updatedAt descending
      return projects.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async getProject(projectId: string, userId: string): Promise<Project | null> {
    if (!this.isAvailable() || !projectId) return null;
    const path = `projects/${projectId}`;
    try {
      const snapshot = await getDoc(doc(db, 'projects', projectId));
      if (!snapshot.exists()) return null;
      const data = snapshot.data() as Project;
      // Server-side / rule boundary: enforce user ownership
      if (data.userId !== userId) {
        throw new Error('Access denied: You do not have permission to view this project.');
      }
      return data;
    } catch (error) {
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
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  // --- Assets ---
  async saveAsset(asset: Asset, userId: string): Promise<void> {
    if (!this.isAvailable()) return;
    const path = `assets/${asset.id}`;
    try {
      const payload: Asset & { userId: string } = {
        ...asset,
        userId,
      };
      await setDoc(doc(db, 'assets', asset.id), payload, { merge: true });
    } catch (error) {
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
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
}

export const firestoreService = new FirestoreService();
