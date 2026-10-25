/**
 * Obido Studio — Phase 2 Domain Services
 *
 * Encapsulates core business invariants, validation rules, and transactional
 * domain mutations for Projects, Scenes, Shots, Prompts, Generation Jobs, and Timeline Assets.
 *
 * Guarantees:
 * 1. Strict Project & Tenant ownership containment.
 * 2. Immutable, deterministic reordering and duration rollups.
 * 3. Cascade cleanup of dependent child entities and orphaned references.
 * 4. Isolation of prompt versions per shot.
 * 5. Job deduplication and active-take association.
 */

import {
  Project,
  Scene,
  Shot,
  PromptVersion,
  GenerationJob,
  Asset,
  TimelineClip,
  ShotFraming,
  CameraAngle,
  CameraMovement,
} from '../types';
import {
  calculateSceneDuration,
  getShotsForScene,
  getPromptsForShot,
  getActivePromptForShot,
} from './shotMigration';

export class DomainValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class DomainService {
  // --- 1. Project Access & Ownership Validation ---
  validateProjectAccess(project: Project, userId: string): boolean {
    if (!project || !userId) return false;
    return project.userId === userId;
  }

  assertProjectOwnership(project: Project, userId: string): void {
    if (!this.validateProjectAccess(project, userId)) {
      throw new DomainValidationError(
        `User ${userId} does not have authorization to access project ${project?.id}`,
        'UNAUTHORIZED_PROJECT_ACCESS'
      );
    }
  }

  // --- 2. Entity Containment Verification ---
  assertEntityContainment(
    project: Project,
    entityType: 'scene' | 'shot' | 'prompt' | 'job' | 'asset' | 'clip',
    entityId: string
  ): void {
    switch (entityType) {
      case 'scene': {
        const exists = (project.scenes || []).some((s) => s.id === entityId);
        if (!exists) {
          throw new DomainValidationError(
            `Scene ${entityId} does not belong to project ${project.id}`,
            'SCENE_NOT_FOUND'
          );
        }
        break;
      }
      case 'shot': {
        const exists = (project.shots || []).some((s) => s.id === entityId);
        if (!exists) {
          throw new DomainValidationError(
            `Shot ${entityId} does not belong to project ${project.id}`,
            'SHOT_NOT_FOUND'
          );
        }
        break;
      }
      case 'asset': {
        const exists = (project.assets || []).some((a) => a.id === entityId);
        if (!exists) {
          throw new DomainValidationError(
            `Asset ${entityId} does not belong to project ${project.id}`,
            'ASSET_NOT_FOUND'
          );
        }
        break;
      }
      case 'clip': {
        const exists = (project.timeline?.clips || []).some((c) => c.id === entityId);
        if (!exists) {
          throw new DomainValidationError(
            `Clip ${entityId} does not belong to timeline of project ${project.id}`,
            'CLIP_NOT_FOUND'
          );
        }
        break;
      }
    }
  }

  // --- 3. Scene Management & Cascade Deletion ---
  reorderScenes(
    project: Project,
    sourceIndex: number,
    destinationIndex: number
  ): Project {
    const scenes = [...(project.scenes || [])];
    if (
      sourceIndex < 0 ||
      sourceIndex >= scenes.length ||
      destinationIndex < 0 ||
      destinationIndex >= scenes.length
    ) {
      return project;
    }

    const [moved] = scenes.splice(sourceIndex, 1);
    scenes.splice(destinationIndex, 0, moved);

    const reindexedScenes = scenes.map((sc, i) => ({
      ...sc,
      sceneNumber: i + 1,
    }));

    return {
      ...project,
      scenes: reindexedScenes,
      updatedAt: new Date().toISOString(),
    };
  }

