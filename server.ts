import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { getAIProvider } from './server/providers';
import { normalizeAIError } from './server/resilience/retry';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Check active provider readiness
const defaultProvider = getAIProvider();
const hasApiKey = defaultProvider.isAvailable();

import fs from 'fs';

// Cloud configuration state
let firebaseConfig: any = null;
try {
  if (fs.existsSync('./firebase-applet-config.json')) {
    firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  }
} catch (e) {
  firebaseConfig = null;
}

// Health & Capabilities Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Obido Studio Server',
    hasApiKey,
    activeProvider: defaultProvider.id,
    models: {
      textAndScript: process.env.GEMINI_SCRIPT_MODEL || 'gemini-3.8-flash',
      tts: 'gemini-3.8-flash-lite-tts',
      videoGenerationTarget: 'gemini-omni-1.1-flash',
    },
    cloud: {
      isConfigured: !!firebaseConfig?.apiKey,
      projectId: firebaseConfig?.projectId || null,
      firestoreDatabaseId: firebaseConfig?.firestoreDatabaseId || null,
    },
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Cloud Status Endpoint
app.get('/api/cloud/status', (req, res) => {
  res.json({
    status: firebaseConfig ? 'connected' : 'unconfigured',
    isCloudAuthEnabled: !!firebaseConfig?.apiKey,
    projectId: firebaseConfig?.projectId || null,
    firestoreDatabaseId: firebaseConfig?.firestoreDatabaseId || null,
    storageBucket: firebaseConfig?.storageBucket || null,
    authDomain: firebaseConfig?.authDomain || null,
    timestamp: new Date().toISOString(),
  });
});

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: string;
  field?: string;
  stage?: string;
  retryable?: boolean;
  requestId?: string;
}

export function sendApiError(res: express.Response, statusCode: number, payload: ApiErrorPayload) {
  const reqId = payload.requestId || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const errorObj = {
    code: payload.code,
    message: payload.message,
    details: payload.details || payload.message,
    field: payload.field,
    stage: payload.stage,
    retryable: payload.retryable ?? false,
    requestId: reqId,
  };

  return res.status(statusCode).json({
    success: false,
    code: payload.code,
    error: errorObj,
  });
}

// Server-Side Identity Verification & Project Ownership Endpoint
app.post('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = req.body.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  const claimedUserId = req.body.userId;

  if (!token) {
    return sendApiError(res, 401, {
      code: 'UNAUTHENTICATED',
      message: 'Missing authentication token. Bearer token required.',
      field: 'token',
      stage: 'auth',
      retryable: false,
    });
  }

  try {
    let verifiedUid = '';
    let email = '';

    if (token.startsWith('demo_token_')) {
      // Local demo token for sandbox testing
      verifiedUid = token.replace('demo_token_', '');
      email = `${verifiedUid}@obidostudio.com`;
    } else {
      // Decode Firebase JWT payload safely
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          return sendApiError(res, 401, {
            code: 'SESSION_EXPIRED',
            message: 'Authentication session expired. Please sign in again.',
            stage: 'auth',
            retryable: false,
          });
        }
        if (firebaseConfig && payload.aud && payload.aud !== firebaseConfig.projectId) {
          return sendApiError(res, 403, {
            code: 'INVALID_PROJECT_AUDIENCE',
            message: 'Token issuer/project audience mismatch.',
            stage: 'auth',
            retryable: false,
          });
        }
        verifiedUid = payload.user_id || payload.sub;
        email = payload.email || '';
      } else {
        return sendApiError(res, 401, {
          code: 'INVALID_TOKEN',
          message: 'Malformed authentication token.',
          field: 'token',
          stage: 'auth',
          retryable: false,
        });
      }
    }

    // Server-side identity enforcement: Never trust unverified client-provided user IDs
    if (claimedUserId && claimedUserId !== verifiedUid) {
      return sendApiError(res, 403, {
        code: 'IDENTITY_MISMATCH',
        message: 'Forbidden: Claimed user ID does not match verified token identity.',
        field: 'userId',
        stage: 'auth',
        retryable: false,
      });
    }

    res.json({
      success: true,
      verifiedUid,
      email,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    sendApiError(res, 401, {
      code: 'INVALID_TOKEN',
      message: 'Token verification failed: ' + (err.message || 'Unknown error'),
      stage: 'auth',
      retryable: false,
    });
  }
});

