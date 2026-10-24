/**
 * Obido Studio — Scenes & First-Class Shot List Domain Test Suite
 * 
 * Verifies:
 * 1. Migration of a legacy project containing multiple scenes
 * 2. Preservation of scene IDs and original narrative data
 * 3. Deterministic IDs and idempotent repeated migration
 * 4. Safe handling of empty scenes, missing durations, and missing optional fields
 * 5. Preservation and unambiguous linkage of prompts, assets, jobs, and timeline clips
 * 6. Correct shot ordering, reordering, and duration aggregation
 * 7. Tenant & Project isolation (no cross-project shot leaks)
 * 8. StorageService shot CRUD operations, cascading deletions, and lifecycle consistency
 */

import assert from 'assert';
import { Project, Scene, Shot } from '../src/types';
import {
  migrateProjectToShots,
  calculateSceneDuration,
  getShotsForScene,
  createDefaultShotForScene,
  mapLegacyFraming,
  mapLegacyCameraMovement,
} from '../src/services/shotMigration';
import { storage } from '../src/services/storage';

async function runShotDomainTests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Scenes & Shot List Domain Test Suite                  ');
  console.log('========================================================================');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.stack || err.message}`);
      failed++;
    }
  }

  // --- Mock Fixtures ---
  const createLegacyProject = (id: string, scenesCount: number = 3): Project => {
    const scenes: Scene[] = [];
    for (let i = 1; i <= scenesCount; i++) {
      scenes.push({
        id: `sc_legacy_${id}_${i}`,
        sceneNumber: i,
        narrativePurpose: `Scene ${i} dramatic progression for ${id}`,
        estimatedDurationSeconds: 8 + i * 2, // 10s, 12s, 14s...
        visualDescription: `Cinematic wide shot of server facility with amber lights for scene ${i}`,
        narrationDialogue: `Voiceover dialogue text line for scene ${i}.`,
        audioCues: `Low sub-bass drone and mechanical relay click ${i}`,
        cameraFraming: i === 1 ? 'Wide establishing' : i === 2 ? 'Close-up' : 'POV / Macro',
        status: i === 1 ? 'approved' : 'ready_for_prompt',
      });
    }

    return {
      id,
      userId: 'user_test_owner',
      title: `Legacy Test Video ${id}`,
      description: 'Project before Shot model introduction',
      currentStage: 'storyboard',
      completedStages: ['brief', 'script'],
      brief: {
        title: `Legacy Test Video ${id}`,
        purpose: 'explainer',
        targetAudience: 'Engineers',
        language: 'English',
        aspectRatio: '16:9',
        targetDurationSeconds: 60,
        visualStyle: 'cinematic_photorealistic',
        rawIdea: 'Automated data pipelines',
        keyTakeaway: 'Zero downtime',
        toneOfVoice: 'Technical and clean',
        callToAction: 'Book benchmark',
        lastUpdated: new Date().toISOString(),
      },
      scripts: [
        {
          id: `script_${id}_v1`,
          versionNumber: 1,
          createdAt: new Date().toISOString(),
          title: 'Draft Script',
          logline: 'Logline text',
          hook: 'Hook sentence',
          fullText: 'Full script content',
          estimatedSpeakingWords: 120,
          estimatedDurationSeconds: 60,
          isCurrent: true,
        },
      ],
      currentScriptId: `script_${id}_v1`,
      scenes,
      prompts: {
        [`sc_legacy_${id}_1`]: [
          {
            id: `p_${id}_1`,
            sceneId: `sc_legacy_${id}_1`,
            versionNumber: 1,
            createdAt: new Date().toISOString(),
            visualPrompt: 'Detailed render prompt for scene 1',
            motionInstructions: 'Smooth dolly in',
            cameraDirection: 'Wide establishing',
            negativePrompt: 'blurry, flickering',
            audioInstructions: 'Low hum',
            targetProvider: 'gemini_omni',
            targetModel: 'gemini-omni-1.1-flash',
            isFavorite: true,
          },
        ],
      },
      activePromptVersion: {
        [`sc_legacy_${id}_1`]: `p_${id}_1`,
      },
      assets: [
        {
          id: `asset_${id}_1`,
          projectId: id,
          sceneId: `sc_legacy_${id}_1`,
          name: 'Scene 1 Take 1',
          type: 'video',
          url: 'https://storage.googleapis.com/test/video1.mp4',
          filesizeBytes: 12400000,
          durationSeconds: 10,
          format: 'mp4',
          provider: 'gemini_omni',
          createdAt: new Date().toISOString(),
          isSimulatedDemo: false,
        },
      ],
      generationJobs: [
        {
          id: `job_${id}_1`,
          projectId: id,
          sceneId: `sc_legacy_${id}_1`,
          taskType: 'text_to_video',
          provider: 'gemini_omni',
          modelName: 'gemini-omni-1.1-flash',
          prompt: 'Detailed render prompt for scene 1',
          parameters: {
            aspectRatio: '16:9',
            resolution: '1080p',
            durationSeconds: 10,
            motionStrength: 5,
          },
          status: 'succeeded',
          progressPercent: 100,
          queuedAt: new Date().toISOString(),
          resultAssetId: `asset_${id}_1`,
          isSimulated: false,
        },
      ],
      timeline: {
        id: `time_${id}`,
        projectId: id,
        totalDurationSeconds: 60,
        fps: 30,
        aspectRatio: '16:9',
        clips: [
          {
            id: `clip_${id}_1`,
            sceneId: `sc_legacy_${id}_1`,
            assetId: `asset_${id}_1`,
            track: 'video',
            startTimeSeconds: 0,
            durationSeconds: 10,
            sourceInSeconds: 0,
            volume: 1,
            title: 'Scene 1 Cut',
          },
        ],
        lastModified: new Date().toISOString(),
      },
      exportJobs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: true,
    };
  };

  // ---------------------------------------------------------------------------
  // Test 1: Migration of a legacy project containing multiple scenes
  // ---------------------------------------------------------------------------
  await test('1. Migrates legacy project with multiple scenes into first-class Shots', () => {
    const legacy = createLegacyProject('proj_alpha', 3);
    assert.strictEqual(legacy.shots, undefined);
    assert.strictEqual(legacy.schemaVersion, undefined);

    const migrated = migrateProjectToShots(legacy);

    assert.strictEqual(migrated.schemaVersion, 2, 'Must set schemaVersion to 2');
    assert.ok(Array.isArray(migrated.shots), 'Shots must be an array');
    assert.strictEqual(migrated.shots.length, 3, 'Must create exactly 1 shot per existing scene');

    // Verify first shot properties
    const shot1 = migrated.shots[0];
    assert.strictEqual(shot1.projectId, 'proj_alpha');
    assert.strictEqual(shot1.sceneId, 'sc_legacy_proj_alpha_1');
    assert.strictEqual(shot1.shotNumber, 1);
    assert.strictEqual(shot1.durationSeconds, 10);
    assert.strictEqual(shot1.framing, 'extreme_wide');
    assert.strictEqual(shot1.visualIntent, legacy.scenes[0].visualDescription);
    assert.strictEqual(shot1.dialogueSnippet, legacy.scenes[0].narrationDialogue);
    assert.strictEqual(shot1.status, 'approved');
  });

  // ---------------------------------------------------------------------------
  // Test 2: Preservation of scene IDs and original narrative data
  // ---------------------------------------------------------------------------
  await test('2. Preserves scene IDs, narrative data, and adds ordered shotIds and duration', () => {
    const legacy = createLegacyProject('proj_beta', 4);
    const originalScenes = JSON.parse(JSON.stringify(legacy.scenes));

    const migrated = migrateProjectToShots(legacy);

    assert.strictEqual(migrated.scenes.length, 4);
    migrated.scenes.forEach((scene, idx) => {
      const orig = originalScenes[idx];
      assert.strictEqual(scene.id, orig.id, 'Scene ID must remain unchanged');
      assert.strictEqual(scene.sceneNumber, orig.sceneNumber);
      assert.strictEqual(scene.narrativePurpose, orig.narrativePurpose);
      assert.strictEqual(scene.visualDescription, orig.visualDescription);
      assert.strictEqual(scene.narrationDialogue, orig.narrationDialogue);
      assert.strictEqual(scene.audioCues, orig.audioCues);
      assert.strictEqual(scene.status, orig.status);

      // Verify shot association on scene
      assert.ok(Array.isArray(scene.shotIds), 'Scene must have shotIds array');
      assert.strictEqual(scene.shotIds.length, 1);
      assert.strictEqual(scene.shotIds[0], `shot_${orig.id}_default`);
      assert.strictEqual(scene.totalDurationSeconds, orig.estimatedDurationSeconds);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Deterministic IDs and idempotent repeated migration
  // ---------------------------------------------------------------------------
  await test('3. Generates deterministic IDs and runs idempotently without duplicating shots', () => {
    const legacy = createLegacyProject('proj_gamma', 3);
    const pass1 = migrateProjectToShots(legacy);
    const pass2 = migrateProjectToShots(pass1);
    const pass3 = migrateProjectToShots(pass2);

    assert.strictEqual(pass1.shots?.length, 3);
    assert.strictEqual(pass2.shots?.length, 3, 'Second pass must not add duplicate shots');
    assert.strictEqual(pass3.shots?.length, 3, 'Third pass must not add duplicate shots');

    // Deterministic IDs check
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(pass1.shots![i].id, pass2.shots![i].id);
      assert.strictEqual(pass2.shots![i].id, pass3.shots![i].id);
      assert.strictEqual(pass1.scenes[i].shotIds![0], pass3.scenes[i].shotIds![0]);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4: Projects with no scenes, missing durations, or missing optional fields
  // ---------------------------------------------------------------------------
  await test('4. Handles projects with no scenes, missing durations, or invalid optional fields safely', () => {
    const emptyProj: Project = {
      ...createLegacyProject('proj_empty', 0),
      scenes: [],
    };

    const migratedEmpty = migrateProjectToShots(emptyProj);
    assert.strictEqual(migratedEmpty.schemaVersion, 2);
    assert.strictEqual(migratedEmpty.scenes.length, 0);
    assert.deepStrictEqual(migratedEmpty.shots, []);

    // Malformed scene fields
    const malformedProj: Project = {
      ...createLegacyProject('proj_malformed', 0),
      scenes: [
        {
          id: 'sc_malformed_1',
          sceneNumber: 1,
          narrativePurpose: '',
          estimatedDurationSeconds: 0, // invalid zero duration
          visualDescription: '',
          narrationDialogue: '',
          audioCues: '',
          cameraFraming: 'Medium shot',
          status: 'draft',
        },
        {
          id: 'sc_malformed_2',
          sceneNumber: 2,
          narrativePurpose: 'Missing duration scene',
          estimatedDurationSeconds: (undefined as any), // undefined duration
          visualDescription: 'Some description',
          narrationDialogue: 'Some text',
          audioCues: 'Ambience',
          cameraFraming: 'Wide establishing',
          status: 'draft',
        },
      ],
    };

    const migratedMalformed = migrateProjectToShots(malformedProj);
    assert.strictEqual(migratedMalformed.shots?.length, 2);
    assert.strictEqual(migratedMalformed.shots![0].durationSeconds, 5, 'Zero duration defaults to safe minimum 5s');
    assert.strictEqual(migratedMalformed.shots![1].durationSeconds, 5, 'Undefined duration defaults to safe 5s');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Preservation of existing prompts, assets, jobs, and timeline clips
  // ---------------------------------------------------------------------------
  await test('5. Preserves existing prompts, jobs, timeline clips and links unambiguous assets', () => {
    const legacy = createLegacyProject('proj_media', 2);
    const migrated = migrateProjectToShots(legacy);

    // Prompts preserved
    assert.ok(migrated.prompts['sc_legacy_proj_media_1']);
    assert.strictEqual(migrated.prompts['sc_legacy_proj_media_1'][0].visualPrompt, 'Detailed render prompt for scene 1');
    assert.strictEqual(migrated.activePromptVersion['sc_legacy_proj_media_1'], 'p_proj_media_1');

    // Jobs preserved
    assert.strictEqual(migrated.generationJobs.length, 1);
    assert.strictEqual(migrated.generationJobs[0].id, 'job_proj_media_1');
    assert.strictEqual(migrated.generationJobs[0].sceneId, 'sc_legacy_proj_media_1');

    // Assets linked unambiguously
    assert.strictEqual(migrated.assets.length, 1);
    const asset = migrated.assets[0];
    assert.strictEqual(asset.sceneId, 'sc_legacy_proj_media_1');
    assert.strictEqual(asset.shotId, 'shot_sc_legacy_proj_media_1_default', 'Asset linked to unambiguous default shot');

    // Shot links to active asset
    const shot1 = migrated.shots?.find((s) => s.sceneId === 'sc_legacy_proj_media_1');
    assert.strictEqual(shot1?.activeAssetId, 'asset_proj_media_1');

    // Timeline clip annotated with shotId
    assert.strictEqual(migrated.timeline.clips.length, 1);
    assert.strictEqual(migrated.timeline.clips[0].sceneId, 'sc_legacy_proj_media_1');
    assert.strictEqual(migrated.timeline.clips[0].shotId, 'shot_sc_legacy_proj_media_1_default');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Correct shot ordering and duration aggregation
  // ---------------------------------------------------------------------------
  await test('6. Correct shot ordering, reordering, and duration aggregation', () => {
    const project = migrateProjectToShots(createLegacyProject('proj_duration', 1));
    const sceneId = project.scenes[0].id;

    // Initially 1 shot with 10s
    let shots = getShotsForScene(project, sceneId);
    assert.strictEqual(shots.length, 1);
    assert.strictEqual(calculateSceneDuration(project.scenes[0], shots), 10);

    // Add 2 more shots to the scene
    const shot2: Shot = {
      id: `shot_${sceneId}_2`,
      projectId: project.id,
      sceneId,
      shotNumber: 2,
      name: 'Close-up take',
      durationSeconds: 4,
      visualIntent: 'Close up on terminal screen',
      framing: 'close_up',
      cameraAngle: 'eye_level',
      cameraMovement: 'static',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const shot3: Shot = {
      id: `shot_${sceneId}_3`,
      projectId: project.id,
      sceneId,
      shotNumber: 3,
      name: 'Dynamic pull-back',
      durationSeconds: 6,
      visualIntent: 'Dolly out into the night',
      framing: 'wide',
      cameraAngle: 'high_angle',
      cameraMovement: 'dolly_out',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    project.shots = [...(project.shots || []), shot2, shot3];
    project.scenes[0].shotIds = [shots[0].id, shot2.id, shot3.id];

    // Duration rollup: 10 + 4 + 6 = 20s
    shots = getShotsForScene(project, sceneId);
    assert.strictEqual(shots.length, 3);
    const totalDuration = calculateSceneDuration(project.scenes[0], shots);
    assert.strictEqual(totalDuration, 20, 'Scene duration must equal sum of constituent shot durations');

    // Test ordering reflects scene.shotIds
    project.scenes[0].shotIds = [shot3.id, shots[0].id, shot2.id];
    const reorderedShots = getShotsForScene(project, sceneId);
    assert.strictEqual(reorderedShots[0].id, shot3.id);
    assert.strictEqual(reorderedShots[1].id, shots[0].id);
    assert.strictEqual(reorderedShots[2].id, shot2.id);
  });

  // ---------------------------------------------------------------------------
  // Test 7: No cross-project Shot association
  // ---------------------------------------------------------------------------
  await test('7. Enforces strict project isolation: no cross-project shot leaks', () => {
    const projA = migrateProjectToShots(createLegacyProject('proj_isolation_A', 2));
    const projB = migrateProjectToShots(createLegacyProject('proj_isolation_B', 2));

    const shotsA = projA.shots || [];
    const shotsB = projB.shots || [];

    // Verify all shots in A belong exclusively to A
    shotsA.forEach((s) => {
      assert.strictEqual(s.projectId, 'proj_isolation_A');
      assert.ok(s.sceneId.includes('proj_isolation_A'));
    });

    // Verify all shots in B belong exclusively to B
    shotsB.forEach((s) => {
      assert.strictEqual(s.projectId, 'proj_isolation_B');
      assert.ok(s.sceneId.includes('proj_isolation_B'));
    });

    // Querying shots for project A scene from project B returns empty
    const sceneAId = projA.scenes[0].id;
    const leakedShots = getShotsForScene(projB, sceneAId);
    assert.strictEqual(leakedShots.length, 0, 'Project B must never leak or resolve Project A shots');
  });

  // ---------------------------------------------------------------------------
  // Test 8: StorageService CRUD and cascading deletions
  // ---------------------------------------------------------------------------
  await test('8. StorageService shot CRUD, auto-shot creation, and cascading scene deletion', () => {
    const newProj = storage.createProject({
      title: 'CRUD Integration Test',
      userId: 'user_demo_crud_tester',
      rawIdea: 'Testing shot lifecycle methods',
    });

    assert.strictEqual(newProj.schemaVersion, 2);
    assert.deepStrictEqual(newProj.shots, []);

    // Add Scene: must automatically provision initial shot
    const scene1 = storage.addScene(newProj.id, {
      narrativePurpose: 'Hero Introduction Scene',
      estimatedDurationSeconds: 7,
      visualDescription: 'Sunrise over mountain',
      narrationDialogue: 'In the beginning...',
      audioCues: 'Wind ambience',
      cameraFraming: 'Wide establishing',
      status: 'draft',
    });

    assert.ok(scene1, 'Scene must be created');
    const projectWithScene = storage.getProject(newProj.id);
    assert.strictEqual(projectWithScene?.scenes.length, 1);
    assert.strictEqual(projectWithScene?.shots?.length, 1, 'addScene must create initial default shot');
    assert.strictEqual(projectWithScene?.shots![0].durationSeconds, 7);

    // Add Shot to scene
    const shot2 = storage.addShot(newProj.id, scene1.id, {
      name: 'Secondary take',
      durationSeconds: 5,
      framing: 'close_up',
      visualIntent: 'Hero eyes opening',
    });
    assert.ok(shot2);
    assert.strictEqual(shot2.shotNumber, 2);

    const projectWith2Shots = storage.getProject(newProj.id);
    assert.strictEqual(projectWith2Shots?.shots?.length, 2);
    const updatedScene1 = projectWith2Shots?.scenes.find((s) => s.id === scene1.id);
    assert.strictEqual(updatedScene1?.totalDurationSeconds, 12, 'Scene duration must auto-aggregate: 7 + 5 = 12s');

    // Update Shot
    storage.updateShot(newProj.id, shot2.id, { durationSeconds: 8 });
    const projectAfterShotUpdate = storage.getProject(newProj.id);
    const updatedShot2 = projectAfterShotUpdate?.shots?.find((s) => s.id === shot2.id);
    assert.strictEqual(updatedShot2?.durationSeconds, 8);
    const sceneAfterUpdate = projectAfterShotUpdate?.scenes.find((s) => s.id === scene1.id);
    assert.strictEqual(sceneAfterUpdate?.totalDurationSeconds, 15, 'Scene duration reflects updated shot duration: 7 + 8 = 15s');

    // Delete Scene: must cascade-delete all constituent shots
    storage.deleteScene(newProj.id, scene1.id);
    const projectAfterSceneDelete = storage.getProject(newProj.id);
    assert.strictEqual(projectAfterSceneDelete?.scenes.length, 0);
    assert.strictEqual(projectAfterSceneDelete?.shots?.length, 0, 'Deleting scene must cascade-delete child shots');

    // Clean up
    storage.deleteProject(newProj.id);
  });

  console.log('========================================================================');
  console.log(`   Shot Domain Test Results: ${passed} PASSED | ${failed} FAILED           `);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runShotDomainTests().catch((err) => {
  console.error('Fatal shot domain test error:', err);
  process.exit(1);
});
