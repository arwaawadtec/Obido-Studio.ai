import { AppError } from '../types/error';

export function generateRequestId(prefix = 'req'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export function createAppError(params: {
  code: string;
  message: string;
  details?: string;
  field?: string;
  stage?: string;
  retryable?: boolean;
  requestId?: string;
  whatFailed: string;
  whereFailed: string;
  whyFailed: string;
  whatToDoNext: string;
  action?: AppError['action'];
}): AppError {
  return {
    code: params.code,
    message: params.message,
    details: params.details || params.whyFailed,
    field: params.field,
    stage: params.stage,
    retryable: params.retryable ?? false,
    requestId: params.requestId || generateRequestId('err'),
    whatFailed: params.whatFailed,
    whereFailed: params.whereFailed,
    whyFailed: params.whyFailed,
    whatToDoNext: params.whatToDoNext,
    action: params.action,
  };
}

export function mapFirebaseError(
  err: any,
  context: {
    stage?: string;
    field?: string;
    operation?: string;
    email?: string;
    projectId?: string;
  } = {}
): AppError {
  const code = err?.code || 'UNKNOWN_AUTH_ERROR';
  const stage = context.stage || 'auth';
  const reqId = generateRequestId('auth');

  switch (code) {
    case 'auth/operation-not-allowed':
      return createAppError({
        code: 'AUTH_PROVIDER_DISABLED',
        message: 'Email and password registration is currently unavailable because this sign-in method is disabled in the authentication configuration.',
        details: 'The Email/Password sign-in provider is disabled in Firebase Console for this project.',
        field: context.field || 'email',
        stage,
        retryable: false,
        requestId: reqId,
        whatFailed: 'Account creation with email and password',
        whereFailed: 'Firebase Authentication Provider configuration',
        whyFailed: 'The Email/Password sign-in provider is disabled for this project in the authentication settings.',
        whatToDoNext: 'Enable Email/Password in the Firebase Console, sign in with Google, or continue using the Development Sandbox.',
        action: {
          label: 'Continue in Development Sandbox',
          actionType: 'sandbox_mode',
        },
      });

    case 'auth/email-already-in-use':
      return createAppError({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'An account already exists with this email address. Sign in instead or use password reset if you cannot access your account.',
        details: `An existing user record is already registered with ${context.email || 'this email'}.`,
        field: 'email',
        stage,
        retryable: false,
        requestId: reqId,
        whatFailed: 'Account registration with email',
        whereFailed: 'Firebase Authentication user registry',
        whyFailed: 'The email address is already bound to an existing account.',
        whatToDoNext: 'Sign in with your password, or use the password reset link if you forgot your credentials.',
        action: {
          label: 'Sign In Instead',
          actionType: 'sign_in',
          target: '/sign-in',
        },
      });

    case 'auth/weak-password':
      return createAppError({
        code: 'WEAK_PASSWORD',
        message: 'The password is too weak. Please use at least 6 characters.',
        details: 'Password does not meet Firebase minimum security length criteria.',
        field: 'password',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Password validation',
        whereFailed: 'Registration form password field',
        whyFailed: 'The password is shorter than the 6-character security threshold.',
        whatToDoNext: 'Enter a password with at least 6 characters and try again.',
      });

    case 'auth/invalid-email':
      return createAppError({
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
        details: 'The provided email string does not conform to RFC 5322 format.',
        field: 'email',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Email address validation',
        whereFailed: 'Email input field',
        whyFailed: 'The email format is invalid or contains prohibited characters.',
        whatToDoNext: 'Check for typos in your email address and submit again.',
      });

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return createAppError({
        code: 'INVALID_CREDENTIALS',
        message: "We couldn't sign you in with those credentials. Check your email and password, or reset your password.",
        details: 'Authentication verification rejected: credentials mismatch.',
        field: 'password',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Account credential verification',
        whereFailed: 'Authentication sign-in handler',
        whyFailed: 'The email or password does not match any registered account in our system.',
        whatToDoNext: 'Verify your email and password for typos, or use the reset password link.',
        action: {
          label: 'Reset Password',
          actionType: 'reset_password',
          target: '/forgot-password',
        },
      });

    case 'auth/too-many-requests':
      return createAppError({
        code: 'RATE_LIMITED',
        message: 'Access temporarily disabled due to many failed login attempts. Reset your password or try again later.',
        details: 'Firebase Auth security throttle triggered by repeated failed attempts.',
        stage,
        retryable: false,
        requestId: reqId,
        whatFailed: 'Sign-in rate limiting',
        whereFailed: 'Authentication security gateway',
        whyFailed: 'Too many consecutive failed attempts from this IP address or account.',
        whatToDoNext: 'Reset your password to restore immediate access, or wait 15 minutes before retrying.',
        action: {
          label: 'Reset Password Now',
          actionType: 'reset_password',
          target: '/forgot-password',
        },
      });

    case 'auth/network-request-failed':
      return createAppError({
        code: 'NETWORK_ERROR',
        message: "We couldn't reach the authentication service. Check your connection and retry.",
        details: 'Network transport failure connecting to identitytoolkit.googleapis.com.',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Network connection to authentication service',
        whereFailed: 'Client-to-cloud network transport',
        whyFailed: 'The network connection was lost or the authentication endpoint was unreachable.',
        whatToDoNext: 'Check your internet connection and retry your request.',
        action: {
          label: 'Retry Connection',
          actionType: 'retry',
        },
      });

    case 'auth/popup-closed-by-user':
      return createAppError({
        code: 'AUTH_POPUP_CLOSED',
        message: 'Google sign-in was closed before completion. Please try again.',
        details: 'OAuth popup dialog was dismissed by the user prior to token exchange.',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Google OAuth account authorization',
        whereFailed: 'OAuth popup consent window',
        whyFailed: 'The authorization window was closed before completing the sign-in flow.',
        whatToDoNext: 'Click Google Creator Account again and authorize the session in the popup window.',
      });

    case 'auth/popup-blocked':
      return createAppError({
        code: 'POPUP_BLOCKED',
        message: 'Google sign-in popup was blocked by your browser. Please allow popups for this site.',
        details: 'Browser security policy blocked window.open for OAuth popup.',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: 'Opening Google authentication window',
        whereFailed: 'Browser popup manager',
        whyFailed: 'The browser prevented the authentication popup from opening.',
        whatToDoNext: 'Allow popups for this site in your browser address bar and try again.',
      });

    case 'auth/expired-action-code':
      return createAppError({
        code: 'EXPIRED_ACTION_CODE',
        message: 'This password reset link has expired. Please request a new one.',
        details: 'The Firebase password reset action code has exceeded its time-to-live expiration window.',
        stage,
        retryable: false,
        requestId: reqId,
        whatFailed: 'Password reset link verification',
        whereFailed: 'Firebase Authentication action handler',
        whyFailed: 'The password reset token is older than the allowed time window and is no longer valid.',
        whatToDoNext: 'Request a fresh password reset link from the Forgot Password page.',
        action: {
          label: 'Request New Reset Link',
          actionType: 'reset_password',
          target: '/forgot-password',
        },
      });

    case 'auth/invalid-action-code':
      return createAppError({
        code: 'INVALID_ACTION_CODE',
        message: 'This password reset link is invalid or has already been used.',
        details: 'The Firebase password reset action code is malformed, unrecognized, or previously consumed.',
        stage,
        retryable: false,
        requestId: reqId,
        whatFailed: 'Password reset link verification',
        whereFailed: 'Firebase Authentication action handler',
        whyFailed: 'The reset link is malformed, has expired, or has already been used to change a password.',
        whatToDoNext: 'Request a new password reset link, or try signing in if you already reset your password.',
        action: {
          label: 'Request New Reset Link',
          actionType: 'reset_password',
          target: '/forgot-password',
        },
      });

    default:
      return createAppError({
        code: code.replace('auth/', 'AUTH_').toUpperCase(),
        message: err?.message ? `Authentication error: ${err.message}` : 'An unexpected error occurred during authentication.',
        details: err?.message || 'Underlying authentication service reported an unclassified failure.',
        stage,
        retryable: true,
        requestId: reqId,
        whatFailed: context.operation || 'Authentication operation',
        whereFailed: 'Authentication Service',
        whyFailed: err?.message || 'The authentication service encountered an unexpected error.',
        whatToDoNext: 'Retry the operation. If the issue persists, contact support with reference ID: ' + reqId,
      });
  }
}

export function mapFirestoreError(
  err: any,
  context: {
    path?: string;
    operation?: string;
    userId?: string;
  } = {}
): AppError {
  const reqId = generateRequestId('db');
  const path = context.path || 'unknown';
  const isPermission = err?.message?.includes('permission-denied') || err?.code === 'permission-denied';

  if (isPermission) {
    return createAppError({
      code: 'PERMISSION_DENIED',
      message: "Access denied. You don't have permission to perform this cloud database operation.",
      details: `Firestore security rules rejected operation at path: ${path}`,
      stage: 'database',
      retryable: false,
      requestId: reqId,
      whatFailed: context.operation || 'Database access',
      whereFailed: `Cloud Firestore collection (${path})`,
      whyFailed: 'Security rules enforce user ownership and valid document schema. The current user token does not match document ownership.',
      whatToDoNext: 'Ensure you are signed in with the authorized account that created this resource.',
    });
  }

  return createAppError({
    code: 'DATABASE_ERROR',
    message: 'Cloud database operation failed. Local changes are preserved.',
    details: err?.message || 'Unknown Firestore error',
    stage: 'database',
    retryable: true,
    requestId: reqId,
    whatFailed: context.operation || 'Cloud database sync',
    whereFailed: `Cloud Firestore (${path})`,
    whyFailed: err?.message || 'Database connection was interrupted.',
    whatToDoNext: 'Retry your request or continue working; your data is stored locally.',
  });
}

export function mapApiError(
  data: any,
  status: number,
  context: { stage?: string; fallbackWhat?: string } = {}
): AppError {
  const reqId = data?.error?.requestId || data?.requestId || generateRequestId('api');

  if (data?.error && typeof data.error === 'object') {
    return {
      code: data.error.code || 'API_ERROR',
      message: data.error.message || 'Server request failed.',
      details: data.error.details,
      field: data.error.field,
      stage: data.error.stage || context.stage,
      retryable: !!data.error.retryable,
      requestId: reqId,
      whatFailed: data.error.whatFailed || context.fallbackWhat || 'Server API request',
      whereFailed: data.error.whereFailed || `HTTP ${status} endpoint`,
      whyFailed: data.error.whyFailed || data.error.details || data.error.message || 'Server returned an error',
      whatToDoNext: data.error.whatToDoNext || (data.error.retryable ? 'Retry in a few moments.' : 'Check your inputs and try again.'),
      action: data.error.action,
    };
  }

  const rawMessage = typeof data?.error === 'string' ? data.error : data?.message || 'Server request failed';
  const code = data?.code || (status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'SERVER_ERROR' : 'API_ERROR');

  return createAppError({
    code,
    message: rawMessage,
    stage: context.stage,
    retryable: status >= 500 || status === 429,
    requestId: reqId,
    whatFailed: context.fallbackWhat || 'API endpoint execution',
    whereFailed: `Server API (Status ${status})`,
    whyFailed: rawMessage,
    whatToDoNext: status >= 500 ? 'The server encountered a temporary error. Please retry shortly.' : 'Review request details and verify your session.',
  });
}
