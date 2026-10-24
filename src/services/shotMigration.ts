import {
  Project,
  Scene,
  Shot,
  ShotFraming,
  CameraAngle,
  CameraMovement,
  ShotStatus,
} from '../types';

/**
 * Maps legacy camera framing strings to typed ShotFraming values.
 */
export function mapLegacyFraming(legacyFraming?: string): ShotFraming {
  if (!legacyFraming) return 'medium';
  const lower = legacyFraming.toLowerCase();
  if (lower.includes('wide establishing') || lower.includes('extreme wide')) return 'extreme_wide';
  if (lower.includes('wide')) return 'wide';
  if (lower.includes('close-up') || lower.includes('close up') || lower.includes('close_up')) return 'close_up';
  if (lower.includes('over-the-shoulder') || lower.includes('over the shoulder')) return 'over_the_shoulder';
  if (lower.includes('pov')) return 'pov';
  if (lower.includes('macro')) return 'macro';
  if (lower.includes('medium full') || lower.includes('medium wide')) return 'medium_wide';
  return 'medium';
}

/**
 * Maps legacy camera movement strings or hints to typed CameraMovement.
 */
export function mapLegacyCameraMovement(text?: string): CameraMovement {
  if (!text) return 'static';
  const lower = text.toLowerCase();
  if (lower.includes('pan left') || lower.includes('pan-left')) return 'pan_left';
  if (lower.includes('pan right') || lower.includes('pan-right')) return 'pan_right';
  if (lower.includes('tilt up') || lower.includes('tilt-up')) return 'tilt_up';
  if (lower.includes('tilt down') || lower.includes('tilt-down')) return 'tilt_down';
  if (lower.includes('dolly in') || lower.includes('push in') || lower.includes('dolly_in')) return 'dolly_in';
  if (lower.includes('dolly out') || lower.includes('pull back') || lower.includes('pull-back') || lower.includes('dolly_out')) return 'dolly_out';
  if (lower.includes('zoom in') || lower.includes('zoom_in')) return 'zoom_in';
  if (lower.includes('zoom out') || lower.includes('zoom_out')) return 'zoom_out';
  if (lower.includes('dynamic tracking') || lower.includes('tracking') || lower.includes('track')) return 'tracking';
  if (lower.includes('crane')) return 'crane';
  if (lower.includes('handheld') || lower.includes('shaky')) return 'handheld';
  if (lower.includes('orbital') || lower.includes('orbit') || lower.includes('fly-around')) return 'orbital';
  return 'static';
}

/**
 * Calculates total duration for a scene from its constituent shots.
 * Falls back to scene.estimatedDurationSeconds if no shots exist.
 */
export function calculateSceneDuration(scene: Scene, shots: Shot[] = []): number {
  const sceneShots = shots.filter((s) => s.sceneId === scene.id);
  if (sceneShots.length > 0) {
    return sceneShots.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);
  }
  return Number(scene.estimatedDurationSeconds) || 5;
}

/**
 * Retrieves ordered shots for a scene.
 * Respects scene.shotIds if present, otherwise sorts by shotNumber.
 */
export function getShotsForScene(project: Partial<Project>, sceneId: string): Shot[] {
  const allShots = project.shots || [];
  const sceneShots = allShots.filter((s) => s.sceneId === sceneId);
  const targetScene = (project.scenes || []).find((s) => s.id === sceneId);

  if (targetScene?.shotIds && targetScene.shotIds.length > 0) {
    const shotMap = new Map<string, Shot>();
    sceneShots.forEach((s) => shotMap.set(s.id, s));
    const ordered: Shot[] = [];
    for (const id of targetScene.shotIds) {
      const found = shotMap.get(id);
      if (found) {
        ordered.push(found);
        shotMap.delete(id);
      }
    }
    // Append any shots not in shotIds
    shotMap.forEach((s) => ordered.push(s));
    return ordered;
  }

  return sceneShots.sort((a, b) => (a.shotNumber || 0) - (b.shotNumber || 0));
}

/**
 * Creates a deterministic default Shot from an existing Scene.
 */