  cascadeDeleteScene(project: Project, sceneId: string): Project {
    const targetScene = (project.scenes || []).find((s) => s.id === sceneId);
    if (!targetScene) return project;

    // Filter scenes and reindex
    const filteredScenes = (project.scenes || [])
      .filter((s) => s.id !== sceneId)
      .map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));

    // Identify dependent shots to cascade delete
    const deletedShotIds = new Set(
      (project.shots || []).filter((sh) => sh.sceneId === sceneId).map((sh) => sh.id)
    );
    const filteredShots = (project.shots || []).filter((sh) => sh.sceneId !== sceneId);

    // Clean up prompts for deleted scene and deleted shots
    const updatedPrompts = { ...(project.prompts || {}) };
    delete updatedPrompts[sceneId];
    deletedShotIds.forEach((shotId) => delete updatedPrompts[shotId]);

    const updatedActivePromptVersion = { ...(project.activePromptVersion || {}) };
    delete updatedActivePromptVersion[sceneId];
    deletedShotIds.forEach((shotId) => delete updatedActivePromptVersion[shotId]);

    // Clean up timeline clips referencing deleted scene
    const updatedClips = (project.timeline?.clips || []).filter(
      (c) => c.sceneId !== sceneId && (!c.shotId || !deletedShotIds.has(c.shotId))
    );

    const updatedTimeline = project.timeline
      ? { ...project.timeline, clips: updatedClips }
      : project.timeline;

    return {
      ...project,
      scenes: filteredScenes,
      shots: filteredShots,
      prompts: updatedPrompts,
      activePromptVersion: updatedActivePromptVersion,
      timeline: updatedTimeline,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- 4. Shot Management & Reordering ---
  reorderShotsInScene(
    project: Project,
    sceneId: string,
    sourceIndex: number,
    destinationIndex: number
  ): Project {
    const scene = (project.scenes || []).find((s) => s.id === sceneId);
    if (!scene) return project;

    const sceneShots = getShotsForScene(project, sceneId);
    if (
      sourceIndex < 0 ||
      sourceIndex >= sceneShots.length ||
      destinationIndex < 0 ||
      destinationIndex >= sceneShots.length
    ) {
      return project;
    }

    const reordered = [...sceneShots];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    const newShotIds = reordered.map((s) => s.id);
    const reindexedSceneShots = reordered.map((s, idx) => ({
      ...s,
      shotNumber: idx + 1,
    }));

    const otherShots = (project.shots || []).filter((s) => s.sceneId !== sceneId);
    const updatedShots = [...otherShots, ...reindexedSceneShots];

    const updatedScenes = (project.scenes || []).map((s) =>
      s.id === sceneId ? { ...s, shotIds: newShotIds } : s
    );

    return {
      ...project,
      scenes: updatedScenes,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };
  }

  cascadeDeleteShot(project: Project, shotId: string): Project {
    const targetShot = (project.shots || []).find((s) => s.id === shotId);
    if (!targetShot) return project;

    const sceneId = targetShot.sceneId;
    const scene = (project.scenes || []).find((s) => s.id === sceneId);

    // Filter shot and reindex within parent scene
    const remainingShots = (project.shots || []).filter((s) => s.id !== shotId);
    const reindexedShots = remainingShots.map((s) => {
      if (s.sceneId === sceneId) {
        const sceneSiblings = remainingShots.filter((item) => item.sceneId === sceneId);
        const idx = sceneSiblings.indexOf(s);
        return { ...s, shotNumber: idx + 1 };
      }
      return s;
    });

    // Clean up shot prompts
    const updatedPrompts = { ...(project.prompts || {}) };
    delete updatedPrompts[shotId];

    const updatedActivePromptVersion = { ...(project.activePromptVersion || {}) };
    delete updatedActivePromptVersion[shotId];

    // Recalculate scene duration and shotIds
    let updatedScenes = project.scenes;
    if (scene) {
      const updatedShotIds = (scene.shotIds || []).filter((id) => id !== shotId);
      const totalDurationSeconds = calculateSceneDuration(scene, reindexedShots);
      updatedScenes = (project.scenes || []).map((s) =>
        s.id === sceneId
          ? {
              ...s,
              shotIds: updatedShotIds,
              totalDurationSeconds,
              estimatedDurationSeconds: totalDurationSeconds,
            }
          : s
      );
    }

    // Clean up or dissociate timeline clips referencing this shot
    const updatedClips = (project.timeline?.clips || []).map((clip) =>
      clip.shotId === shotId ? { ...clip, shotId: undefined } : clip
    );

    const updatedTimeline = project.timeline
      ? { ...project.timeline, clips: updatedClips }
      : project.timeline;

    return {
      ...project,
      scenes: updatedScenes,
      shots: reindexedShots,
      prompts: updatedPrompts,
      activePromptVersion: updatedActivePromptVersion,
      timeline: updatedTimeline,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- 5. Prompt Version Management ---
  createShotPromptVersion(
    project: Project,
    shotId: string,
    promptData: Partial<PromptVersion>
  ): { project: Project; version: PromptVersion } {
    const shot = (project.shots || []).find((s) => s.id === shotId);
    if (!shot) {
      throw new DomainValidationError(`Shot ${shotId} not found in project`, 'SHOT_NOT_FOUND');
    }

    let existingVersions: PromptVersion[] = [];
    if (project.prompts && project.prompts[shotId] && project.prompts[shotId].length > 0) {
      existingVersions = project.prompts[shotId];
    } else if (shot.shotNumber === 1 && project.prompts && project.prompts[shot.sceneId]) {
      existingVersions = project.prompts[shot.sceneId];
    }
    const newVersionNumber = existingVersions.length + 1;
    const versionId = `pv_${shotId}_v${newVersionNumber}_${Date.now().toString(36)}`;

    const newVersion: PromptVersion = {
      id: versionId,
      sceneId: shot.sceneId,
      shotId: shot.id,
      versionNumber: newVersionNumber,
      createdAt: new Date().toISOString(),
      visualPrompt: promptData.visualPrompt || shot.visualIntent || '',
      motionInstructions:
        promptData.motionInstructions ||
        (shot.cameraMovement ? `Camera ${shot.cameraMovement.replace('_', ' ')}` : 'Smooth camera drift'),
      cameraDirection: promptData.cameraDirection || shot.framing || 'medium',
      negativePrompt:
        promptData.negativePrompt ||
        'blurry, flickering, low-res, text artifacts, watermarks, floating limbs, cartoon',
      audioInstructions: promptData.audioInstructions || shot.dialogueSnippet || '',
      targetProvider: promptData.targetProvider || 'gemini_omni',
      targetModel:
        promptData.targetModel ||
        (promptData.targetProvider === 'gemini_omni' ? 'gemini-omni-1.1-flash' : 'external-v1'),
    };

    const updatedPrompts = {
      ...(project.prompts || {}),
      [shot.id]: [newVersion, ...existingVersions.filter((v) => v.id !== versionId)],
      // Backward compatibility: sync primary take (shot 1) with scene-level prompts
      ...(shot.shotNumber === 1
        ? {
            [shot.sceneId]: [
              newVersion,
              ...(project.prompts?.[shot.sceneId] || []).filter((v) => v.id !== versionId),
            ],
          }
        : {}),
    };

    const updatedActivePromptVersion = {
      ...(project.activePromptVersion || {}),
      [shot.id]: versionId,
      ...(shot.shotNumber === 1 ? { [shot.sceneId]: versionId } : {}),
    };

    const updatedShots = (project.shots || []).map((s) =>
      s.id === shotId
        ? {
            ...s,
            activePromptId: versionId,
            status: s.status === 'draft' ? ('prompted' as const) : s.status,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    const updatedProject: Project = {
      ...project,
      prompts: updatedPrompts,
      activePromptVersion: updatedActivePromptVersion,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };

    return { project: updatedProject, version: newVersion };
  }

  activateShotPromptVersion(
    project: Project,
    shotId: string,
    versionId: string
  ): Project {
    const shot = (project.shots || []).find((s) => s.id === shotId);
    if (!shot) return project;

    const updatedActivePromptVersion = {
      ...(project.activePromptVersion || {}),
      [shotId]: versionId,
      ...(shot.shotNumber === 1 ? { [shot.sceneId]: versionId } : {}),
    };

    const updatedShots = (project.shots || []).map((s) =>
      s.id === shotId
        ? {
            ...s,
            activePromptId: versionId,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    return {
      ...project,
      activePromptVersion: updatedActivePromptVersion,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- 6. Generation Job Lifecycle & Deduplication ---
  createDeduplicatedJob(
    project: Project,
    jobData: Omit<GenerationJob, 'id' | 'queuedAt'>,
    deduplicate: boolean = true
  ): { project: Project; job: GenerationJob; isExisting: boolean } {
    if (deduplicate) {
      const existing = (project.generationJobs || []).find(
        (j) =>
          (j.status === 'queued' || j.status === 'processing') &&
          j.taskType === jobData.taskType &&
          ((jobData.shotId && j.shotId === jobData.shotId) ||
            (!jobData.shotId && jobData.sceneId && j.sceneId === jobData.sceneId))
      );
      if (existing) {
        return { project, job: existing, isExisting: true };
      }
    }

    const newJob: GenerationJob = {
      ...jobData,
      id: 'job_' + Math.random().toString(36).substring(2, 9),
      queuedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...project,
      generationJobs: [newJob, ...(project.generationJobs || [])],
      updatedAt: new Date().toISOString(),
    };

    return { project: updatedProject, job: newJob, isExisting: false };
  }

  // --- 7. Asset Take Association ---
  attachActiveTakeAsset(
    project: Project,
    shotId: string,
    assetId: string
  ): Project {
    const shot = (project.shots || []).find((s) => s.id === shotId);
    if (!shot) return project;

    const updatedShots = (project.shots || []).map((s) =>
      s.id === shotId
        ? {
            ...s,
            activeAssetId: assetId,
            status: 'ready' as const,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    return {
      ...project,
      shots: updatedShots,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- 8. Timeline Clip Construction ---
  buildTimelineClipsFromShots(project: Project): TimelineClip[] {
    const shots = project.shots || [];
    if (shots.length === 0) return [];

    let currentStartTime = 0;
    return shots.map((shot, idx) => {
      const duration = Number(shot.durationSeconds) || 5;
      const clip: TimelineClip = {
        id: `clip_shot_${shot.id}`,
        sceneId: shot.sceneId,
        shotId: shot.id,
        assetId: shot.activeAssetId,
        track: 'video',
        startTimeSeconds: currentStartTime,
        durationSeconds: duration,
        sourceInSeconds: 0,
        volume: 1,
        title: shot.name,
        transitionIn: idx === 0 ? 'cut' : 'crossfade',
      };
      currentStartTime += duration;
      return clip;
    });
  }
}

export const domainService = new DomainService();
