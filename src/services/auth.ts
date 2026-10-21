import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseAvailable } from './firebase';
import { firestoreService } from './firestoreService';
import { User, UserPreferences } from '../types';

const AUTH_USER_KEY = 'obido_studio_auth_user_v1';
const REGISTERED_USERS_KEY = 'obido_studio_registered_users_v1';

// Seed demo users for local fallback / testing
const INITIAL_DEMO_USERS: User[] = [
  {
    id: 'user_demo_creator',
    name: 'Sarah Chen',
    email: 'creator@obidostudio.com',
    role: 'creator',
    tier: 'pro',
    authType: 'local_demo',
    hasCompletedOnboarding: true,
    preferences: {
      useCase: 'content_creation',
      experienceLevel: 'intermediate',
      language: 'en',
    },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'user_default',
    name: 'Demo Director',
    email: 'demo@obidostudio.com',
    role: 'creator',
    tier: 'studio',
    authType: 'local_demo',
    hasCompletedOnboarding: true,
    preferences: {
      useCase: 'business',
      experienceLevel: 'advanced',
      language: 'en',
    },
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
];

class AuthService {
  private currentUser: User | null = null;
  private listeners: Array<() => void> = [];
  private isAuthReady = false;

  constructor() {
    this.init();
  }

  private init() {
    if (isFirebaseAvailable && firebaseAuth) {
      // Real Firebase Auth listener
      onAuthStateChanged(firebaseAuth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          await this.syncFirebaseUser(fbUser);
        } else {
          // If no active Firebase user, check if local demo session is active
          const sessionUser = localStorage.getItem(AUTH_USER_KEY);
          if (sessionUser) {
            try {
              const parsed = JSON.parse(sessionUser);
              if (parsed.authType === 'local_demo') {
                this.currentUser = parsed;
              } else {
                this.currentUser = null;
                localStorage.removeItem(AUTH_USER_KEY);
              }
            } catch {
              this.currentUser = null;
            }
          } else {
            this.currentUser = null;
          }
        }
        this.isAuthReady = true;
        this.notify();
      });
    } else {
      // Local development fallback
      try {
        const storedUsers = localStorage.getItem(REGISTERED_USERS_KEY);
        if (!storedUsers) {
          localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
        }
        const sessionUser = localStorage.getItem(AUTH_USER_KEY);
        if (sessionUser) {
          this.currentUser = JSON.parse(sessionUser);
        }
      } catch (e) {
        console.warn('AuthService fallback init error', e);
      }
      this.isAuthReady = true;
    }
  }

  private async syncFirebaseUser(fbUser: FirebaseUser): Promise<User> {
    const existing = await firestoreService.getUserProfile(fbUser.uid);
    let appUser: User;

    if (existing) {
      appUser = {
        ...existing,
        id: fbUser.uid,
        email: fbUser.email || existing.email,
        name: fbUser.displayName || existing.name || 'Studio Creator',
        avatar: fbUser.photoURL || existing.avatar,
        authType: 'cloud',
        firebaseUid: fbUser.uid,
        lastLoginAt: new Date().toISOString(),
      };
    } else {
      appUser = {
        id: fbUser.uid,
        name: fbUser.displayName || (fbUser.email?.split('@')[0] ?? 'Studio Creator'),
        email: fbUser.email || '',
        role: 'creator',
        tier: 'pro',
        authType: 'cloud',
        firebaseUid: fbUser.uid,
        avatar: fbUser.photoURL || undefined,
        hasCompletedOnboarding: false,
        preferences: {
          useCase: 'content_creation',
          experienceLevel: 'intermediate',
          language: 'en',
        },
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      // Persist new user profile to Firestore
      await firestoreService.saveUserProfile(appUser);
    }

    this.currentUser = appUser;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
    return appUser;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  isReady(): boolean {
    return this.isAuthReady;
  }

  isFirebaseConfigured(): boolean {
    return isFirebaseAvailable;
  }

  async getIdToken(): Promise<string | null> {
    if (isFirebaseAvailable && firebaseAuth && firebaseAuth.currentUser) {
      return await firebaseAuth.currentUser.getIdToken();
    }
    return null;
  }

  async signIn(email: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // If Firebase Auth is available, execute real cloud authentication
    if (isFirebaseAvailable && firebaseAuth) {
      try {
        if (!password) {
          return { success: false, error: 'Password is required for cloud authentication.' };
        }
        const userCred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
        const user = await this.syncFirebaseUser(userCred.user);
        this.notify();
        return { success: true, user };
      } catch (err: any) {
        console.error('[Firebase Auth] Sign in error:', err.code, err.message);
        let errorMsg = 'Failed to sign in. Please verify your credentials.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errorMsg = 'Invalid email or password. If you do not have an account, please sign up.';
        } else if (err.code === 'auth/too-many-requests') {
          errorMsg = 'Too many failed login attempts. Please reset your password or try again later.';
        }
        return { success: false, error: errorMsg };
      }
    }

    // Local demo sandbox fallback
    await new Promise((res) => setTimeout(res, 300));
    const demoUser = INITIAL_DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    if (demoUser) {
      this.currentUser = { ...demoUser, lastLoginAt: new Date().toISOString() };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      this.notify();
      return { success: true, user: this.currentUser };
    }

    const fallbackUser: User = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      role: 'creator',
      tier: 'free',
      authType: 'local_demo',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = fallbackUser;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser));
    this.notify();
    return { success: true, user: fallbackUser };
  }

  async signUp(name: string, email: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      return { success: false, error: 'Please provide your full name or creator handle.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // Real Firebase Auth user registration
    if (isFirebaseAvailable && firebaseAuth) {
      try {
        const userCred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
        await updateProfile(userCred.user, { displayName: cleanName });
        const user = await this.syncFirebaseUser(userCred.user);
        this.notify();
        return { success: true, user };
      } catch (err: any) {
        console.error('[Firebase Auth] Sign up error:', err.code, err.message);
        let errorMsg = 'Failed to create account.';
        if (err.code === 'auth/email-already-in-use') {
          errorMsg = 'An account with this email already exists. Please sign in instead.';
        } else if (err.code === 'auth/weak-password') {
          errorMsg = 'The password is too weak. Please use at least 6 characters.';
        }
        return { success: false, error: errorMsg };
      }
    }

    // Local demo fallback
    const newUser: User = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      email: cleanEmail,
      role: 'creator',
      tier: 'free',
      authType: 'local_demo',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = newUser;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    this.notify();
    return { success: true, user: newUser };
  }

  async signInWithGoogle(): Promise<{ success: boolean; user?: User; error?: string }> {
    if (isFirebaseAvailable && firebaseAuth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(firebaseAuth, provider);
        const user = await this.syncFirebaseUser(result.user);
        this.notify();
        return { success: true, user };
      } catch (err: any) {
        console.error('[Firebase Auth] Google Sign-In error:', err.code, err.message);
        if (err.code === 'auth/popup-closed-by-user') {
          return { success: false, error: 'Google sign-in was closed before completion.' };
        }
        return { success: false, error: err.message || 'Google sign-in failed.' };
      }
    }

    // Local demo fallback
    const googleUser: User = {
      id: 'user_google_' + Date.now().toString(36),
      name: 'Google Creator',
      email: 'creator@google.com',
      role: 'creator',
      tier: 'pro',
      authType: 'local_demo',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = googleUser;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(googleUser));
    this.notify();
    return { success: true, user: googleUser };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    if (isFirebaseAvailable && firebaseAuth) {
      try {
        await sendPasswordResetEmail(firebaseAuth, cleanEmail);
        return {
          success: true,
          message: `Official password recovery email dispatched to ${cleanEmail}. Check your inbox.`,
        };
      } catch (err: any) {
        console.error('[Firebase Auth] Password reset error:', err.code, err.message);
        return {
          success: false,
          message: err.message || 'Failed to dispatch password recovery email.',
        };
      }
    }

    return {
      success: true,
      message: `Password reset instructions sent to ${cleanEmail}. (Local sandbox simulation).`,
    };
  }

  async completeOnboarding(preferences: UserPreferences): Promise<User | null> {
    if (!this.currentUser) return null;

    const updatedUser: User = {
      ...this.currentUser,
      hasCompletedOnboarding: true,
      preferences: {
        ...this.currentUser.preferences,
        ...preferences,
      },
    };

    if (this.currentUser.authType === 'cloud' && isFirebaseAvailable) {
      await firestoreService.saveUserProfile(updatedUser);
    }

    this.currentUser = updatedUser;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    this.notify();
    return updatedUser;
  }

  async signOut() {
    if (isFirebaseAvailable && firebaseAuth) {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (err) {
        console.warn('Firebase sign-out error:', err);
      }
    }
    this.currentUser = null;
    localStorage.removeItem(AUTH_USER_KEY);
    this.notify();
  }
}

export const auth = new AuthService();
