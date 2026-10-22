/**
 * Obido Studio — Milestone 3.6.1: Minimal Lifecycle & Security Fixes Test Suite
 * 
 * Tests:
 * 1. SEC-01.1: Sign-out clears user-specific project cache from memory & shared localStorage
 * 2. SEC-01.2: Unsynchronized local drafts are safely quarantined and restored on subsequent sign-in
 * 3. SEC-01.3: User B cannot see User A's cached projects after sign-out and sign-in
 * 4. SEC-01.4: Cross-tab sign-out broadcast event invalidates session and purges local user cache
 * 5. UX-01.1: Authenticated user with incomplete onboarding cannot access protected routes (/app, /app/projects)
 * 6. UX-01.2: /onboarding remains directly accessible to un-onboarded user without redirect loops
 * 7. UX-01.3: Completed user can access /app and is redirected away from /onboarding
 * 8. UX-01.4: Unresolved / loading authentication state does not trigger premature redirects or loops
 */

import assert from 'assert';

// Polyfill window & localStorage for Node execution
const mockStore = new Map<string, string>();
const storageListeners: Array<(e: any) => void> = [];

const mockLocalStorage = {
  getItem: (k: string) => mockStore.get(k) ?? null,
  setItem: (k: string, v: string) => mockStore.set(k, String(v)),
  removeItem: (k: string) => mockStore.delete(k),
  clear: () => mockStore.clear(),
};

(globalThis as any).localStorage = mockLocalStorage;

let currentHistoryUrl = 'http://localhost:3000/';
(globalThis as any).window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
  },
  history: {
    pushState: (_state: any, _title: string, url: string) => {
      currentHistoryUrl = url;
      const parsed = new URL(url, 'http://localhost:3000');
      (globalThis as any).window.location.pathname = parsed.pathname;
      (globalThis as any).window.location.search = parsed.search;
    },
    replaceState: (_state: any, _title: string, url: string) => {
      currentHistoryUrl = url;
      const parsed = new URL(url, 'http://localhost:3000');
      (globalThis as any).window.location.pathname = parsed.pathname;
      (globalThis as any).window.location.search = parsed.search;
    },
  },
  addEventListener: (event: string, handler: any) => {
    if (event === 'storage') {
      storageListeners.push(handler);
    }
  },
  removeEventListener: () => {},
};

