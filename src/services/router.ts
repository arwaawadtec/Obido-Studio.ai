import { auth } from './auth';

export type AppRoute =
  | { path: '/' }
  | { path: '/sign-in'; redirect?: string }
  | { path: '/sign-up'; redirect?: string }
  | { path: '/forgot-password' }
  | { path: '/reset-password'; oobCode?: string; mode?: string }
  | { path: '/onboarding' }
  | { path: '/app' }
  | { path: '/app/projects' }
  | { path: '/app/workspace'; projectId: string }
  | { path: '/app/templates' };

class RouterService {
  private currentPath: string = '/';
  private currentRoute: AppRoute = { path: '/' };
  private listeners: Array<(route: AppRoute) => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Read initial location
    this.currentPath = window.location.pathname || '/';
    this.currentRoute = this.parsePath(this.currentPath);

    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname || '/';
      this.currentRoute = this.parsePath(this.currentPath);
      this.enforceRouteGuards();
      this.notify();
    });

    // Subscribe to auth state changes to re-evaluate route guards on login/logout/onboarding
    auth.subscribe(() => {
      this.enforceRouteGuards();
      this.notify();
    });

    // Check auth guards on startup
    this.enforceRouteGuards();
  }

  private parsePath(pathname: string): AppRoute {
    const clean = pathname.replace(/\/+$/, '') || '/';
    const urlParams =
      typeof window !== 'undefined' && window.location
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode') || undefined;

    // Detect Firebase action code link or explicit /reset-password
    if (clean === '/reset-password' || mode === 'resetPassword' || clean.includes('/__/auth/action')) {
      return { path: '/reset-password', oobCode, mode: mode || undefined };
    }

    if (clean === '' || clean === '/') return { path: '/' };
    if (clean === '/sign-in') {
      return { path: '/sign-in', redirect: urlParams.get('redirect') || undefined };
    }
    if (clean === '/sign-up') {
      return { path: '/sign-up', redirect: urlParams.get('redirect') || undefined };
    }
    if (clean === '/forgot-password') return { path: '/forgot-password' };
    if (clean === '/onboarding') return { path: '/onboarding' };
    if (clean === '/app') return { path: '/app' };
    if (clean === '/app/projects') return { path: '/app/projects' };
    if (clean === '/app/templates') return { path: '/app/templates' };

    if (clean.startsWith('/app/workspace/')) {
      const projectId = clean.replace('/app/workspace/', '');
      return { path: '/app/workspace', projectId };
    }

    // Default fallback
    return { path: '/' };
  }

  public enforceRouteGuards() {
    // If auth state is still resolving from cold start and no session is cached,
    // defer guards to prevent redirect loops or premature redirection before state resolves.
    if (!auth.isReady() && !auth.getCurrentUser()) {
      return;
    }

    const isAuth = auth.isAuthenticated();
    const user = auth.getCurrentUser();
    const current = this.currentRoute;

    // Protected routes requiring authentication
    const isProtectedRoute =
      current.path === '/app' ||
      current.path === '/app/projects' ||
      current.path === '/app/workspace' ||
      current.path === '/app/templates' ||
      current.path === '/onboarding';

    // 1. Unauthenticated users cannot access any protected routes
    if (isProtectedRoute && !isAuth) {
      this.navigate('/sign-in', { redirect: this.currentPath, replace: true });
      return;
    }

    const isAppRoute =
      current.path === '/app' ||
      current.path === '/app/projects' ||
      current.path === '/app/workspace' ||
      current.path === '/app/templates';

    // 2. UX-01: Authenticated users who have NOT completed onboarding must be redirected to /onboarding
    // when attempting to access any protected studio application routes
    if (isAppRoute && isAuth && user && !user.hasCompletedOnboarding) {
      this.navigate('/onboarding', { replace: true });
      return;
    }

    // 3. UX-01: Authenticated users who have COMPLETED onboarding should not re-visit /onboarding
    if (current.path === '/onboarding' && isAuth && user && user.hasCompletedOnboarding) {
      this.navigate('/app', { replace: true });
      return;
    }

    // 4. Authenticated users visiting /sign-in or /sign-up are redirected based on onboarding status
    if ((current.path === '/sign-in' || current.path === '/sign-up') && isAuth) {
      if (user && !user.hasCompletedOnboarding) {
        this.navigate('/onboarding', { replace: true });
      } else {
        this.navigate('/app', { replace: true });
      }
      return;
    }
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentRoute));
  }

  subscribe(listener: (route: AppRoute) => void) {
    this.listeners.push(listener);
    listener(this.currentRoute);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getRoute(): AppRoute {
    return this.currentRoute;
  }

  getPath(): string {
    return this.currentPath;
  }

  navigate(
    to: string,
    options?: { replace?: boolean; redirect?: string; state?: any }
  ) {
    if (typeof window === 'undefined') return;

    let targetUrl = to;
    if (options?.redirect) {
      targetUrl += `?redirect=${encodeURIComponent(options.redirect)}`;
    }

    if (options?.replace) {
      window.history.replaceState(options?.state || {}, '', targetUrl);
    } else {
      window.history.pushState(options?.state || {}, '', targetUrl);
    }

    this.currentPath = to;
    this.currentRoute = this.parsePath(to);
    this.enforceRouteGuards();
    this.notify();
  }
}

export const router = new RouterService();
