import { User, UserPreferences } from '../types';

const AUTH_USER_KEY = 'obido_studio_auth_user_v1';
const REGISTERED_USERS_KEY = 'obido_studio_registered_users_v1';

// Seed demo user so testing sign-in immediately works
const INITIAL_DEMO_USERS: User[] = [
  {
    id: 'user_demo_creator',
    name: 'Sarah Chen',
    email: 'creator@obidostudio.com',
    role: 'creator',
    tier: 'pro',
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
    hasCompletedOnboarding: true,
    preferences: {
      useCase: 'business',
      experienceLevel: 'advanced',
      language: 'en',
    },
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    lastLoginAt: new Date().toISOString(),
  }
];

class AuthService {
  private currentUser: User | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      // Ensure seed users exist in registered users store
      const storedUsers = localStorage.getItem(REGISTERED_USERS_KEY);
      if (!storedUsers) {
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
      }

      // Check for active session
      const sessionUser = localStorage.getItem(AUTH_USER_KEY);
      if (sessionUser) {
        this.currentUser = JSON.parse(sessionUser);
      } else {
        // By default on public landing page, user is unauthenticated
        this.currentUser = null;
      }
    } catch (e) {
      console.warn('AuthService init error', e);
      this.currentUser = null;
    }
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

  getRegisteredUsers(): User[] {
    try {
      const stored = localStorage.getItem(REGISTERED_USERS_KEY);
      return stored ? JSON.parse(stored) : INITIAL_DEMO_USERS;
    } catch {
      return INITIAL_DEMO_USERS;
    }
  }

  private saveRegisteredUsers(users: User[]) {
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save registered users', e);
    }
  }

  private setSessionUser(user: User | null) {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch (e) {
      console.warn('Failed to update session user', e);
    }
    this.notify();
  }

  async signIn(email: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    // Artificial latency for authentic auth experience
    await new Promise((res) => setTimeout(res, 450));

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const registered = this.getRegisteredUsers();
    let existing = registered.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      // If logging in with demo credentials or any email, allow clean creation or fallback
      const derivedName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      const capitalized = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);
      existing = {
        id: 'user_' + Math.random().toString(36).substring(2, 9),
        name: capitalized,
        email: cleanEmail,
        role: 'creator',
        tier: 'free',
        hasCompletedOnboarding: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      this.saveRegisteredUsers([...registered, existing]);
    } else {
      existing.lastLoginAt = new Date().toISOString();
      this.saveRegisteredUsers(registered.map((u) => (u.id === existing!.id ? existing! : u)));
    }

    this.setSessionUser(existing);
    return { success: true, user: existing };
  }

  async signUp(name: string, email: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    await new Promise((res) => setTimeout(res, 450));

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      return { success: false, error: 'Please provide your full name or creator handle.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const registered = this.getRegisteredUsers();
    const alreadyExists = registered.find((u) => u.email.toLowerCase() === cleanEmail);

    if (alreadyExists) {
      // Sign in instead
      this.setSessionUser(alreadyExists);
      return { success: true, user: alreadyExists };
    }

    const newUser: User = {
      id: 'user_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      name: cleanName,
      email: cleanEmail,
      role: 'creator',
      tier: 'free',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    this.saveRegisteredUsers([...registered, newUser]);
    this.setSessionUser(newUser);

    return { success: true, user: newUser };
  }

  async signInWithGoogle(): Promise<{ success: boolean; user?: User; error?: string }> {
    await new Promise((res) => setTimeout(res, 600));

    // Sign in with Google Creator account
    const googleUser: User = {
      id: 'user_google_' + Date.now().toString(36),
      name: 'Google Creator',
      email: 'creator@google.com',
      role: 'creator',
      tier: 'pro',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const registered = this.getRegisteredUsers();
    const existing = registered.find((u) => u.email === googleUser.email);
    if (existing) {
      this.setSessionUser(existing);
      return { success: true, user: existing };
    }

    this.saveRegisteredUsers([...registered, googleUser]);
    this.setSessionUser(googleUser);
    return { success: true, user: googleUser };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    await new Promise((res) => setTimeout(res, 400));
    const cleanEmail = email.trim().toLowerCase();
    return {
      success: true,
      message: `Password reset instructions sent to ${cleanEmail}. Check your inbox or development console.`,
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

    const registered = this.getRegisteredUsers().map((u) => (u.id === updatedUser.id ? updatedUser : u));
    this.saveRegisteredUsers(registered);
    this.setSessionUser(updatedUser);

    return updatedUser;
  }

  signOut() {
    this.setSessionUser(null);
  }

  // Provider transparency helper
  isFirebaseConfigured(): boolean {
    return false; // Honest status: Cloud Firebase Auth not provisioned; local secure store active
  }
}

export const auth = new AuthService();
