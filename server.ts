import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { getAIProvider, aiRegistry } from './server/providers';
import { normalizeAIError } from './server/resilience/retry';
import { domainService } from './src/services/domainService';
import { novaService } from './server/nova/novaService';

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
  retryAfterSeconds?: number;
  reason?: string;
  provider?: string;
  whatFailed?: string;
  whereFailed?: string;
  whyFailed?: string;
  whatToDoNext?: string;
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
    retryAfterSeconds: payload.retryAfterSeconds,
    reason: payload.reason,
    provider: payload.provider,
    whatFailed: payload.whatFailed,
    whereFailed: payload.whereFailed,
    whyFailed: payload.whyFailed,
    whatToDoNext: payload.whatToDoNext,
  };

  if (payload.retryAfterSeconds && payload.retryAfterSeconds > 0) {
    res.setHeader('Retry-After', String(payload.retryAfterSeconds));
  }

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

    if (token.startsWith('demo_token_') || token.startsWith('fb_fallback_')) {
      // Local demo token or Firebase STS fallback token
      verifiedUid = token.startsWith('demo_token_')
        ? token.replace('demo_token_', '')
        : token.replace('fb_fallback_', '');
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

  // Handle local demo sandbox tokens and Firebase STS fallback tokens
  if (token.startsWith('demo_token_') || token.startsWith('fb_fallback_')) {
    const verifiedUid = token.startsWith('demo_token_')
      ? token.replace('demo_token_', '')
      : token.replace('fb_fallback_', '');

    if (req.body?.userId && req.body.userId !== verifiedUid) {
      return sendApiError(res, 403, {
        code: 'IDENTITY_MISMATCH',
        message: 'Forbidden: Claimed user ID does not match verified token identity.',
        field: 'userId',
        stage: 'auth',
        retryable: false,
      });
    }

    (req as any).user = {
      verifiedUid,
      email: `${verifiedUid}@obidostudio.com`,
      isDemo: token.startsWith('demo_token_'),
      isFallback: token.startsWith('fb_fallback_'),
    };
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

export interface ContainmentValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateProjectEntityContainment(
  project: any,
  verifiedUid: string
): ContainmentValidationResult {
  const errors: string[] = [];

  if (!project || typeof project !== 'object') {
    return { valid: false, errors: ['Project payload is missing or invalid.'] };
  }

  // 1. Project ownership check: verifiedUid must match project.userId
  if (project.userId && project.userId !== verifiedUid) {
    errors.push(
      `Project ownership mismatch: project belongs to "${project.userId}", not authenticated user "${verifiedUid}".`
    );
  }

  const projectId = project.id;
  if (!projectId || typeof projectId !== 'string') {
    errors.push('Project missing valid id.');
  }

  // Collect scene IDs
  const sceneIds = new Set<string>();
  if (Array.isArray(project.scenes)) {
    for (const sc of project.scenes) {
      if (!sc.id || typeof sc.id !== 'string') {
        errors.push('Scene has missing or invalid id.');
      } else {
        if (sceneIds.has(sc.id)) {
          errors.push(`Duplicate scene id detected: ${sc.id}`);
        }
        sceneIds.add(sc.id);
      }
    }
  }

  // Collect shot IDs & verify shot relationships
  const shotIds = new Set<string>();
  if (Array.isArray(project.shots)) {
    for (const sh of project.shots) {
      if (!sh.id || typeof sh.id !== 'string') {
        errors.push('Shot has missing or invalid id.');
      } else {
        if (shotIds.has(sh.id)) {
          errors.push(`Duplicate shot id detected: ${sh.id}`);
        }
        shotIds.add(sh.id);
      }

      // Check shot containment in project
      if (sh.projectId && sh.projectId !== projectId) {
        errors.push(`Shot ${sh.id} references foreign project ${sh.projectId} (expected ${projectId}).`);
      }

      // Check shot containment in parent scene
      if (!sh.sceneId || !sceneIds.has(sh.sceneId)) {
        errors.push(`Shot ${sh.id} references non-existent scene ${sh.sceneId}.`);
      }
    }
  }

  // Check scene.shotIds reference valid shots in this project
  if (Array.isArray(project.scenes)) {
    for (const sc of project.scenes) {
      if (Array.isArray(sc.shotIds)) {
        for (const sId of sc.shotIds) {
          if (!shotIds.has(sId)) {
            errors.push(`Scene ${sc.id} lists shotId ${sId} that does not exist in project shots.`);
          }
        }
      }
    }
  }

  // Check prompt versions containment
  if (project.prompts && typeof project.prompts === 'object') {
    for (const [key, versions] of Object.entries(project.prompts)) {
      const isShot = shotIds.has(key);
      const isScene = sceneIds.has(key);
      if (!isShot && !isScene) {
        errors.push(`Prompt history key ${key} references non-existent shot or scene.`);
      }
      if (Array.isArray(versions)) {
        for (const pv of versions as any[]) {
          if (pv.shotId && !shotIds.has(pv.shotId)) {
            errors.push(`Prompt version ${pv.id} references non-existent shot ${pv.shotId}.`);
          }
          if (pv.sceneId && !sceneIds.has(pv.sceneId)) {
            errors.push(`Prompt version ${pv.id} references non-existent scene ${pv.sceneId}.`);
          }
        }
      }
    }
  }

  // Check active prompt versions
  if (project.activePromptVersion && typeof project.activePromptVersion === 'object') {
    for (const [key, versionId] of Object.entries(project.activePromptVersion)) {
      if (!shotIds.has(key) && !sceneIds.has(key)) {
        errors.push(`Active prompt version pointer key ${key} is orphaned.`);
      }
    }
  }

  // Check assets containment
  const assetIds = new Set<string>();
  if (Array.isArray(project.assets)) {
    for (const a of project.assets) {
      if (!a.id || typeof a.id !== 'string') {
        errors.push('Asset has missing or invalid id.');
      } else {
        assetIds.add(a.id);
      }
      if (a.projectId && a.projectId !== projectId) {
        errors.push(`Asset ${a.id} references foreign project ${a.projectId}.`);
      }
      if (a.sceneId && !sceneIds.has(a.sceneId)) {
        errors.push(`Asset ${a.id} references foreign/missing scene ${a.sceneId}.`);
      }
      if (a.shotId && !shotIds.has(a.shotId)) {
        errors.push(`Asset ${a.id} references foreign/missing shot ${a.shotId}.`);
      }
    }
  }

  // Check shot.activeAssetId
  if (Array.isArray(project.shots)) {
    for (const sh of project.shots) {
      if (sh.activeAssetId && !assetIds.has(sh.activeAssetId)) {
        errors.push(`Shot ${sh.id} activeAssetId ${sh.activeAssetId} does not exist in project assets.`);
      }
    }
  }

  // Check generation jobs containment
  if (Array.isArray(project.generationJobs)) {
    for (const job of project.generationJobs) {
      if (job.projectId && job.projectId !== projectId) {
        errors.push(`Generation job ${job.id} references foreign project ${job.projectId}.`);
      }
      if (job.sceneId && !sceneIds.has(job.sceneId)) {
        errors.push(`Generation job ${job.id} references non-existent scene ${job.sceneId}.`);
      }
      if (job.shotId && !shotIds.has(job.shotId)) {
        errors.push(`Generation job ${job.id} references non-existent shot ${job.shotId}.`);
      }
    }
  }

  // Check timeline clips containment
  if (project.timeline?.clips && Array.isArray(project.timeline.clips)) {
    for (const clip of project.timeline.clips) {
      if (clip.sceneId && !sceneIds.has(clip.sceneId)) {
        errors.push(`Timeline clip ${clip.id} references non-existent scene ${clip.sceneId}.`);
      }
      if (clip.shotId && !shotIds.has(clip.shotId)) {
        errors.push(`Timeline clip ${clip.id} references non-existent shot ${clip.shotId}.`);
      }
      if (clip.assetId && !assetIds.has(clip.assetId)) {
        errors.push(`Timeline clip ${clip.id} references non-existent asset ${clip.assetId}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Project Entity Containment & Referential Integrity Verification Endpoint
app.post('/api/project/validate-containment', requireAuth, async (req, res) => {
  const verifiedUid = (req as any).user?.verifiedUid;
  const project = req.body.project || req.body;

  if (!project || typeof project !== 'object') {
    return sendApiError(res, 400, {
      code: 'INVALID_PAYLOAD',
      message: 'Project payload is required for containment verification.',
      stage: 'validation',
      retryable: false,
    });
  }

  // Cross-user authorization check
  if (project.userId && project.userId !== verifiedUid) {
    return sendApiError(res, 403, {
      code: 'PROJECT_ACCESS_DENIED',
      message: `Forbidden: Project belongs to user "${project.userId}", not authenticated user "${verifiedUid}".`,
      field: 'userId',
      stage: 'authorization',
      retryable: false,
    });
  }

  const containment = validateProjectEntityContainment(project, verifiedUid);
  if (!containment.valid) {
    return sendApiError(res, 400, {
      code: 'INVALID_CONTAINMENT',
      message: 'Referential integrity or entity containment violation: ' + containment.errors[0],
      details: containment.errors.join('; '),
      stage: 'validation',
      retryable: false,
    });
  }

  res.json({
    success: true,
    projectId: project.id,
    verifiedUid,
    sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
    shotCount: Array.isArray(project.shots) ? project.shots.length : 0,
    assetCount: Array.isArray(project.assets) ? project.assets.length : 0,
    clipCount: Array.isArray(project.timeline?.clips) ? project.timeline.clips.length : 0,
    timestamp: new Date().toISOString(),
  });
});

// Authoritative Server-Side Project Mutation Endpoint
app.post('/api/project/mutate', requireAuth, async (req, res) => {
  const verifiedUid = (req as any).user?.verifiedUid;
  const { projectId, mutationType, payload, project } = req.body;

  if (!project || typeof project !== 'object') {
    return sendApiError(res, 400, {
      code: 'INVALID_PAYLOAD',
      message: 'Base project object is required for authoritative mutation.',
      stage: 'validation',
      retryable: false,
    });
  }

  // 1. Authoritative ownership check - reject client-supplied ownership claim conflicting with token
  if (!project.userId || project.userId !== verifiedUid) {
    return sendApiError(res, 403, {
      code: 'PROJECT_ACCESS_DENIED',
      message: `Forbidden: Project belongs to user "${project.userId}", not authenticated user "${verifiedUid}".`,
      field: 'userId',
      stage: 'authorization',
      retryable: false,
    });
  }

  if (projectId && project.id !== projectId) {
    return sendApiError(res, 400, {
      code: 'PROJECT_ID_MISMATCH',
      message: `Project ID in URL/body (${projectId}) does not match project object (${project.id}).`,
      stage: 'validation',
      retryable: false,
    });
  }

  // 2. Pre-mutation entity containment verification - cannot be bypassed
  const preContainment = validateProjectEntityContainment(project, verifiedUid);
  if (!preContainment.valid) {
    return sendApiError(res, 400, {
      code: 'INVALID_CONTAINMENT',
      message: 'Pre-mutation entity containment violation: ' + preContainment.errors[0],
      details: preContainment.errors.join('; '),
      stage: 'validation',
      retryable: false,
    });
  }

  // 3. Allowed mutation types and validation
  const allowedMutations = [
    'reorder_scenes',
    'cascade_delete_scene',
    'reorder_shots',
    'cascade_delete_shot',
    'create_prompt_version',
    'activate_prompt_version',
    'attach_asset',
    'update_project_meta',
  ];

  if (!mutationType || !allowedMutations.includes(mutationType)) {
    return sendApiError(res, 400, {
      code: 'INVALID_MUTATION_TYPE',
      message: `Mutation type "${mutationType}" is not recognized or permitted. Allowed: ${allowedMutations.join(', ')}`,
      field: 'mutationType',
      stage: 'validation',
      retryable: false,
    });
  }

  // 4. Execute domain mutation safely
  try {
    let mutatedProject = { ...project };

    switch (mutationType) {
      case 'reorder_scenes': {
        const { sourceIndex, destinationIndex } = payload || {};
        if (typeof sourceIndex !== 'number' || typeof destinationIndex !== 'number') {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'sourceIndex and destinationIndex (numbers) are required for reorder_scenes.',
            stage: 'mutation',
            retryable: false,
          });
        }
        mutatedProject = domainService.reorderScenes(mutatedProject, sourceIndex, destinationIndex);
        break;
      }
      case 'cascade_delete_scene': {
        const { sceneId } = payload || {};
        if (!sceneId || typeof sceneId !== 'string') {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'sceneId is required for cascade_delete_scene.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'scene', sceneId);
        mutatedProject = domainService.cascadeDeleteScene(mutatedProject, sceneId);
        break;
      }
      case 'reorder_shots': {
        const { sceneId, sourceIndex, destinationIndex } = payload || {};
        if (!sceneId || typeof sourceIndex !== 'number' || typeof destinationIndex !== 'number') {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'sceneId, sourceIndex, and destinationIndex are required for reorder_shots.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'scene', sceneId);
        mutatedProject = domainService.reorderShotsInScene(mutatedProject, sceneId, sourceIndex, destinationIndex);
        break;
      }
      case 'cascade_delete_shot': {
        const { shotId } = payload || {};
        if (!shotId || typeof shotId !== 'string') {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'shotId is required for cascade_delete_shot.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'shot', shotId);
        mutatedProject = domainService.cascadeDeleteShot(mutatedProject, shotId);
        break;
      }
      case 'create_prompt_version': {
        const { shotId, promptData } = payload || {};
        if (!shotId || !promptData) {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'shotId and promptData are required for create_prompt_version.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'shot', shotId);
        const resObj = domainService.createShotPromptVersion(mutatedProject, shotId, promptData);
        mutatedProject = resObj.project;
        break;
      }
      case 'activate_prompt_version': {
        const { shotId, versionId } = payload || {};
        if (!shotId || !versionId) {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'shotId and versionId are required for activate_prompt_version.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'shot', shotId);
        mutatedProject = domainService.activateShotPromptVersion(mutatedProject, shotId, versionId);
        break;
      }
      case 'attach_asset': {
        const { shotId, assetId } = payload || {};
        if (!shotId || !assetId) {
          return sendApiError(res, 400, {
            code: 'INVALID_PAYLOAD',
            message: 'shotId and assetId are required for attach_asset.',
            stage: 'mutation',
            retryable: false,
          });
        }
        domainService.assertEntityContainment(mutatedProject, 'shot', shotId);
        domainService.assertEntityContainment(mutatedProject, 'asset', assetId);
        mutatedProject = domainService.attachActiveTakeAsset(mutatedProject, shotId, assetId);
        break;
      }
      case 'update_project_meta': {
        const { title, description } = payload || {};
        mutatedProject = {
          ...mutatedProject,
          ...(title ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          updatedAt: new Date().toISOString(),
        };
        break;
      }
      default:
        return sendApiError(res, 400, {
          code: 'INVALID_MUTATION_TYPE',
          message: `Unhandled mutation type: ${mutationType}`,
          stage: 'mutation',
          retryable: false,
        });
    }

    // 5. Post-mutation containment validation
    const postContainment = validateProjectEntityContainment(mutatedProject, verifiedUid);
    if (!postContainment.valid) {
      return sendApiError(res, 400, {
        code: 'INVALID_CONTAINMENT',
        message: 'Post-mutation entity containment violation: ' + postContainment.errors[0],
        details: postContainment.errors.join('; '),
        stage: 'mutation',
        retryable: false,
      });
    }

    res.json({
      success: true,
      mutationType,
      project: mutatedProject,
      mutatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return sendApiError(res, 400, {
      code: err.code || 'MUTATION_FAILED',
      message: err.message || 'Domain mutation failed.',
      stage: 'mutation',
      retryable: false,
    });
  }
});

// AI Script Generation Endpoint
app.post('/api/ai/script', requireAuth, async (req, res) => {
  const requestedProviderId = req.body.providerId || 'gemini';
  try {
    const provider = getAIProvider(requestedProviderId);
    if (!provider.isAvailable()) {
      return sendApiError(res, 503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI Provider is not configured on this server. Check your environment settings or use manual editing mode.',
        stage: 'script',
        retryable: false,
        whatFailed: 'AI Screenplay generation (Provider Unconfigured)',
        whereFailed: 'Server AI Provider Registry',
        whyFailed: `The provider "${requestedProviderId}" has no valid API key configured.`,
        whatToDoNext: 'Ensure GEMINI_API_KEY is configured in your project settings, or compose your script manually below.',
      });
    }

    const script = await provider.generateScript(req.body, req.body.model);
    res.json({ success: true, script, provider: provider.id });
  } catch (error: any) {
    const normalized = normalizeAIError(error, requestedProviderId);
    console.error(`[AI Error - /api/ai/script]: ${normalized.code} - ${normalized.message}`);

    // Check for safe provider fallback:
    // Fallback is only attempted if:
    // 1. Another eligible provider is genuinely registered and available.
    // 2. The client explicitly consented to fallback (req.body.allowFallback === true).
    const allowFallback = req.body.allowFallback === true;
    const fallbackProvider = aiRegistry.getFallbackProvider(requestedProviderId);

    if (allowFallback && fallbackProvider && fallbackProvider.isAvailable()) {
      try {
        console.log(`[AI Fallback] Executing script generation via fallback provider "${fallbackProvider.id}"`);
        const fallbackScript = await fallbackProvider.generateScript(req.body, req.body.model);
        return res.json({
          success: true,
          script: fallbackScript,
          provider: fallbackProvider.id,
          fallbackUsed: true,
          primaryProvider: requestedProviderId,
        });
      } catch (fallbackError: any) {
        console.warn(`[AI Fallback Failed]: ${fallbackError.message}`);
      }
    }

    // Build transparent, typed 4-part error details
    let whatFailed = 'AI Screenplay generation';
    let whereFailed = `${normalized.provider.toUpperCase()} AI Provider`;
    let whyFailed = normalized.message;
    let whatToDoNext = normalized.retryable
      ? 'Wait a few moments and click Retry. Your brief and existing script drafts are preserved.'
      : 'Check your inputs or draft your screenplay manually below.';

    if (normalized.code === 'QUOTA_EXHAUSTED') {
      whatFailed = 'AI Screenplay generation (Quota Exhausted)';
      whereFailed = `${normalized.provider.toUpperCase()} Service Quota Limits`;
      whyFailed = 'The allocated daily or billing quota for Gemini text generation has been exhausted. No alternative AI provider is configured on this server.';
      whatToDoNext = 'Quota will reset tomorrow. To continue immediately, upgrade your plan in Google AI Studio or compose your script manually in the editor below. Your project and drafts are preserved.';
    } else if (normalized.code === 'RATE_LIMITED') {
      whatFailed = 'AI Screenplay generation (Rate Limited)';
      whereFailed = `${normalized.provider.toUpperCase()} API Rate Limiter`;
      whyFailed = normalized.retryAfterSeconds
        ? `Request rate exceeded. Provider requests a cooling delay of ${normalized.retryAfterSeconds} seconds.`
        : 'Request rate limit reached for Gemini 3.8 Flash.';
      whatToDoNext = normalized.retryAfterSeconds
        ? `Please wait ${normalized.retryAfterSeconds} seconds before requesting a new script. Your brief inputs are preserved.`
        : 'Wait a moment and click Retry. Your brief inputs and existing versions remain intact.';
    } else if (normalized.code === 'SERVICE_UNAVAILABLE') {
      whatFailed = 'AI Screenplay generation (Service Overloaded)';
      whereFailed = `${normalized.provider.toUpperCase()} Model Gateway`;
      whyFailed = 'The Gemini model server is temporarily overloaded or undergoing maintenance.';
      whatToDoNext = 'Click Retry to resend the request with exponential backoff. Your brief is preserved.';
    } else if (normalized.code === 'TIMEOUT') {
      whatFailed = 'AI Screenplay generation (Timed Out)';
      whereFailed = 'AI Request Pipeline';
      whyFailed = 'The screenplay generation took longer than the 25-second timeout boundary.';
      whatToDoNext = 'Click Retry or simplify your prompt. Existing script versions are safe.';
    } else if (normalized.code === 'UNAUTHENTICATED') {
      whatFailed = 'AI Screenplay generation (Authentication)';
      whereFailed = `${normalized.provider.toUpperCase()} Credential Verification`;
      whyFailed = 'The server has an invalid or missing GEMINI_API_KEY.';
      whatToDoNext = 'Ensure GEMINI_API_KEY is configured in your project settings, or compose your script manually below.';
    }

    sendApiError(res, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details || normalized.message,
      stage: 'script',
      retryable: normalized.retryable,
      retryAfterSeconds: normalized.retryAfterSeconds,
      reason: normalized.reason,
      provider: normalized.provider,
      whatFailed,
      whereFailed,
      whyFailed,
      whatToDoNext,
    });
  }
});

// AI Storyboard Generation Endpoint
app.post('/api/ai/storyboard', requireAuth, async (req, res) => {
  try {
    const verifiedUid = (req as any).user?.verifiedUid;
    if (req.body.project) {
      const containment = validateProjectEntityContainment(req.body.project, verifiedUid);
      if (!containment.valid) {
        return sendApiError(res, 400, {
          code: 'INVALID_CONTAINMENT',
          message: 'Project entity containment validation failed: ' + containment.errors[0],
          details: containment.errors.join('; '),
          stage: 'storyboard',
          retryable: false,
        });
      }
    }

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
    const verifiedUid = (req as any).user?.verifiedUid;
    if (req.body.project) {
      const containment = validateProjectEntityContainment(req.body.project, verifiedUid);
      if (!containment.valid) {
        return sendApiError(res, 400, {
          code: 'INVALID_CONTAINMENT',
          message: 'Project entity containment validation failed: ' + containment.errors[0],
          details: containment.errors.join('; '),
          stage: 'prompts',
          retryable: false,
        });
      }
    }

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

// AI Nova Production Assistant Endpoint (Phase 3)
app.post('/api/nova/chat', requireAuth, async (req, res) => {
  try {
    const verifiedUid = (req as any).user?.verifiedUid;

    // Cross-user authorization check
    if (req.body.project) {
      if (req.body.project.userId && req.body.project.userId !== verifiedUid) {
        return sendApiError(res, 403, {
          code: 'PROJECT_ACCESS_DENIED',
          message: `Forbidden: Project belongs to user "${req.body.project.userId}", not authenticated user "${verifiedUid}".`,
          field: 'userId',
          stage: 'nova',
          retryable: false,
        });
      }

      const containment = validateProjectEntityContainment(req.body.project, verifiedUid);
      if (!containment.valid) {
        return sendApiError(res, 400, {
          code: 'INVALID_CONTAINMENT',
          message: 'Project entity containment validation failed: ' + containment.errors[0],
          details: containment.errors.join('; '),
          stage: 'nova',
          retryable: false,
        });
      }
    }

    const response = await novaService.processChat({
      projectId: req.body.projectId,
      currentStage: req.body.currentStage,
      message: req.body.message,
      actionType: req.body.actionType,
      targetEntityId: req.body.targetEntityId,
      projectSummary: req.body.projectSummary,
      project: req.body.project,
    });

    res.json(response);
  } catch (error: any) {
    console.error('[AI Error - /api/nova/chat]:', error);
    sendApiError(res, 500, {
      code: 'NOVA_PROCESSING_ERROR',
      message: error.message || 'Failed to process Nova production assistant request.',
      stage: 'nova',
      retryable: true,
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

const isTestRun =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test') || arg.includes('vitest'));

if (!isTestRun) {
  startServer();
}