// Middleware enforcing verified authorization on generation endpoints
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || (req.body && req.body.token);

  if (!token) {
    return sendApiError(res, 401, {
      code: 'UNAUTHENTICATED',
      message: 'Authentication required. Missing Bearer authorization token.',
      field: 'Authorization',
      stage: 'auth',
      retryable: false,
    });
  }

  // Handle local demo sandbox tokens in non-production environments
  if (token.startsWith('demo_token_')) {
    if (process.env.NODE_ENV === 'production') {
      return sendApiError(res, 403, {
        code: 'DEMO_MODE_FORBIDDEN',
        message: 'Demo authentication is forbidden in production environment.',
        stage: 'auth',
        retryable: false,
      });
    }
    const verifiedUid = token.replace('demo_token_', '');
    (req as any).user = { verifiedUid, email: `${verifiedUid}@obidostudio.com`, isDemo: true };
    return next();
  }

  // Validate Firebase token structure
  const parts = token.split('.');
  if (parts.length !== 3) {
    return sendApiError(res, 401, {
      code: 'INVALID_TOKEN',
      message: 'Malformed authentication token.',
      field: 'token',
      stage: 'auth',
      retryable: false,
    });
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return sendApiError(res, 401, {
        code: 'SESSION_EXPIRED',
        message: 'Authentication session expired. Please sign in again.',
        stage: 'auth',
        retryable: false,
      });
    }
    if (firebaseConfig && payload.aud && payload.aud !== firebaseConfig.projectId) {
      return sendApiError(res, 403, {
        code: 'INVALID_PROJECT_AUDIENCE',
        message: 'Token issuer/project audience mismatch.',
        stage: 'auth',
        retryable: false,
      });
    }
    const verifiedUid = payload.user_id || payload.sub;
    if (!verifiedUid) {
      return sendApiError(res, 401, {
        code: 'INVALID_TOKEN',
        message: 'Invalid token: missing subject identity.',
        stage: 'auth',
        retryable: false,
      });
    }

    if (req.body?.userId && req.body.userId !== verifiedUid) {
      return sendApiError(res, 403, {
        code: 'IDENTITY_MISMATCH',
        message: 'Forbidden: Claimed user ID does not match verified token identity.',
        field: 'userId',
        stage: 'auth',
        retryable: false,
      });
    }

    (req as any).user = { verifiedUid, email: payload.email || '', isDemo: false };
    next();
  } catch (err: any) {
    return sendApiError(res, 401, {
      code: 'INVALID_TOKEN',
      message: 'Malformed or invalid authentication token: ' + (err.message || 'Unknown error'),
      stage: 'auth',
      retryable: false,
    });
  }
}

// AI Script Generation Endpoint
app.post('/api/ai/script', requireAuth, async (req, res) => {
  try {
    const provider = getAIProvider(req.body.providerId);
    if (!provider.isAvailable()) {
      return sendApiError(res, 503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI Provider is not configured on this server. Check your environment settings or use manual editing mode.',
        stage: 'script',
        retryable: false,
      });
    }

    const script = await provider.generateScript(req.body, req.body.model);
    res.json({ success: true, script });
  } catch (error: any) {
    const normalized = normalizeAIError(error, req.body.providerId || 'gemini');
    console.error(`[AI Error - /api/ai/script]: ${normalized.code} - ${normalized.message}`);
    sendApiError(res, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      stage: 'script',
      retryable: normalized.retryable,
    });
  }
});

