import { auth } from './auth';

/**
 * Executes a fetch request with the authenticated user's ID token attached in the Authorization header.
 * Supports both real Firebase ID tokens and non-production demo tokens.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  try {
    token = await auth.getIdToken();
  } catch (err) {
    console.warn('[authenticatedFetch] Could not retrieve ID token:', err);
  }
  const headers = new Headers(init.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  return response;
}
