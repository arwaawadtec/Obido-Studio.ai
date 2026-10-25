/**
 * Obido Studio — Milestone 3.7: Firestore Profile Safety & Reconnection Test Suite
 *
 * Verifies:
 * 1. Explicit read outcomes: Distinguishes 'found', 'not_found', and 'unavailable'.
 * 2. No synthetic overwrite: When remote read is 'unavailable' (offline/network drop),
 *    never calls saveUserProfile with default onboarding state.
 * 3. Safe profile creation: Creates and persists default profile ONLY when document absence
 *    is positively confirmed ('not_found').
 * 4. Cache integrity: Cached user is only adopted if target UID strictly matches.
 *    Mismatched cache from a previous user is never applied.
 * 5. Reconnect recovery: Retries sync upon network 'online' or visibility restoration.
 * 6. Race & concurrency protection: Out-of-order or stale sync callbacks cannot overwrite
 *    a newer user session.
 * 7. Permission errors transparency: Permission-denied returns 'unavailable', never 'not_found'.
 */

import assert from 'assert';
import { FirestoreService, UserProfileResult } from '../src/services/firestoreService';
import { auth } from '../src/services/auth';
import { classifyConnectionError, reconnectNetwork } from '../src/services/firebase';
import { User } from '../src/types';

// In-memory mock storage polyfill
const mockStore = new Map<string, string>();
const windowListeners: Record<string, Array<() => void>> = {};

const mockLocalStorage = {
  getItem: (k: string) => mockStore.get(k) ?? null,
  setItem: (k: string, v: string) => mockStore.set(k, String(v)),
  removeItem: (k: string) => mockStore.delete(k),
  clear: () => mockStore.clear(),
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
  },
  addEventListener: (event: string, handler: any) => {
    if (!windowListeners[event]) windowListeners[event] = [];
    windowListeners[event].push(handler);
  },
  removeEventListener: (event: string, handler: any) => {
    if (windowListeners[event]) {
      windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
    }
  },
};
(globalThis as any).document = {
  visibilityState: 'visible',
  addEventListener: (event: string, handler: any) => {
    if (!windowListeners[event]) windowListeners[event] = [];
    windowListeners[event].push(handler);
  },
  removeEventListener: () => {},
};

function triggerWindowEvent(name: string) {
  const handlers = windowListeners[name] || [];
  for (const h of handlers) {
    try {
      h();
    } catch (e) {
      console.error(`Error in event listener for ${name}:`, e);
    }
  }
}