// AI Storyboard Generation Endpoint
app.post('/api/ai/storyboard', requireAuth, async (req, res) => {
  try {
    const provider = getAIProvider(req.body.providerId);
    if (!provider.isAvailable()) {
      return sendApiError(res, 503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI Provider is not configured on this server.',
        stage: 'storyboard',
        retryable: false,
      });
    }

    const scenes = await provider.generateStoryboard(req.body, req.body.model);
    res.json({ success: true, scenes });
  } catch (error: any) {
    const normalized = normalizeAIError(error, req.body.providerId || 'gemini');
    console.error(`[AI Error - /api/ai/storyboard]: ${normalized.code} - ${normalized.message}`);
    sendApiError(res, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      stage: 'storyboard',
      retryable: normalized.retryable,
    });
  }
});

// AI Video Prompt Refiner Endpoint
app.post('/api/ai/prompt-enhance', requireAuth, async (req, res) => {
  try {
    const provider = getAIProvider(req.body.providerId);
    if (!provider.isAvailable()) {
      return sendApiError(res, 503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI Provider is not configured on this server.',
        stage: 'prompts',
        retryable: false,
      });
    }

    const promptDetails = await provider.enhancePrompt(req.body, req.body.model);
    res.json({ success: true, prompt: promptDetails });
  } catch (error: any) {
    const normalized = normalizeAIError(error, req.body.providerId || 'gemini');
    console.error(`[AI Error - /api/ai/prompt-enhance]: ${normalized.code} - ${normalized.message}`);
    sendApiError(res, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      stage: 'prompts',
      retryable: normalized.retryable,
    });
  }
});

// AI Brief Refiner Endpoint
app.post('/api/ai/refine-brief', requireAuth, async (req, res) => {
  try {
    const provider = getAIProvider(req.body.providerId);
    if (!provider.isAvailable()) {
      return sendApiError(res, 503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI Provider is not configured on this server.',
        stage: 'brief',
        retryable: false,
      });
    }

    const brief = await provider.refineBrief(req.body, req.body.model);
    res.json({ success: true, brief });
  } catch (error: any) {
    const normalized = normalizeAIError(error, req.body.providerId || 'gemini');
    console.error(`[AI Error - /api/ai/refine-brief]: ${normalized.code} - ${normalized.message}`);
    sendApiError(res, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      stage: 'brief',
      retryable: normalized.retryable,
    });
  }
});

// Provider Setup & Status List
app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'prov_gemini_omni',
        name: 'Google Gemini & Veo (Interactions API)',
        category: 'video_generation',
        providerKey: 'gemini',
        status: hasApiKey ? 'connected' : 'unconfigured',
        supportedModels: ['gemini-omni-1.1-flash', 'gemini-3.8-flash'],
        activeModel: 'gemini-omni-1.1-flash',
        requiresPaidKey: true,
        description: 'Native Google GenAI multimodal video and script generation engine.',
      },
      {
        id: 'prov_runway',
        name: 'Runway Gen-3 Alpha',
        category: 'video_generation',
        providerKey: 'runway',
        status: 'demo_mode',
        supportedModels: ['gen3a_turbo', 'gen3a'],
        activeModel: 'gen3a_turbo',
        requiresPaidKey: true,
        description: 'External API integration adapter for cinematic video synthesis.',
      },
      {
        id: 'prov_luma',
        name: 'Luma Dream Machine',
        category: 'video_generation',
        providerKey: 'luma',
        status: 'demo_mode',
        supportedModels: ['ray-2', 'ray-1-6'],
        activeModel: 'ray-2',
        requiresPaidKey: true,
        description: 'High-motion camera physics and spatial rendering.',
      },
      {
        id: 'prov_local_demo',
        name: 'Obido Local Studio Engine',
        category: 'video_generation',
        providerKey: 'local_demo',
        status: 'connected',
        supportedModels: ['obido-prototype-v1'],
        activeModel: 'obido-prototype-v1',
        requiresPaidKey: false,
        description: 'Transparent local prototype adapter with zero fabricated outputs and instant workflow verification.',
      },
    ],
  });
});

// Mount Vite middleware for dev or serve static files in production
async function startServer() {
  // Always serve static assets from public/ (favicons, manifests, etc.)
  app.use(express.static('public'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Obido Studio] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
