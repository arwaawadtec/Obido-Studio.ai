import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  ActionCodeSettings,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseAvailable } from './firebase';
import { firestoreService, UserProfileResult } from './firestoreService';
import { User, UserPreferences } from '../types';
import { AppError, AuthActionResult } from '../types/error';
import { mapFirebaseError, createAppError } from './errorService';
import { storage } from './storage';

const AUTH_USER_KEY = 'obido_studio_auth_user_v1';
const REGISTERED_USERS_KEY = 'obido_studio_registered_users_v1';

// In-memory fallback map when running under Node test environment
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(key);
  },
};

// Seed demo users for local fallback / testing
export const INITIAL_DEMO_USERS: User[] = [
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
  private syncEpoch = 0;
  private pendingSyncUid: string | null = null;
  private hasPendingProfileSync = false;
  private reconnectionListenersRegistered = false;
  private activeSyncPromise: Promise<User> | null = null;
  private lastReconnectSyncTimestamp = 0;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Synchronously restore session user from safeStorage to prevent route flicker on startup
    try {
      const sessionUser = safeStorage.getItem(AUTH_USER_KEY);
      if (sessionUser) {
        this.currentUser = JSON.parse(sessionUser);
      }
    } catch {
      this.currentUser = null;
    }

    // 2. Multi-tab synchronization: listen for storage events from other browser tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === AUTH_USER_KEY) {
          if (!event.newValue) {
            // Another tab signed out: synchronize state immediately
            if (this.currentUser) {
              const prevId = this.currentUser.id;
              this.currentUser = null;
              try {
                storage.handleUserSignOut(prevId);
              } catch {}
              this.notify();
            }
          } else {
            // Another tab signed in: adopt new user session
            try {
              const newUser = JSON.parse(event.newValue);
              this.currentUser = newUser;
              this.notify();
            } catch {}
          }
        }
      });

      // 3. Reconnection & Visibility recovery listeners
      this.registerReconnectionListeners();
    }

    if (isFirebaseAvailable && firebaseAuth) {
      // Real Firebase Auth listener
      onAuthStateChanged(firebaseAuth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          await this.syncFirebaseUser(fbUser);
        } else {
          // If no active Firebase user, check if local demo session is active
          const sessionUser = safeStorage.getItem(AUTH_USER_KEY);
          if (sessionUser) {
            try {
              const parsed = JSON.parse(sessionUser);
              if (parsed.authType === 'local_demo') {
                this.currentUser = parsed;
              } else {
                this.currentUser = null;
                safeStorage.removeItem(AUTH_USER_KEY);
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
        const storedUsers = safeStorage.getItem(REGISTERED_USERS_KEY);
        if (!storedUsers) {
          safeStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
        }
        const sessionUser = safeStorage.getItem(AUTH_USER_KEY);
        if (sessionUser) {
          this.currentUser = JSON.parse(sessionUser);
        }
      } catch (e) {
        console.warn('AuthService fallback init error', e);
      }
      this.isAuthReady = true;
    }
  }

  /**
   * Safely synchronizes a Firebase user into application state.
   * Guarantees:
   * 1. No synthetic overwrite: Never persists default profile if remote read was unavailable or offline.
   * 2. Explicit read outcomes: Distinguishes confirmed missing document ('not_found') from failed read ('unavailable').
   * 3. Safe profile creation: Persists default profile ONLY when document absence is positively confirmed.
   * 4. Race protection: Discards stale sync epochs and checks target UID match before updating state.
   * 5. Cache integrity: Strictly verifies cached profile belongs to the authenticated UID.
   */
  private async syncFirebaseUser(fbUser: FirebaseUser): Promise<User> {
    const targetUid = fbUser.uid;
    if (this.activeSyncPromise && this.pendingSyncUid === targetUid) {
      return this.activeSyncPromise;
    }

    const currentEpoch = ++this.syncEpoch;
    this.pendingSyncUid = targetUid;

    const syncWork = async (): Promise<User> => {
      let readResult: UserProfileResult;
      try {
        readResult = await firestoreService.getUserProfileWithStatus(targetUid);
      } catch (e) {
        console.warn('[AuthService] Firestore profile retrieval unexpected failure:', e);
        readResult = { status: 'unavailable', reason: 'exception', error: e };
      }

      // Race protection check: if a new sync started or UID changed while awaiting, abort
      if (this.syncEpoch !== currentEpoch || this.pendingSyncUid !== targetUid) {
        console.info(`[AuthService] Sync callback for ${targetUid} discarded (epoch ${currentEpoch} superseded)`);
        return this.currentUser!;
      }

      let appUser: User;

      if (readResult.status === 'found' && readResult.user) {
        // --- CASE A: Confirmed Existing Profile in Firestore ---
        this.hasPendingProfileSync = false;
        const existing = readResult.user;
        appUser = {
          ...existing,
          id: targetUid,
          email: fbUser.email || existing.email,
          name: fbUser.displayName || existing.name || 'Studio Creator',
          avatar: fbUser.photoURL || existing.avatar,
          authType: 'cloud',
          firebaseUid: targetUid,
          lastLoginAt: new Date().toISOString(),
        };
      } else if (readResult.status === 'not_found') {
        // --- CASE B: Confirmed Absence of Profile Document ---
        // Positively established that document does not exist. Safe to create and persist default profile.
        this.hasPendingProfileSync = false;
        appUser = {
          id: targetUid,
          name: fbUser.displayName || (fbUser.email?.split('@')[0] ?? 'Studio Creator'),
          email: fbUser.email || '',
          role: 'creator',
          tier: 'pro',
          authType: 'cloud',
          firebaseUid: targetUid,
          ...(fbUser.photoURL ? { avatar: fbUser.photoURL } : {}),
          hasCompletedOnboarding: false,
          preferences: {
            useCase: 'content_creation',
            experienceLevel: 'intermediate',
            language: 'en',
          },
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        try {
          await firestoreService.saveUserProfile(appUser);
        } catch (saveErr) {
          console.warn('[AuthService] Initial user profile cloud save deferred:', saveErr);
        }
      } else {
        // --- CASE C: Read Unavailable (Client offline, network timeout, or unresolved) ---
        // CRITICAL: NEVER call firestoreService.saveUserProfile()! Do NOT persist default data!
        this.hasPendingProfileSync = true;

        // Check cache strictly for targetUid
        let matchingCache: User | null = null;
        if (this.currentUser && (this.currentUser.id === targetUid || this.currentUser.firebaseUid === targetUid)) {
          matchingCache = this.currentUser;
        } else {
          try {
            const cachedRaw = safeStorage.getItem(AUTH_USER_KEY);
            if (cachedRaw) {
              const parsed = JSON.parse(cachedRaw);
              if (parsed && (parsed.id === targetUid || parsed.firebaseUid === targetUid)) {
                matchingCache = parsed;
              }
            }
          } catch (cacheErr) {
            console.warn('[AuthService] Failed to read cached profile:', cacheErr);
          }
        }

        if (matchingCache) {
          // Provisional session adopting cached state
          appUser = {
            ...matchingCache,
            id: targetUid,
            email: fbUser.email || matchingCache.email,
            name: fbUser.displayName || matchingCache.name || 'Studio Creator',
            avatar: fbUser.photoURL || matchingCache.avatar,
            authType: 'cloud',
            firebaseUid: targetUid,
          };
        } else {
          // Ephemeral in-memory fallback for user session without overwriting cloud data
          appUser = {
            id: targetUid,
            name: fbUser.displayName || (fbUser.email?.split('@')[0] ?? 'Studio Creator'),
            email: fbUser.email || '',
            role: 'creator',
            tier: 'pro',
            authType: 'cloud',
            firebaseUid: targetUid,
            ...(fbUser.photoURL ? { avatar: fbUser.photoURL } : {}),
            hasCompletedOnboarding: false,
            preferences: {
              useCase: 'content_creation',
              experienceLevel: 'intermediate',
              language: 'en',
            },
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
          // NOTE: NO saveUserProfile is called!
        }
      }

      // Final epoch guard before committing state
      if (this.syncEpoch !== currentEpoch || this.pendingSyncUid !== targetUid) {
        console.info(`[AuthService] Stale auth sync callback aborted during commit for ${targetUid}`);
        return this.currentUser!;
      }

      this.currentUser = appUser;
      safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
      try {
        storage.restoreUserUnsyncedDrafts(appUser.id);
      } catch {}
      return appUser;
    };

    this.activeSyncPromise = syncWork().finally(() => {
      this.activeSyncPromise = null;
    });

    return this.activeSyncPromise;
  }

  /**
   * Retries profile synchronization when connectivity is restored or tab regains visibility.
   * Debounced to prevent rapid-fire redundant calls when multiple visibility/focus events fire.
   */
  async retryProfileSyncOnReconnect(): Promise<void> {
    const currentFbUser =
      isFirebaseAvailable && firebaseAuth?.currentUser
        ? firebaseAuth.currentUser
        : (firebaseAuth as any)?.currentUser || null;
    if (!currentFbUser) return;

    if (!this.hasPendingProfileSync) return;

    // Concurrency guard: if a sync is currently in-flight, await it instead of launching duplicate
    if (this.activeSyncPromise) {
      await this.activeSyncPromise.catch(() => {});
      return;
    }

    // Rate-limiting debounce: minimum 3000ms between reconnect retries
    const now = Date.now();
    if (now - this.lastReconnectSyncTimestamp < 3000) {
      return;
    }
    this.lastReconnectSyncTimestamp = now;

    try {
      await this.syncFirebaseUser(currentFbUser);
      this.notify();
    } catch (err) {
      console.warn('[AuthService] Reconnection profile sync deferred:', err);
    }
  }

  public registerReconnectionListeners(): void {
    if (this.reconnectionListenersRegistered) return;
    if (typeof window !== 'undefined') {
      this.reconnectionListenersRegistered = true;
      window.addEventListener('online', () => {
        this.retryProfileSyncOnReconnect();
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.hasPendingProfileSync) {
            this.retryProfileSyncOnReconnect();
          }
        });
      }
    }
  }

  hasPendingSync(): boolean {
    return this.hasPendingProfileSync;
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
      try {
        const token = await firebaseAuth.currentUser.getIdToken();
        if (token) return token;
      } catch (tokenErr: any) {
        console.error(
          '[AuthService] Firebase getIdToken failed (ensure securetoken.googleapis.com is enabled in Google Cloud Console):',
          tokenErr?.code || tokenErr?.message
        );
        throw tokenErr;
      }
    }
    if (this.currentUser && this.currentUser.authType === 'local_demo') {
      return `demo_token_${this.currentUser.id}`;
    }
    return null;
  }

  async signIn(
    email: string,
    password?: string,
    options: { forceSandbox?: boolean } = {}
  ): Promise<AuthActionResult<User>> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      const appErr = createAppError({
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
        field: 'email',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Email address validation',
        whereFailed: 'Sign-in form email input',
        whyFailed: 'The provided email address does not have a valid format.',
        whatToDoNext: 'Check for typos and enter a complete address (e.g. name@domain.com).',
      });
      return { success: false, error: appErr, errorMessage: appErr.message };
    }

    // Force sandbox mode if requested
    if (options.forceSandbox || !isFirebaseAvailable || !firebaseAuth) {
      return this.executeLocalSandboxSignIn(cleanEmail);
    }

    // Real Firebase Auth
    try {
      if (!password) {
        const appErr = createAppError({
          code: 'MISSING_PASSWORD',
          message: 'Password is required to sign in.',
          field: 'password',
          stage: 'auth',
          retryable: true,
          whatFailed: 'Password authentication check',
          whereFailed: 'Sign-in form password field',
          whyFailed: 'Password input was left empty.',
          whatToDoNext: 'Enter your password to sign in.',
        });
        return { success: false, error: appErr, errorMessage: appErr.message };
      }

      const userCred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      const user = await this.syncFirebaseUser(userCred.user);
      this.notify();
      return { success: true, user };
    } catch (err: any) {
      console.error('[Firebase Auth] Sign in error:', err.code, err.message);
      const appErr = mapFirebaseError(err, {
        stage: 'auth',
        field: 'password',
        operation: 'User Sign In',
        email: cleanEmail,
      });
      return {
        success: false,
        error: appErr,
        errorMessage: appErr.message,
      };
    }
  }

  async signUp(
    name: string,
    email: string,
    password?: string,
    options: { forceSandbox?: boolean } = {}
  ): Promise<AuthActionResult<User>> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      const appErr = createAppError({
        code: 'MISSING_NAME',
        message: 'Please provide your full name or creator handle.',
        field: 'name',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Creator name validation',
        whereFailed: 'Registration form name input',
        whyFailed: 'The name or handle field was submitted empty.',
        whatToDoNext: 'Enter your name or creator handle to personalize your workspace.',
      });
      return { success: false, error: appErr, errorMessage: appErr.message };
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      const appErr = createAppError({
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
        field: 'email',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Email address validation',
        whereFailed: 'Registration form email input',
        whyFailed: 'The provided email address does not have a valid format.',
        whatToDoNext: 'Check for typos and enter a valid email address.',
      });
      return { success: false, error: appErr, errorMessage: appErr.message };
    }

    if (!password || password.length < 6) {
      const appErr = createAppError({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters.',
        field: 'password',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Password security validation',
        whereFailed: 'Registration form password input',
        whyFailed: 'The entered password is shorter than 6 characters.',
        whatToDoNext: 'Enter a password with 6 or more characters and retry.',
      });
      return { success: false, error: appErr, errorMessage: appErr.message };
    }

    // Force sandbox mode if requested
    if (options.forceSandbox || !isFirebaseAvailable || !firebaseAuth) {
      return this.executeLocalSandboxSignUp(cleanName, cleanEmail);
    }

    // Real Firebase Auth user registration
    try {
      const userCred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      try {
        await updateProfile(userCred.user, { displayName: cleanName });
      } catch (profileErr) {
        console.warn('[Firebase Auth] Display name update deferred:', profileErr);
      }
      const user = await this.syncFirebaseUser(userCred.user);
      this.notify();
      return { success: true, user };
    } catch (err: any) {
      console.error('[Firebase Auth] Sign up error:', err.code, err.message);
      const appErr = mapFirebaseError(err, {
        stage: 'auth',
        field: err.code === 'auth/weak-password' ? 'password' : 'email',
        operation: 'Account Registration',
        email: cleanEmail,
      });
      return {
        success: false,
        error: appErr,
        errorMessage: appErr.message,
      };
    }
  }

  async signInWithGoogle(): Promise<AuthActionResult<User>> {
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
        const appErr = mapFirebaseError(err, {
          stage: 'auth',
          operation: 'Google OAuth Sign In',
        });
        return { success: false, error: appErr, errorMessage: appErr.message };
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
    safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(googleUser));
    this.notify();
    return { success: true, user: googleUser };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; error?: AppError }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      const appErr = createAppError({
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
        field: 'email',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Password recovery request',
        whereFailed: 'Password recovery form',
        whyFailed: 'The entered email address is incomplete or invalid.',
        whatToDoNext: 'Enter a valid email address (e.g. name@domain.com) and retry.',
      });
      return { success: false, message: appErr.message, error: appErr };
    }

    if (isFirebaseAvailable && firebaseAuth) {
      try {
        let sent = false;
        if (typeof window !== 'undefined' && window.location?.origin) {
          try {
            const settings: ActionCodeSettings = {
              url: `${window.location.origin}/reset-password`,
              handleCodeInApp: true,
            };
            await sendPasswordResetEmail(firebaseAuth, cleanEmail, settings);
            sent = true;
          } catch (actionErr: any) {
            if (actionErr?.code === 'auth/unauthorized-continue-uri') {
              console.warn('[Firebase Auth] Custom continue URI not whitelisted, falling back to standard reset link.');
            } else {
              throw actionErr;
            }
          }
        }

        if (!sent) {
          await sendPasswordResetEmail(firebaseAuth, cleanEmail);
        }

        return {
          success: true,
          message: `Official password recovery email dispatched to ${cleanEmail}. Check your inbox and spam/junk folder.`,
        };
      } catch (err: any) {
        console.error('[Firebase Auth] Password reset error:', err.code, err.message);
        const appErr = mapFirebaseError(err, {
          stage: 'auth',
          field: 'email',
          operation: 'Password Reset Dispatch',
          email: cleanEmail,
        });
        return {
          success: false,
          message: appErr.message,
          error: appErr,
        };
      }
    }

    return {
      success: true,
      message: `Password reset instructions sent to ${cleanEmail}. Check your inbox and spam folder. (Local sandbox simulation).`,
    };
  }

  /**
   * Verifies an out-of-band password reset code (oobCode) from Firebase.
   * Returns the verified account email if valid, or an AppError if expired/invalid.
   */
  async verifyResetCode(oobCode: string): Promise<{ success: boolean; email?: string; error?: AppError }> {
    if (!oobCode || typeof oobCode !== 'string' || oobCode.trim() === '') {
      const appErr = createAppError({
        code: 'MISSING_ACTION_CODE',
        message: 'No password reset code was provided in the link.',
        stage: 'auth',
        retryable: false,
        whatFailed: 'Password reset code extraction',
        whereFailed: 'URL parameter parser',
        whyFailed: 'The password reset link did not contain a valid action code (oobCode).',
        whatToDoNext: 'Click the link directly from your email, or request a new reset email.',
        action: {
          label: 'Request New Reset Link',
          actionType: 'reset_password',
          target: '/forgot-password',
        },
      });
      return { success: false, error: appErr };
    }

    // Local sandbox simulation for development/testing
    if (oobCode.startsWith('test_sandbox_code_')) {
      const email = oobCode.replace('test_sandbox_code_', '') + '@obidostudio.com';
      return { success: true, email };
    }

    if (isFirebaseAvailable && firebaseAuth) {
      try {
        const email = await verifyPasswordResetCode(firebaseAuth, oobCode);
        return { success: true, email };
      } catch (err: any) {
        console.error('[Firebase Auth] verifyPasswordResetCode error:', err.code, err.message);
        const appErr = mapFirebaseError(err, {
          stage: 'auth',
          operation: 'Verify Reset Code',
        });
        return { success: false, error: appErr };
      }
    }

    const appErr = createAppError({
      code: 'INVALID_ACTION_CODE',
      message: 'This password reset link is invalid or has already been used.',
      stage: 'auth',
      retryable: false,
      whatFailed: 'Password reset link verification',
      whereFailed: 'Firebase Authentication action handler',
      whyFailed: 'The reset link is malformed, has expired, or has already been used.',
      whatToDoNext: 'Request a new password reset link from the Forgot Password page.',
      action: {
        label: 'Request New Reset Link',
        actionType: 'reset_password',
        target: '/forgot-password',
      },
    });
    return { success: false, error: appErr };
  }

  /**
   * Confirms password reset with Firebase using the verified action code.
   */
  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<{ success: boolean; error?: AppError }> {
    if (!newPassword || newPassword.length < 6) {
      const appErr = createAppError({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long.',
        field: 'newPassword',
        stage: 'auth',
        retryable: true,
        whatFailed: 'Password length validation',
        whereFailed: 'New password input field',
        whyFailed: 'The password is shorter than 6 characters.',
        whatToDoNext: 'Enter a password with at least 6 characters.',
      });
      return { success: false, error: appErr };
    }

    if (isFirebaseAvailable && firebaseAuth) {
      try {
        await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
        return { success: true };
      } catch (err: any) {
        console.error('[Firebase Auth] confirmPasswordReset error:', err.code, err.message);
        const appErr = mapFirebaseError(err, {
          stage: 'auth',
          field: 'newPassword',
          operation: 'Confirm Password Reset',
        });
        return { success: false, error: appErr };
      }
    }

    // Local sandbox simulation
    return { success: true };
  }

  private executeLocalSandboxSignIn(cleanEmail: string): AuthActionResult<User> {
    const demoUser = INITIAL_DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    if (demoUser) {
      this.currentUser = { ...demoUser, lastLoginAt: new Date().toISOString() };
      safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
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
    safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser));
    this.notify();
    return { success: true, user: fallbackUser };
  }

  private executeLocalSandboxSignUp(cleanName: string, cleanEmail: string): AuthActionResult<User> {
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
    safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    this.notify();
    return { success: true, user: newUser };
  }

  async completeOnboarding(preferences: UserPreferences): Promise<User | null> {
    if (!this.currentUser) return null;

    const cleanPrefs: UserPreferences = {};
    if (this.currentUser.preferences) {
      for (const [k, v] of Object.entries(this.currentUser.preferences)) {
        if (v !== undefined) {
          (cleanPrefs as any)[k] = v;
        }
      }
    }
    if (preferences) {
      for (const [k, v] of Object.entries(preferences)) {
        if (v !== undefined) {
          (cleanPrefs as any)[k] = v;
        }
      }
    }

    const updatedUser: User = {
      ...this.currentUser,
      hasCompletedOnboarding: true,
      preferences: cleanPrefs,
    };

    if (this.currentUser.authType === 'cloud' && isFirebaseAvailable) {
      try {
        await firestoreService.saveUserProfile(updatedUser);
      } catch (err) {
        console.warn('[AuthService] Onboarding preferences cloud sync deferred:', err);
      }
    }

    this.currentUser = updatedUser;
    safeStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    this.notify();
    return updatedUser;
  }

  async signOut() {
    this.syncEpoch++;
    this.pendingSyncUid = null;
    this.hasPendingProfileSync = false;
    const previousUserId = this.currentUser?.id;
    if (isFirebaseAvailable && firebaseAuth) {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (err) {
        console.warn('Firebase sign-out error:', err);
      }
    }
    this.currentUser = null;
    safeStorage.removeItem(AUTH_USER_KEY);

    // SEC-01: Safely clean up user-specific project cache and active project ID
    try {
      storage.handleUserSignOut(previousUserId);
    } catch (cacheErr) {
      console.warn('[AuthService] Cache cleanup error on signOut:', cacheErr);
    }

    this.notify();
  }
}

export const auth = new AuthService();