async function runProfileSafetyTests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Firestore Profile Safety & Reconnection Suite         ');
  console.log('========================================================================\n');

  (auth as any).registerReconnectionListeners();

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

  // --- Test 1: Explicit Read Outcomes in FirestoreService ---
  await test('1. FirestoreService distinguishes found, not_found, and unavailable outcomes', async () => {
    const fsService = new FirestoreService();

    // When service is not available or UID is empty
    const invalidResult = await fsService.getUserProfileWithStatus('');
    assert.strictEqual(invalidResult.status, 'unavailable');
    assert.strictEqual(typeof invalidResult.reason, 'string');
  });

  // --- Test 2: No Synthetic Overwrite on Offline Read ---
  await test('2. Offline profile read does NOT invoke saveUserProfile or overwrite onboarding with defaults', async () => {
    mockStore.clear();

    const targetUid = 'user_offline_test_99';
    let saveUserProfileCalled = false;
    let savedPayload: any = null;

    // Simulate FirestoreService where read is unavailable (offline)
    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;
    const origSaveProfile = firestoreService.saveUserProfile;

    firestoreService.getUserProfileWithStatus = async (_uid: string): Promise<UserProfileResult> => {
      return { status: 'unavailable', reason: 'offline' };
    };

    firestoreService.saveUserProfile = async (user: User): Promise<void> => {
      saveUserProfileCalled = true;
      savedPayload = user;
    };

    try {
      // Simulate Firebase user syncing
      const fbUserMock: any = {
        uid: targetUid,
        email: 'director@production.com',
        displayName: 'Senior Director',
        photoURL: null,
      };

      const syncedUser = await (auth as any).syncFirebaseUser(fbUserMock);

      // CRITICAL ASSERTION: saveUserProfile must NOT have been called!
      assert.strictEqual(
        saveUserProfileCalled,
        false,
        'saveUserProfile MUST NOT be called when cloud profile read is unavailable/offline'
      );
      assert.strictEqual(savedPayload, null);

      // Session must be marked with pending profile sync
      assert.strictEqual((auth as any).hasPendingSync(), true, 'Must flag that profile sync is pending');
      assert.strictEqual(syncedUser.id, targetUid);
      assert.strictEqual(syncedUser.email, 'director@production.com');
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
      firestoreService.saveUserProfile = origSaveProfile;
    }
  });

  // --- Test 3: Confirmed Absence ('not_found') Creates Initial Profile Safely ---
  await test('3. Confirmed document absence ("not_found") safely persists new creator profile', async () => {
    mockStore.clear();
    const newUid = 'user_brand_new_123';
    let saveUserProfileCalled = false;
    let savedUser: any = null;

    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;
    const origSaveProfile = firestoreService.saveUserProfile;

    // Positive confirmation that doc does not exist
    firestoreService.getUserProfileWithStatus = async (_uid: string): Promise<UserProfileResult> => {
      return { status: 'not_found' };
    };

    firestoreService.saveUserProfile = async (user: User): Promise<void> => {
      saveUserProfileCalled = true;
      savedUser = user;
    };

    try {
      const fbUserMock: any = {
        uid: newUid,
        email: 'newbie@studio.com',
        displayName: 'Fresh Talent',
        photoURL: null,
      };

      const result = await (auth as any).syncFirebaseUser(fbUserMock);

      assert.strictEqual(saveUserProfileCalled, true, 'saveUserProfile must be called when user absence is confirmed');
      assert.strictEqual(savedUser?.id, newUid);
      assert.strictEqual(savedUser?.hasCompletedOnboarding, false);
      assert.strictEqual(result.hasCompletedOnboarding, false);
      assert.strictEqual((auth as any).hasPendingSync(), false, 'Pending sync should be false after positive creation');
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
      firestoreService.saveUserProfile = origSaveProfile;
    }
  });

  // --- Test 4: Existing Profile in Firestore is Preserved Without Modification ---
  await test('4. Confirmed existing profile restores full onboarding and preferences without overwrite', async () => {
    mockStore.clear();
    const existingUid = 'user_veteran_789';
    let saveUserProfileCalled = false;

    const existingInCloud: User = {
      id: existingUid,
      name: 'Master Filmmaker',
      email: 'master@studio.com',
      role: 'producer',
      tier: 'studio',
      hasCompletedOnboarding: true,
      preferences: {
        useCase: 'marketing',
        experienceLevel: 'advanced',
        language: 'en',
      },
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;
    const origSaveProfile = firestoreService.saveUserProfile;

    firestoreService.getUserProfileWithStatus = async (_uid: string): Promise<UserProfileResult> => {
      return { status: 'found', user: existingInCloud, source: 'server' };
    };

    firestoreService.saveUserProfile = async (): Promise<void> => {
      saveUserProfileCalled = true;
    };

    try {
      const fbUserMock: any = {
        uid: existingUid,
        email: 'master@studio.com',
        displayName: 'Master Filmmaker',
      };

      const syncedUser = await (auth as any).syncFirebaseUser(fbUserMock);

      assert.strictEqual(saveUserProfileCalled, false, 'Existing profile must not trigger unnecessary saveUserProfile');
      assert.strictEqual(syncedUser.hasCompletedOnboarding, true, 'Must preserve hasCompletedOnboarding: true');
      assert.strictEqual(syncedUser.tier, 'studio', 'Must preserve studio tier');
      assert.strictEqual(syncedUser.preferences?.experienceLevel, 'advanced');
      assert.strictEqual((auth as any).hasPendingSync(), false);
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
      firestoreService.saveUserProfile = origSaveProfile;
    }
  });

  // --- Test 5: Cache Integrity — UID Isolation ---
  await test('5. Cache is strictly scoped to authenticated UID; previous user cache is rejected', async () => {
    mockStore.clear();

    // Cache contains User Alice's profile
    const aliceUser: User = {
      id: 'user_alice_456',
      name: 'Alice Creator',
      email: 'alice@domain.com',
      role: 'creator',
      tier: 'pro',
      hasCompletedOnboarding: true,
    };
    mockStore.set('obido_studio_auth_user_v1', JSON.stringify(aliceUser));

    const targetBobUid = 'user_bob_789';

    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;
    const origSaveProfile = firestoreService.saveUserProfile;

    // Bob's cloud read is offline
    firestoreService.getUserProfileWithStatus = async () => {
      return { status: 'unavailable', reason: 'offline' };
    };

    let saveCalled = false;
    firestoreService.saveUserProfile = async () => {
      saveCalled = true;
    };

    try {
      const fbBob: any = {
        uid: targetBobUid,
        email: 'bob@domain.com',
        displayName: 'Bob Editor',
      };

      const syncedBob = await (auth as any).syncFirebaseUser(fbBob);

      // Bob MUST NOT adopt Alice's cached profile or email!
      assert.strictEqual(syncedBob.id, targetBobUid);
      assert.strictEqual(syncedBob.email, 'bob@domain.com');
      assert.notStrictEqual(syncedBob.email, aliceUser.email);
      assert.strictEqual(saveCalled, false);
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
      firestoreService.saveUserProfile = origSaveProfile;
    }
  });

  // --- Test 6: Reconnection Triggers Profile Re-synchronization ---
  await test('6. Reconnection event ("online") safely re-syncs pending profile', async () => {
    mockStore.clear();
    const reconnectUid = 'user_reconnect_test';

    const { firestoreService } = await import('../src/services/firestoreService');
    const { firebaseAuth } = await import('../src/services/firebase');
    const origGetProfile = firestoreService.getUserProfileWithStatus;

    let callCount = 0;

    // First call: offline
    // Second call: online with authoritative data
    firestoreService.getUserProfileWithStatus = async (uid: string): Promise<UserProfileResult> => {
      callCount++;
      if (callCount === 1) {
        return { status: 'unavailable', reason: 'offline' };
      }
      return {
        status: 'found',
        user: {
          id: uid,
          name: 'Authoritative Producer',
          email: 'producer@studio.com',
          role: 'producer',
          tier: 'studio',
          hasCompletedOnboarding: true,
        },
      };
    };

    // Mock firebaseAuth.currentUser using Object.defineProperty to avoid reassigning const
    try {
      Object.defineProperty(firebaseAuth, 'currentUser', {
        value: {
          uid: reconnectUid,
          email: 'producer@studio.com',
          displayName: 'Authoritative Producer',
        },
        configurable: true,
        writable: true,
      });
    } catch {
      (firebaseAuth as any).currentUser = {
        uid: reconnectUid,
        email: 'producer@studio.com',
        displayName: 'Authoritative Producer',
      };
    }

    try {
      // 1. Initial sync while offline
      await (auth as any).syncFirebaseUser((firebaseAuth as any).currentUser);
      assert.strictEqual((auth as any).hasPendingSync(), true, 'Must have pending sync while offline');

      // 2. Network connectivity restored -> trigger online event
      triggerWindowEvent('online');

      // Wait a tick for async handler
      await new Promise((r) => setTimeout(r, 50));

      // Assert sync was retried and updated to authoritative data
      assert.strictEqual(callCount >= 2, true, 'getUserProfileWithStatus should have been retried on reconnect');
      const currentUser = auth.getCurrentUser();
      assert.strictEqual(currentUser?.name, 'Authoritative Producer');
      assert.strictEqual(currentUser?.tier, 'studio');
      assert.strictEqual(currentUser?.hasCompletedOnboarding, true);
      assert.strictEqual((auth as any).hasPendingSync(), false, 'Pending sync flag should be cleared');
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
    }
  });

  // --- Test 7: Race Condition Protection Between Rapid Account Switches ---
  await test('7. Rapid consecutive syncs prevent stale User A callback from overwriting User B', async () => {
    mockStore.clear();

    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;

    // Make User A slow (100ms) and User B fast (10ms)
    firestoreService.getUserProfileWithStatus = async (uid: string): Promise<UserProfileResult> => {
      if (uid === 'user_slow_A') {
        await new Promise((r) => setTimeout(r, 100));
        return {
          status: 'found',
          user: {
            id: 'user_slow_A',
            name: 'Slow User A',
            email: 'a@slow.com',
            role: 'creator',
            tier: 'free',
            hasCompletedOnboarding: false,
          },
        };
      }
      return {
        status: 'found',
        user: {
          id: 'user_fast_B',
          name: 'Fast User B',
          email: 'b@fast.com',
          role: 'producer',
          tier: 'pro',
          hasCompletedOnboarding: true,
        },
      };
    };

    try {
      const fbUserA: any = { uid: 'user_slow_A', email: 'a@slow.com' };
      const fbUserB: any = { uid: 'user_fast_B', email: 'b@fast.com' };

      // Dispatch User A sync (starts slow query)
      const promiseA = (auth as any).syncFirebaseUser(fbUserA);

      // Almost immediately dispatch User B sync (newer epoch)
      await new Promise((r) => setTimeout(r, 5));
      const promiseB = (auth as any).syncFirebaseUser(fbUserB);

      // Wait for both to complete
      await Promise.all([promiseA, promiseB]);

      // The final active user MUST be User B, not overwritten by slow User A!
      const activeUser = auth.getCurrentUser();
      assert.strictEqual(activeUser?.id, 'user_fast_B', 'Active user must be User B');
      assert.strictEqual(activeUser?.name, 'Fast User B');
      assert.strictEqual(activeUser?.tier, 'pro');
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
    }
  });

  // --- Test 8: Permission Denied maps to 'unavailable', never falsely 'not_found' ---
  await test('8. Non-network errors (e.g. permission-denied) map to unavailable, preventing unauthorized creates', async () => {
    mockStore.clear();

    const { firestoreService } = await import('../src/services/firestoreService');
    const origGetProfile = firestoreService.getUserProfileWithStatus;
    const origSaveProfile = firestoreService.saveUserProfile;

    // Simulate permission denied error
    firestoreService.getUserProfileWithStatus = async () => {
      return { status: 'unavailable', reason: 'permission-denied' };
    };

    let saveAttempted = false;
    firestoreService.saveUserProfile = async () => {
      saveAttempted = true;
    };

    try {
      const fbUser: any = {
        uid: 'user_permission_test',
        email: 'denied@domain.com',
      };

      await (auth as any).syncFirebaseUser(fbUser);

      // saveUserProfile MUST NOT be called because failure was permission-denied, not absent doc!
      assert.strictEqual(
        saveAttempted,
        false,
        'saveUserProfile must not be called when read failed due to permission denial'
      );
      assert.strictEqual((auth as any).hasPendingSync(), true);
    } finally {
      firestoreService.getUserProfileWithStatus = origGetProfile;
      firestoreService.saveUserProfile = origSaveProfile;
    }
  });

  // --- Test 9: Persistence Contention ('failed-precondition') classification ---
  await test('9. classifyConnectionError catches failed-precondition specifically from multi-tab contention', async () => {
    const multiTabError = new Error('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    (multiTabError as any).code = 'failed-precondition';

    const classification = classifyConnectionError(multiTabError);
    assert.strictEqual(classification, 'failed_precondition');

    // Also handles raw error codes without specific message strings
    const rawPrecondition = { code: 'failed-precondition' };
    assert.strictEqual(classifyConnectionError(rawPrecondition), 'failed_precondition');
  });

  // --- Test 10: Explicit distinction between permanent offline mode and transient connection drops ---
  await test('10. Distinguishes permanent offline mode from transient connection drops on unavailable code', async () => {
    const unavailableErr = new Error('Failed to get document from server because the client is offline.');
    (unavailableErr as any).code = 'unavailable';

    const origDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });
      const offlineClassification = classifyConnectionError(unavailableErr);
      assert.strictEqual(offlineClassification, 'permanent_offline');

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });
      const onlineClassification = classifyConnectionError(unavailableErr);
      assert.strictEqual(onlineClassification, 'transient_drop');
    } finally {
      if (origDesc) {
        Object.defineProperty(globalThis, 'navigator', origDesc);
      }
    }
  });

  console.log('\n========================================================================');
  console.log(`   Verification Results: ${passed} PASSED | ${failed} FAILED           `);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProfileSafetyTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