async function runMilestone361Tests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Milestone 3.6.1: Lifecycle & Security Verification    ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`      Error: ${err.message}`);
      failed++;
    }
  }

  // Import services after window/localStorage polyfills are established
  const { storage } = await import('../src/services/storage');
  const { auth } = await import('../src/services/auth');
  const { router } = await import('../src/services/router');

  // --- SECTION 1: SEC-01 Safe Sign-Out Cache Cleanup ---
  console.log('--- Section 1: SEC-01 Safe Sign-Out Cache Cleanup ---');

  await test('1.1 Sign-out clears user-specific project cache from active memory and shared storage', async () => {
    mockStore.clear();

    // Simulate User Alice signing in
    const userAlice = {
      id: 'user_alice_test_1',
      name: 'Alice Creator',
      email: 'alice@example.com',
      role: 'creator' as const,
      tier: 'pro' as const,
      authType: 'local_demo' as const,
      hasCompletedOnboarding: true,
    };
    (auth as any).currentUser = userAlice;

    // Create a cloud-synced project for Alice
    const projAlice = storage.createProject({
      title: 'Alice Confidential Pipeline',
      userId: userAlice.id,
      rawIdea: 'Secret product launch footage',
    });
    projAlice.isLocalOnly = false;
    projAlice.migratedFromLocal = true;

    // Set active project to Alice's project
    storage.setActiveProjectId(projAlice.id);
    assert.strictEqual(storage.getActiveProjectId(userAlice.id), projAlice.id);

    // Verify Alice's project is present in memory
    const beforeSignout = storage.getProjects(userAlice.id);
    assert.strictEqual(beforeSignout.length >= 1, true);

    // Sign out Alice
    await auth.signOut();

    // Verify currentUser is cleared
    assert.strictEqual(auth.getCurrentUser(), null);

    // Verify Alice's project is completely removed from storage memory
    const aliceProjectsAfter = storage.getProjects(userAlice.id);
    assert.strictEqual(aliceProjectsAfter.length, 0, "Alice's projects must not be returned after sign-out");

    // Verify shared localStorage key does NOT contain Alice's project
    const sharedData = JSON.parse(mockLocalStorage.getItem('obido_studio_projects_v1') || '[]');
    const leakedAlice = sharedData.find((p: any) => p.userId === userAlice.id);
    assert.strictEqual(leakedAlice, undefined, "Shared localStorage must not contain Alice's project");

    // Verify active project ID cache was invalidated
    assert.strictEqual(mockLocalStorage.getItem('obido_studio_active_project_id'), null);
  });

  await test('1.2 Unsynchronized local drafts are safely quarantined and restored on subsequent sign-in', async () => {
    mockStore.clear();

    const userBob = {
      id: 'user_bob_test_2',
      name: 'Bob Director',
      email: 'bob@example.com',
      role: 'creator' as const,
      tier: 'pro' as const,
      authType: 'local_demo' as const,
      hasCompletedOnboarding: true,
    };
    (auth as any).currentUser = userBob;

    // Create an unsynchronized local draft (e.g. offline work)
    const localDraft = storage.createProject({
      title: 'Bob Unsynced Master Draft',
      userId: userBob.id,
      rawIdea: 'Offline draft not yet synced to cloud',
    });
    localDraft.isLocalOnly = true;
    localDraft.migratedFromLocal = false;

    // User signs out
    await auth.signOut();

    // Verify draft was safely quarantined under user-scoped key
    const quarantineKey = `obido_studio_unsynced_${userBob.id}`;
    const quarantinedRaw = mockLocalStorage.getItem(quarantineKey);
    assert.ok(quarantinedRaw, 'Unsynced draft must be preserved in user quarantine key');
    const quarantinedList = JSON.parse(quarantinedRaw);
    assert.strictEqual(quarantinedList[0].id, localDraft.id);
    assert.strictEqual(quarantinedList[0].title, 'Bob Unsynced Master Draft');

    // Shared storage must NOT contain the draft while signed out
    const sharedData = JSON.parse(mockLocalStorage.getItem('obido_studio_projects_v1') || '[]');
    assert.strictEqual(sharedData.some((p: any) => p.userId === userBob.id), false);

    // Bob signs back in
    (auth as any).currentUser = userBob;
    const restoredProjects = await storage.queryProjects(userBob.id);

    // Verify draft is restored to Bob's project list
    const foundDraft = restoredProjects.find((p) => p.id === localDraft.id);
    assert.ok(foundDraft, 'Draft must be restored when Bob signs back in');
    assert.strictEqual(foundDraft?.title, 'Bob Unsynced Master Draft');

    // Verify quarantine key is cleaned up after restoration
    assert.strictEqual(mockLocalStorage.getItem(quarantineKey), null);
  });

  await test('1.3 A second user cannot see the first user cached projects after sign-out and sign-in', async () => {
    mockStore.clear();

    // 1. User Alice logs in and creates a project
    const aliceId = 'user_alice_cross_leak_test';
    (auth as any).currentUser = { id: aliceId, name: 'Alice', email: 'alice@test.com', hasCompletedOnboarding: true };
    const aliceProj = storage.createProject({
      title: 'Alice Super Secret Video',
      userId: aliceId,
    });
    aliceProj.isLocalOnly = false;
    aliceProj.migratedFromLocal = true;

    // 2. Alice signs out
    await auth.signOut();

    // 3. User Charlie logs in
    const charlieId = 'user_charlie_test';
    (auth as any).currentUser = { id: charlieId, name: 'Charlie', email: 'charlie@test.com', hasCompletedOnboarding: true };

    // Charlie queries his projects
    const charlieProjects = storage.getProjects(charlieId);

    // Charlie must NOT see Alice's project
    const containsAliceData = charlieProjects.some((p) => p.id === aliceProj.id || p.userId === aliceId);
    assert.strictEqual(containsAliceData, false, 'Charlie must never see Alice projects');

    // Unauthenticated caller also must NOT receive Alice's project
    const guestProjects = storage.getProjects(undefined);
    const guestContainsAlice = guestProjects.some((p) => p.id === aliceProj.id || p.userId === aliceId);
    assert.strictEqual(guestContainsAlice, false, 'Unauthenticated guest must never see Alice projects');
  });

  await test('1.4 Multi-tab synchronization: storage event invalidates session and purges local user cache', async () => {
    mockStore.clear();

    const userDavid = {
      id: 'user_david_tab_test',
      name: 'David',
      email: 'david@test.com',
      hasCompletedOnboarding: true,
    };
    (auth as any).currentUser = userDavid;
    mockLocalStorage.setItem('obido_studio_auth_user_v1', JSON.stringify(userDavid));

    storage.createProject({
      title: 'David Tab Project',
      userId: userDavid.id,
    });
    assert.ok(storage.getProjects(userDavid.id).length > 0);

    // Simulate Tab 2 clearing session (sign out in another tab)
    const storageEvent = {
      key: 'obido_studio_auth_user_v1',
      oldValue: JSON.stringify(userDavid),
      newValue: null,
    };

    // Trigger registered storage event listener
    for (const listener of storageListeners) {
      listener(storageEvent);
    }

    // Verify Tab 1 immediately signed out
    assert.strictEqual(auth.getCurrentUser(), null);
    assert.strictEqual(storage.getProjects(userDavid.id).length, 0);
  });

  // --- SECTION 2: UX-01 Onboarding Route Guards ---
  console.log('\n--- Section 2: UX-01 Onboarding Route Guards ---');

  await test('2.1 Authenticated user with incomplete onboarding cannot access protected studio routes', async () => {
    // Setup authenticated user with hasCompletedOnboarding: false
    const incompleteUser = {
      id: 'user_incomplete_123',
      name: 'New Creator',
      email: 'new@example.com',
      role: 'creator' as const,
      tier: 'free' as const,
      hasCompletedOnboarding: false,
    };
    (auth as any).currentUser = incompleteUser;
    (auth as any).isAuthReady = true;

    // Attempt direct navigation to /app
    router.navigate('/app');
    assert.strictEqual(router.getRoute().path, '/onboarding', 'Must redirect to /onboarding from /app');

    // Attempt direct navigation to /app/projects
    router.navigate('/app/projects');
    assert.strictEqual(router.getRoute().path, '/onboarding', 'Must redirect to /onboarding from /app/projects');

    // Attempt direct navigation to /app/workspace/proj_1
    router.navigate('/app/workspace/proj_1');
    assert.strictEqual(router.getRoute().path, '/onboarding', 'Must redirect to /onboarding from /app/workspace');
  });

  await test('2.2 /onboarding remains directly accessible to un-onboarded user without redirect loops', async () => {
    const incompleteUser = {
      id: 'user_incomplete_123',
      name: 'New Creator',
      email: 'new@example.com',
      role: 'creator' as const,
      tier: 'free' as const,
      hasCompletedOnboarding: false,
    };
    (auth as any).currentUser = incompleteUser;
    (auth as any).isAuthReady = true;

    // Navigate to /onboarding
    router.navigate('/onboarding');
    assert.strictEqual(router.getRoute().path, '/onboarding');

    // Re-trigger enforceRouteGuards to verify idempotency (no redirect loop)
    router.enforceRouteGuards();
    assert.strictEqual(router.getRoute().path, '/onboarding', '/onboarding must remain stable');
  });

  await test('2.3 User who completed onboarding can access /app and is redirected away from /onboarding', async () => {
    const completedUser = {
      id: 'user_completed_456',
      name: 'Pro Creator',
      email: 'pro@example.com',
      role: 'creator' as const,
      tier: 'pro' as const,
      hasCompletedOnboarding: true,
    };
    (auth as any).currentUser = completedUser;
    (auth as any).isAuthReady = true;

    // 1. Can access /app normally
    router.navigate('/app');
    assert.strictEqual(router.getRoute().path, '/app', 'Completed user must access /app');

    // 2. Cannot re-enter /onboarding; redirected to /app
    router.navigate('/onboarding');
    assert.strictEqual(router.getRoute().path, '/app', 'Completed user must be redirected away from /onboarding');

    // 3. Visiting /sign-in while logged in redirects to /app
    router.navigate('/sign-in');
    assert.strictEqual(router.getRoute().path, '/app', 'Completed user visiting /sign-in must be redirected to /app');
  });

  await test('2.4 Unresolved / loading authentication state does not trigger premature redirects or loops', async () => {
    // Simulate initial cold start: auth is NOT ready, no cached user
    (auth as any).currentUser = null;
    (auth as any).isAuthReady = false;

    // User is on /app (e.g. browser refresh on /app)
    (router as any).currentPath = '/app';
    (router as any).currentRoute = { path: '/app' };

    // enforceRouteGuards must defer without redirecting
    router.enforceRouteGuards();
    assert.strictEqual(router.getRoute().path, '/app', 'Must defer redirection while auth is loading');
  });

  console.log('\n========================================================================');
  console.log(`   Verification Results: ${passed} PASSED | ${failed} FAILED           `);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone361Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
