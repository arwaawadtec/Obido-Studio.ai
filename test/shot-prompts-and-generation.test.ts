/**
 * Obido Studio — Milestone 4: Shot-Level Prompts & Generation UI Test Suite
 *
 * Verifies:
 * 1. Prompt history isolation between 2 shots in the same scene.
 * 2. Legacy scene prompt migration idempotency & zero data loss.
 * 3. Shot switching state isolation (independent version pointers).
 * 4. Generation job creation with shot association and deduplication.
 * 5. Asset generation and shot attachment lifecycle.
 * 6. Legacy timeline clip preservation & backward compatibility.
 */

import assert from 'assert';
import { Project, Scene, Shot, PromptVersion, GenerationJob, Asset, TimelineClip } from '../src/types';
import {
  migrateProjectToShots,
  getPromptsForShot,
  getActivePromptForShot,
} from '../src/services/shotMigration';
import { storage } from '../src/services/storage';

async function runShotPromptsAndGenerationTests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Shot-Level Prompts & Generation Test Suite            ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
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

  // Helper fixture to create a valid project
  const createTestProject = (id: string): Project => ({
    id,
    userId: 'user_shot_test',
    title: `Shot Test Video ${id}`,
    currentStage: 'prompts',
    completedStages: ['brief', 'script', 'storyboard'],
    brief: {
      title: `Shot Test Video ${id}`,
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
    scripts: [],
    scenes: [
      {
        id: `sc_test_1`,
        sceneNumber: 1,
        narrativePurpose: 'Establish the server room crisis at 3 AM',
        estimatedDurationSeconds: 10,
        visualDescription: 'Server rack blinking with amber failure lights',
        narrationDialogue: 'At 3:14 AM, a critical schema drift occurs.',
        audioCues: 'Low hum and relay clicks',
        cameraFraming: 'Close-up',
        status: 'ready_for_prompt',
      },
    ],
    prompts: {},
    activePromptVersion: {},
    assets: [],
    generationJobs: [],
    timeline: {
      id: `tl_${id}`,
      projectId: id,
      totalDurationSeconds: 60,
      fps: 30,
      aspectRatio: '16:9',
      clips: [],
      lastModified: new Date().toISOString(),
    },
    exportJobs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocalOnly: true,
  });

  // --- Test 1: Prompt History Isolation Between 2 Shots in Same Scene ---
  await test('1. Prompt history isolation between 2 shots in the same scene', async () => {
    const proj = createTestProject('proj_iso_1');
    const migrated = migrateProjectToShots(proj);

    // Add a second shot to scene sc_test_1
    const shot1 = migrated.shots![0];
    const shot2: Shot = {
      id: 'shot_sc_test_1_take_2',
      projectId: proj.id,
      sceneId: 'sc_test_1',
      shotNumber: 2,
      name: 'Server Room — Extreme Wide Reverse Angle',
      durationSeconds: 6,
      visualIntent: 'Wide reverse view from the ceiling showing the entire empty facility',
      framing: 'extreme_wide',
      cameraAngle: 'high_angle',
      cameraMovement: 'crane',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    migrated.shots!.push(shot2);

    // Save prompt for Shot 1
    const prompt1 = {
      visualPrompt: 'Close up on amber LED turning red with high contrast anamorphic flares',
      motionInstructions: 'Slow push in 50mm',
      cameraDirection: 'close_up',
      negativePrompt: 'blurry, cartoon',
      audioInstructions: 'Electrical hum',
      targetProvider: 'gemini_omni',
    };
    const v1 = storage.saveShotPrompt.call(
      {
        getProject: () => migrated,
        updateProject: (_id: string, updates: any) => Object.assign(migrated, updates),
      } as any,
      migrated.id,
      shot1.id,
      prompt1
    );

    // Save completely different prompt for Shot 2
    const prompt2 = {
      visualPrompt: 'Wide panoramic establishing angle with cool blue moonlight through skylight',
      motionInstructions: 'Slow crane down',
      cameraDirection: 'extreme_wide',
      negativePrompt: 'grainy, low quality',
      audioInstructions: 'Air conditioning drone',
      targetProvider: 'gemini_omni',
    };
    const v2 = storage.saveShotPrompt.call(
      {
        getProject: () => migrated,
        updateProject: (_id: string, updates: any) => Object.assign(migrated, updates),
      } as any,
      migrated.id,
      shot2.id,
      prompt2
    );

    assert.ok(v1, 'Version 1 should be created for shot 1');
    assert.ok(v2, 'Version 2 should be created for shot 2');

    // Retrieve prompts for both shots
    const shot1Prompts = getPromptsForShot(migrated, shot1.id, shot1.sceneId);
    const shot2Prompts = getPromptsForShot(migrated, shot2.id, shot2.sceneId);

    // ASSERT ISOLATION: Shot 1 must have only prompt 1, Shot 2 must have only prompt 2
    assert.strictEqual(shot1Prompts.length, 1);
    assert.strictEqual(shot1Prompts[0].visualPrompt, prompt1.visualPrompt);
    assert.strictEqual(shot1Prompts[0].shotId, shot1.id);

    assert.strictEqual(shot2Prompts.length, 1);
    assert.strictEqual(shot2Prompts[0].visualPrompt, prompt2.visualPrompt);
    assert.strictEqual(shot2Prompts[0].shotId, shot2.id);

    // Must NOT bleed across shots
    assert.notStrictEqual(shot1Prompts[0].visualPrompt, shot2Prompts[0].visualPrompt);
  });

  // --- Test 2: Legacy Scene Prompt Migration Idempotency & Zero Loss ---
  await test('2. Legacy scene prompt migration idempotency and zero data loss', async () => {
    const legacyProject = createTestProject('proj_legacy_prompts');
    // Legacy structure: prompt stored directly under sceneId
    legacyProject.prompts = {
      sc_test_1: [
        {
          id: 'p_legacy_101',
          sceneId: 'sc_test_1',
          versionNumber: 1,
          createdAt: new Date().toISOString(),
          visualPrompt: 'Legacy scene prompt text before shots introduced',
          motionInstructions: 'Smooth camera drift',
          cameraDirection: 'Medium shot',
          negativePrompt: 'blurry',
          audioInstructions: 'Subtle tone',
          targetProvider: 'gemini_omni',
          targetModel: 'gemini-omni-1.1-flash',
        },
      ],
    };
    legacyProject.activePromptVersion = {
      sc_test_1: 'p_legacy_101',
    };
    // No shots array yet
    delete legacyProject.shots;

    // Run migration 1
    const migrated1 = migrateProjectToShots(legacyProject);
    assert.strictEqual(migrated1.shots?.length, 1);
    const primaryShotId = migrated1.shots![0].id;

    // Verify shot 1 received the legacy prompt
    const shotPrompts1 = getPromptsForShot(migrated1, primaryShotId, 'sc_test_1');
    assert.strictEqual(shotPrompts1.length, 1);
    assert.strictEqual(shotPrompts1[0].visualPrompt, 'Legacy scene prompt text before shots introduced');
    assert.strictEqual(shotPrompts1[0].shotId, primaryShotId);

    // Legacy scene lookup still works
    assert.ok(migrated1.prompts['sc_test_1'], 'Legacy scene prompt key preserved');
    assert.strictEqual(migrated1.prompts['sc_test_1'][0].id, 'p_legacy_101');

    // Run migration 2 (idempotency check)
    const migrated2 = migrateProjectToShots(migrated1);
    assert.strictEqual(migrated2.shots?.length, 1);
    assert.strictEqual(migrated2.shots![0].id, primaryShotId);
    assert.strictEqual(getPromptsForShot(migrated2, primaryShotId, 'sc_test_1').length, 1);
  });

  // --- Test 3: Shot Switching State Isolation (Independent Version Pointers) ---
  await test('3. Shot switching state isolation (independent version pointers)', async () => {
    const proj = createTestProject('proj_version_pointers');
    const migrated = migrateProjectToShots(proj);
    const shot1 = migrated.shots![0];
    const shot2: Shot = {
      id: 'shot_test_pointer_2',
      projectId: proj.id,
      sceneId: 'sc_test_1',
      shotNumber: 2,
      name: 'Shot 2',
      durationSeconds: 5,
      visualIntent: 'Intent 2',
      framing: 'medium',
      cameraAngle: 'eye_level',
      cameraMovement: 'static',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    migrated.shots!.push(shot2);

    const mockCtx = {
      getProject: () => migrated,
      updateProject: (_id: string, updates: any) => Object.assign(migrated, updates),
    } as any;

    // Create 2 versions for Shot 1
    storage.saveShotPrompt.call(mockCtx, proj.id, shot1.id, { visualPrompt: 'Shot 1 Version 1' });
    const s1v2 = storage.saveShotPrompt.call(mockCtx, proj.id, shot1.id, { visualPrompt: 'Shot 1 Version 2' });

    // Create 1 version for Shot 2
    const s2v1 = storage.saveShotPrompt.call(mockCtx, proj.id, shot2.id, { visualPrompt: 'Shot 2 Version 1' });

    // Shot 1 active should be s1v2
    assert.strictEqual(getActivePromptForShot(migrated, shot1.id)?.id, s1v2?.id);
    // Shot 2 active should be s2v1
    assert.strictEqual(getActivePromptForShot(migrated, shot2.id)?.id, s2v1?.id);

    // Switch Shot 1 active version to s1v1
    const s1v1 = getPromptsForShot(migrated, shot1.id).find((v) => v.visualPrompt === 'Shot 1 Version 1')!;
    storage.setActiveShotPromptVersion.call(mockCtx, proj.id, shot1.id, s1v1.id);

    // Shot 1 active is now s1v1, Shot 2 active is STILL s2v1
    assert.strictEqual(getActivePromptForShot(migrated, shot1.id)?.id, s1v1.id);
    assert.strictEqual(getActivePromptForShot(migrated, shot2.id)?.id, s2v1?.id);
  });

  // --- Test 4: Generation Job Creation with Shot Association & Deduplication ---
  await test('4. Generation job creation with shot association and deduplication', async () => {
    const proj = createTestProject('proj_gen_dedup');
    const migrated = migrateProjectToShots(proj);
    const shot1 = migrated.shots![0];

    const mockCtx = {
      getProject: () => migrated,
      updateProject: (_id: string, updates: any) => Object.assign(migrated, updates),
    } as any;

    // Dispatch job 1 for Shot 1
    const job1 = storage.addGenerationJob.call(
      mockCtx,
      proj.id,
      {
        projectId: proj.id,
        sceneId: shot1.sceneId,
        shotId: shot1.id,
        taskType: 'text_to_video',
        provider: 'gemini_omni',
        modelName: 'gemini-omni-1.1-flash',
        prompt: 'Server room camera push in',
        parameters: {
          aspectRatio: '16:9',
          resolution: '1080p',
          durationSeconds: 10,
          motionStrength: 6,
        },
        status: 'queued',
        progressPercent: 0,
        isSimulated: false,
      },
      true // deduplicate
    );

    assert.ok(job1.id);
    assert.strictEqual(job1.shotId, shot1.id);
    assert.strictEqual(job1.sceneId, shot1.sceneId);
    assert.strictEqual(migrated.generationJobs.length, 1);

    // Attempt to queue second identical job for the same shot while job 1 is still queued
    const job2 = storage.addGenerationJob.call(
      mockCtx,
      proj.id,
      {
        projectId: proj.id,
        sceneId: shot1.sceneId,
        shotId: shot1.id,
        taskType: 'text_to_video',
        provider: 'gemini_omni',
        modelName: 'gemini-omni-1.1-flash',
        prompt: 'Server room camera push in',
        parameters: {
          aspectRatio: '16:9',
          resolution: '1080p',
          durationSeconds: 10,
          motionStrength: 6,
        },
        status: 'queued',
        progressPercent: 0,
        isSimulated: false,
      },
      true // deduplicate
    );

    // Deduplication should return the existing job without creating a second entry
    assert.strictEqual(job2.id, job1.id, 'Deduplication must return existing active job');
    assert.strictEqual(migrated.generationJobs.length, 1, 'No duplicate job created');
  });

  // --- Test 5: Asset Generation and Shot Attachment Lifecycle ---
  await test('5. Asset generation and shot attachment lifecycle', async () => {
    const proj = createTestProject('proj_asset_link');
    const migrated = migrateProjectToShots(proj);
    const shot1 = migrated.shots![0];

    const mockCtx = {
      getProject: () => migrated,
      updateProject: (_id: string, updates: any) => Object.assign(migrated, updates),
    } as any;

    // Create asset for Shot 1
    const asset = storage.addAsset.call(mockCtx, proj.id, {
      projectId: proj.id,
      sceneId: shot1.sceneId,
      shotId: shot1.id,
      name: `${shot1.name} — Generated Take 1`,
      type: 'video',
      url: 'https://storage.googleapis.com/test-bucket/asset_test_1.mp4',
      filesizeBytes: 15000000,
      durationSeconds: shot1.durationSeconds,
      format: 'mp4',
      provider: 'gemini_omni',
      isSimulatedDemo: false,
    });

    assert.ok(asset.id);
    assert.strictEqual(asset.shotId, shot1.id);
    assert.strictEqual(asset.sceneId, shot1.sceneId);

    // Attach asset to shot
    storage.updateShot.call(mockCtx, proj.id, shot1.id, {
      activeAssetId: asset.id,
      status: 'ready',
    });

    const updatedShot = migrated.shots!.find((s) => s.id === shot1.id);
    assert.strictEqual(updatedShot?.activeAssetId, asset.id);
    assert.strictEqual(updatedShot?.status, 'ready');
  });

  // --- Test 6: Legacy Timeline Clip Preservation & Backward Compatibility ---
  await test('6. Legacy timeline clip preservation and backward compatibility', async () => {
    const proj = createTestProject('proj_legacy_clips');
    // Pre-populate timeline with legacy clip containing only sceneId
    const legacyClip: TimelineClip = {
      id: 'clip_legacy_scene_1',
      sceneId: 'sc_test_1',
      track: 'video',
      startTimeSeconds: 0,
      durationSeconds: 10,
      sourceInSeconds: 0,
      volume: 1,
      title: 'Legacy Scene 1 Clip',
      transitionIn: 'cut',
    };
    proj.timeline.clips = [legacyClip];

    const migrated = migrateProjectToShots(proj);
    assert.strictEqual(migrated.timeline.clips.length, 1);
    const resultClip = migrated.timeline.clips[0];

    // Preserved all original timing & tracks
    assert.strictEqual(resultClip.id, 'clip_legacy_scene_1');
    assert.strictEqual(resultClip.sceneId, 'sc_test_1');
    assert.strictEqual(resultClip.startTimeSeconds, 0);
    assert.strictEqual(resultClip.durationSeconds, 10);
    assert.strictEqual(resultClip.track, 'video');

    // Unambiguously annotated with shotId since scene 1 has exactly 1 shot
    assert.strictEqual(resultClip.shotId, migrated.shots![0].id);
  });

  console.log('\n========================================================================');
  console.log(`   Verification Results: ${passed} PASSED | ${failed} FAILED           `);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runShotPromptsAndGenerationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