export function createDefaultShotForScene(
  projectId: string,
  scene: Scene,
  shotNumber: number = 1
): Shot {
  // Deterministic, stable ID based on scene ID
  const shotId = `shot_${scene.id || 'unknown'}_default`;
  const duration = Math.max(1, Number(scene.estimatedDurationSeconds) || 5);
  const movement = mapLegacyCameraMovement(scene.cameraFraming + ' ' + (scene.visualDescription || ''));
  const framing = mapLegacyFraming(scene.cameraFraming);

  return {
    id: shotId,
    projectId,
    sceneId: scene.id,
    shotNumber,
    name: scene.narrativePurpose
      ? `${scene.narrativePurpose} (Shot ${shotNumber})`
      : `Scene ${scene.sceneNumber || 1} - Take ${shotNumber}`,
    durationSeconds: duration,
    visualIntent: scene.visualDescription || '',
    framing,
    cameraAngle: 'eye_level',
    cameraMovement: movement,
    dialogueSnippet: scene.narrationDialogue || undefined,
    voiceoverSnippet: scene.narrationDialogue || undefined,
    activeAssetId: scene.associatedAssetId || undefined,
    status: (scene.status as ShotStatus) || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pure, non-destructive, idempotent migration helper.
 * Migrates a legacy Project (or already migrated project) to have first-class Shots.
 *
 * Rules:
 * 1. For each scene without shots, create exactly one deterministic default Shot.
 * 2. If shots already exist for a scene, preserve them completely without creating duplicates.
 * 3. Link assets unambiguously when an asset has sceneId and that scene has exactly 1 shot.
 * 4. Preserves all prompts, generation jobs, timeline clips, and original scene fields.
 * 5. Sets schemaVersion = 2.
 * 6. Running repeatedly produces identical, stable results.
 */
export function migrateProjectToShots(project: Project): Project {
  if (!project) return project;

  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const existingShots = Array.isArray(project.shots) ? [...project.shots] : [];

  // Group existing shots by sceneId
  const existingShotsByScene = new Map<string, Shot[]>();
  for (const shot of existingShots) {
    if (!shot || !shot.sceneId) continue;
    const list = existingShotsByScene.get(shot.sceneId) || [];
    list.push(shot);
    existingShotsByScene.set(shot.sceneId, list);
  }

  const updatedShots: Shot[] = [...existingShots];
  const shotIdSet = new Set<string>(existingShots.map((s) => s.id));

  // Migrate or verify shots for each scene
  const updatedScenes: Scene[] = scenes.map((scene, idx) => {
    if (!scene || !scene.id) return scene;

    const currentSceneShots = existingShotsByScene.get(scene.id) || [];

    if (currentSceneShots.length === 0) {
      // Scene has no shots: generate deterministic default shot
      const defaultShot = createDefaultShotForScene(project.id, scene, 1);
      
      // Ensure deterministic ID doesn't collide
      if (!shotIdSet.has(defaultShot.id)) {
        updatedShots.push(defaultShot);
        shotIdSet.add(defaultShot.id);
        existingShotsByScene.set(scene.id, [defaultShot]);
      }

      return {
        ...scene,
        shotIds: [defaultShot.id],
        totalDurationSeconds: defaultShot.durationSeconds,
      };
    } else {
      // Scene already has shots: preserve existing shotIds and calculate duration
      const validShotIds = currentSceneShots.map((s) => s.id);
      const shotIds = (scene.shotIds && scene.shotIds.length > 0)
        ? scene.shotIds
        : validShotIds;

      const totalDuration = calculateSceneDuration(scene, currentSceneShots);

      return {
        ...scene,
        shotIds,
        totalDurationSeconds: totalDuration,
      };
    }
  });

  // Safe, unambiguous asset linking:
  // If an asset has sceneId and that scene has exactly 1 shot, and asset.shotId is not set, link it.
  const updatedAssets = (project.assets || []).map((asset) => {
    if (!asset.sceneId || asset.shotId) return asset;
    const sceneShots = existingShotsByScene.get(asset.sceneId) || [];
    if (sceneShots.length === 1) {
      return {
        ...asset,
        shotId: sceneShots[0].id,
      };
    }
    return asset;
  });

  // Link shot.activeAssetId if unambiguous and not already set
  for (const shot of updatedShots) {
    if (!shot.activeAssetId && shot.sceneId) {
      const scene = updatedScenes.find((s) => s.id === shot.sceneId);
      if (scene?.associatedAssetId) {
        shot.activeAssetId = scene.associatedAssetId;
      } else {
        const matchingAssets = updatedAssets.filter((a) => a.sceneId === shot.sceneId);
        const sceneShots = existingShotsByScene.get(shot.sceneId) || [];
        if (matchingAssets.length === 1 && sceneShots.length === 1) {
          shot.activeAssetId = matchingAssets[0].id;
        }
      }
    }
  }

  // Safe TimelineClip shotId compatibility annotation
  const updatedTimelineClips = (project.timeline?.clips || []).map((clip) => {
    if (!clip.sceneId || clip.shotId) return clip;
    const sceneShots = existingShotsByScene.get(clip.sceneId) || [];
    if (sceneShots.length === 1) {
      return {
        ...clip,
        shotId: sceneShots[0].id,
      };
    }
    return clip;
  });

  const updatedTimeline = project.timeline
    ? {
        ...project.timeline,
        clips: updatedTimelineClips,
      }
    : project.timeline;

  return {
    ...project,
    schemaVersion: 2,
    scenes: updatedScenes,
    shots: updatedShots,
    assets: updatedAssets,
    timeline: updatedTimeline,
  };
}
