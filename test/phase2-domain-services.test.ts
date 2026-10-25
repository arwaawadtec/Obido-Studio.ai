/**
 * Obido Studio — Phase 2 Domain Services Test Suite
 *
 * Verifies domain service business logic invariants, tenant authorization,
 * containment validation, cascade deletions, reordering, prompt isolation,
 * job deduplication, and timeline generation.
 */

import assert from 'assert';
import { Project, Scene, Shot, PromptVersion, GenerationJob, Asset, TimelineClip } from '../src/types';
import { domainService, DomainValidationError } from '../src/services/domainService';

async function runDomainServiceTests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Phase 2 Domain Services Test Suite                    ');
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

  const createBaseProject = (id: string, userId: string = 'user_alice'): Project => ({
    id,
    userId,
    title: 'Quantum Analytics Promo',
    currentStage: 'storyboard',
    completedStages: ['brief', 'script'],
    brief: {
      title: 'Quantum Analytics Promo',
      purpose: 'explainer',
      targetAudience: 'CTOs',
      language: 'English',
      aspectRatio: '16:9',
      targetDurationSeconds: 30,
      visualStyle: 'cinematic_photorealistic',
      rawIdea: 'Fast analytics',
      keyTakeaway: '10x faster insights',
      toneOfVoice: 'Authoritative',
      callToAction: 'Get started',
      lastUpdated: new Date().toISOString(),
    },
    scripts: [],
    scenes: [
      {
        id: 'sc_1',
        sceneNumber: 1,
        narrativePurpose: 'Server room alert at midnight',
        visualDescription: 'Server room at midnight',
        narrationDialogue: 'Every second counts in big data.',
        audioCues: 'Low server room hum',
        cameraFraming: 'Wide establishing',
        status: 'ready_for_prompt',
        shotIds: ['shot_1a', 'shot_1b'],
        totalDurationSeconds: 15,
        estimatedDurationSeconds: 15,
      },
      {
        id: 'sc_2',
        sceneNumber: 2,
        narrativePurpose: 'Holographic data visualization expansion',
        visualDescription: 'Data visualizations expanding into 3D',
        narrationDialogue: 'Obido turns pipelines into real-time insight.',
        audioCues: 'Digital chime and shimmer',
        cameraFraming: 'Close-up',
        status: 'ready_for_prompt',
        shotIds: ['shot_2a'],
        totalDurationSeconds: 10,
        estimatedDurationSeconds: 10,
      },
    ],
    shots: [
      {
        id: 'shot_1a',
        projectId: id,
        sceneId: 'sc_1',
        shotNumber: 1,
        name: 'Server Room Establishing',
        durationSeconds: 8,
        visualIntent: 'Wide glowing server racks',
        framing: 'wide',
        cameraAngle: 'eye_level',
        cameraMovement: 'static',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'shot_1b',
        projectId: id,
        sceneId: 'sc_1',
        shotNumber: 2,
        name: 'Rack LED Indicator Macro',
        durationSeconds: 7,
        visualIntent: 'Macro lights flickering rapidly',
        framing: 'close_up',
        cameraAngle: 'low_angle',
        cameraMovement: 'dolly_in',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'shot_2a',
        projectId: id,
        sceneId: 'sc_2',
        shotNumber: 1,
        name: 'Holographic Graph Assembly',
        durationSeconds: 10,
        visualIntent: '3D glowing graph floating in space',
        framing: 'medium',
        cameraAngle: 'high_angle',
        cameraMovement: 'orbital',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    prompts: {},
    activePromptVersion: {},
    generationJobs: [],
    assets: [
      {
        id: 'asset_1',
        projectId: id,
        sceneId: 'sc_1',
        shotId: 'shot_1a',
        type: 'video',
        url: 'https://example.com/video1.mp4',
        name: 'Server Rack Take 1',
        aspectRatio: '16:9',
        durationSeconds: 8,
        filesizeBytes: 1048576,
        format: 'mp4',
        provider: 'gemini_omni',
        isSimulatedDemo: true,
        createdAt: new Date().toISOString(),
      },
    ],
    timeline: {
      id: 'time_1',
      projectId: id,
      totalDurationSeconds: 25,
      fps: 30,
      aspectRatio: '16:9',
      clips: [
        {
          id: 'clip_1',
          sceneId: 'sc_1',
          shotId: 'shot_1a',
          assetId: 'asset_1',
          track: 'video',
          startTimeSeconds: 0,
          durationSeconds: 8,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Shot 1A Clip',
        },
        {
          id: 'clip_2',
          sceneId: 'sc_2',
          shotId: 'shot_2a',
          track: 'video',
          startTimeSeconds: 8,
          durationSeconds: 10,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Shot 2A Clip',
        },
      ],
      lastModified: new Date().toISOString(),
    },
    exportJobs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocalOnly: true,
  });

  // --- Test 1: Project Ownership & Access Control ---
  await test('Project access validation rejects unauthorized user and asserts ownership', () => {
    const project = createBaseProject('proj_auth_1', 'user_alice');

    assert.strictEqual(domainService.validateProjectAccess(project, 'user_alice'), true);
    assert.strictEqual(domainService.validateProjectAccess(project, 'user_bob'), false);

    assert.doesNotThrow(() => {
      domainService.assertProjectOwnership(project, 'user_alice');
    });

    assert.throws(
      () => {
        domainService.assertProjectOwnership(project, 'user_mallory');
      },
      (err: any) => err instanceof DomainValidationError && err.code === 'UNAUTHORIZED_PROJECT_ACCESS'
    );
  });

  // --- Test 2: Entity Containment Checks ---
  await test('Entity containment enforces that scenes, shots, assets, and clips belong to the project', () => {
    const project = createBaseProject('proj_cont_1', 'user_alice');

    // Valid containment
    assert.doesNotThrow(() => domainService.assertEntityContainment(project, 'scene', 'sc_1'));
    assert.doesNotThrow(() => domainService.assertEntityContainment(project, 'shot', 'shot_1b'));
    assert.doesNotThrow(() => domainService.assertEntityContainment(project, 'asset', 'asset_1'));
    assert.doesNotThrow(() => domainService.assertEntityContainment(project, 'clip', 'clip_1'));

    // Foreign or non-existent entity throws SCENE_NOT_FOUND
    assert.throws(
      () => domainService.assertEntityContainment(project, 'scene', 'foreign_scene_99'),
      (err: any) => err instanceof DomainValidationError && err.code === 'SCENE_NOT_FOUND'
    );

    // Foreign shot throws SHOT_NOT_FOUND
    assert.throws(
      () => domainService.assertEntityContainment(project, 'shot', 'foreign_shot_99'),
      (err: any) => err instanceof DomainValidationError && err.code === 'SHOT_NOT_FOUND'
    );
  });

  // --- Test 3: Scene Reordering ---
  await test('reorderScenes accurately updates sequence and scene numbers', () => {
    const project = createBaseProject('proj_reorder_1', 'user_alice');
    assert.strictEqual(project.scenes[0].id, 'sc_1');
    assert.strictEqual(project.scenes[1].id, 'sc_2');

    const updated = domainService.reorderScenes(project, 0, 1);
    assert.strictEqual(updated.scenes[0].id, 'sc_2');
    assert.strictEqual(updated.scenes[0].sceneNumber, 1);
    assert.strictEqual(updated.scenes[1].id, 'sc_1');
    assert.strictEqual(updated.scenes[1].sceneNumber, 2);
  });

  // --- Test 4: Cascade Delete Scene ---
  await test('cascadeDeleteScene cleanly deletes scene, dependent shots, prompts, and timeline clips', () => {
    const project = createBaseProject('proj_cascade_sc', 'user_alice');
    // Add prompts for sc_1 and shot_1a
    project.prompts = {
      sc_1: [{ id: 'pv_sc1', sceneId: 'sc_1', versionNumber: 1 } as any],
      shot_1a: [{ id: 'pv_1a', shotId: 'shot_1a', sceneId: 'sc_1', versionNumber: 1 } as any],
      shot_2a: [{ id: 'pv_2a', shotId: 'shot_2a', sceneId: 'sc_2', versionNumber: 1 } as any],
    };
    project.activePromptVersion = {
      sc_1: 'pv_sc1',
      shot_1a: 'pv_1a',
      shot_2a: 'pv_2a',
    };

    const updated = domainService.cascadeDeleteScene(project, 'sc_1');

    // sc_1 should be gone, sc_2 renumbered to 1
    assert.strictEqual(updated.scenes.length, 1);
    assert.strictEqual(updated.scenes[0].id, 'sc_2');
    assert.strictEqual(updated.scenes[0].sceneNumber, 1);

    // Dependent shots shot_1a and shot_1b must be deleted
    assert.strictEqual(updated.shots?.length, 1);
    assert.strictEqual(updated.shots?.[0].id, 'shot_2a');

    // Prompts and active pointers for sc_1 and shot_1a purged
    assert.strictEqual(updated.prompts?.['sc_1'], undefined);
    assert.strictEqual(updated.prompts?.['shot_1a'], undefined);
    assert.strictEqual(updated.activePromptVersion?.['sc_1'], undefined);
    assert.strictEqual(updated.activePromptVersion?.['shot_1a'], undefined);
    // shot_2a prompts must be intact
    assert.strictEqual(updated.prompts?.['shot_2a']?.length, 1);

    // Timeline clip referencing sc_1 must be removed
    const clips = updated.timeline?.clips || [];
    assert.strictEqual(clips.length, 1);
    assert.strictEqual(clips[0].sceneId, 'sc_2');
  });

  // --- Test 5: Reorder Shots within Scene ---
  await test('reorderShotsInScene updates shotIds array and reindexes shotNumber', () => {
    const project = createBaseProject('proj_reorder_shots', 'user_alice');
    const initialScene = project.scenes.find((s) => s.id === 'sc_1')!;
    assert.deepStrictEqual(initialScene.shotIds, ['shot_1a', 'shot_1b']);

    const updated = domainService.reorderShotsInScene(project, 'sc_1', 0, 1);
    const updatedScene = updated.scenes.find((s) => s.id === 'sc_1')!;
    assert.deepStrictEqual(updatedScene.shotIds, ['shot_1b', 'shot_1a']);

    const shot1b = updated.shots?.find((s) => s.id === 'shot_1b');
    const shot1a = updated.shots?.find((s) => s.id === 'shot_1a');
    assert.strictEqual(shot1b?.shotNumber, 1);
    assert.strictEqual(shot1a?.shotNumber, 2);
  });

  // --- Test 6: Cascade Delete Shot ---
  await test('cascadeDeleteShot removes shot, recalculates scene duration, and cleans prompts', () => {
    const project = createBaseProject('proj_del_shot', 'user_alice');
    project.prompts = {
      shot_1a: [{ id: 'pv_1a', shotId: 'shot_1a', sceneId: 'sc_1', versionNumber: 1 } as any],
    };
    project.activePromptVersion = {
      shot_1a: 'pv_1a',
    };

    const updated = domainService.cascadeDeleteShot(project, 'shot_1a');

    // shot_1a removed, shot_1b remains and is reindexed to shotNumber 1
    assert.strictEqual(updated.shots?.find((s) => s.id === 'shot_1a'), undefined);
    const remainingShot = updated.shots?.find((s) => s.id === 'shot_1b');
    assert.strictEqual(remainingShot?.shotNumber, 1);

    // sc_1 duration recalculated: shot_1b duration is 7
    const scene1 = updated.scenes.find((s) => s.id === 'sc_1')!;
    assert.strictEqual(scene1.totalDurationSeconds, 7);
    assert.deepStrictEqual(scene1.shotIds, ['shot_1b']);

    // Prompts and active pointers for shot_1a removed
    assert.strictEqual(updated.prompts?.['shot_1a'], undefined);
    assert.strictEqual(updated.activePromptVersion?.['shot_1a'], undefined);
  });

  // --- Test 7: Prompt Version Creation & Activation ---
  await test('createShotPromptVersion isolates versions per shot and updates active version', () => {
    const project = createBaseProject('proj_prompt_iso', 'user_alice');

    // Create prompt for shot_1a
    const { project: pWith1a, version: v1a } = domainService.createShotPromptVersion(project, 'shot_1a', {
      visualPrompt: 'High quality shot of server chassis',
    });

    assert.strictEqual(v1a.versionNumber, 1);
    assert.strictEqual(v1a.shotId, 'shot_1a');
    assert.strictEqual(pWith1a.activePromptVersion?.['shot_1a'], v1a.id);

    // Create prompt for shot_1b in the same scene
    const { project: pWith1b, version: v1b } = domainService.createShotPromptVersion(pWith1a, 'shot_1b', {
      visualPrompt: 'Macro zoom on diagnostic LED indicators',
    });

    assert.strictEqual(v1b.versionNumber, 1);
    assert.strictEqual(v1b.shotId, 'shot_1b');
    assert.strictEqual(pWith1b.activePromptVersion?.['shot_1b'], v1b.id);

    // Verify shot_1a and shot_1b have distinct prompt version lists
    const shot1aVersions = pWith1b.prompts?.['shot_1a'] || [];
    const shot1bVersions = pWith1b.prompts?.['shot_1b'] || [];
    assert.strictEqual(shot1aVersions.length, 1);
    assert.strictEqual(shot1bVersions.length, 1);
    assert.strictEqual(shot1aVersions[0].visualPrompt, 'High quality shot of server chassis');
    assert.strictEqual(shot1bVersions[0].visualPrompt, 'Macro zoom on diagnostic LED indicators');

    // Activate older version test
    const activated = domainService.activateShotPromptVersion(pWith1b, 'shot_1a', v1a.id);
    assert.strictEqual(activated.activePromptVersion?.['shot_1a'], v1a.id);
  });

  // --- Test 8: Generation Job Deduplication ---
  await test('createDeduplicatedJob prevents duplicate queued/processing jobs for the same shot', () => {
    const project = createBaseProject('proj_job_dedup', 'user_alice');

    const jobData: Omit<GenerationJob, 'id' | 'queuedAt'> = {
      projectId: project.id,
      sceneId: 'sc_1',
      shotId: 'shot_1a',
      taskType: 'text_to_video',
      provider: 'gemini_omni',
      modelName: 'gemini-omni-1.1-flash',
      prompt: 'Macro shot of server',
      parameters: { aspectRatio: '16:9', resolution: '1080p', durationSeconds: 8, motionStrength: 5 },
      status: 'queued',
      progressPercent: 0,
      isSimulated: true,
    };

    // First job creation
    const { project: p1, job: job1, isExisting: isExisting1 } = domainService.createDeduplicatedJob(
      project,
      jobData,
      true
    );
    assert.strictEqual(isExisting1, false);
    assert.strictEqual(p1.generationJobs?.length, 1);

    // Attempt duplicate concurrent job for shot_1a
    const { project: p2, job: job2, isExisting: isExisting2 } = domainService.createDeduplicatedJob(
      p1,
      jobData,
      true
    );
    assert.strictEqual(isExisting2, true);
    assert.strictEqual(job1.id, job2.id);
    assert.strictEqual(p2.generationJobs?.length, 1); // No new job added

    // Different shot (shot_1b) should NOT be deduplicated
    const { project: p3, job: job3, isExisting: isExisting3 } = domainService.createDeduplicatedJob(
      p2,
      { ...jobData, shotId: 'shot_1b' },
      true
    );
    assert.strictEqual(isExisting3, false);
    assert.strictEqual(p3.generationJobs?.length, 2);
    assert.notStrictEqual(job1.id, job3.id);
  });

  // --- Test 9: Active Take Asset Attachment ---
  await test('attachActiveTakeAsset links asset to shot and sets status to ready', () => {
    const project = createBaseProject('proj_take_attach', 'user_alice');

    const updated = domainService.attachActiveTakeAsset(project, 'shot_1b', 'asset_take_42');
    const targetShot = updated.shots?.find((s) => s.id === 'shot_1b');

    assert.strictEqual(targetShot?.activeAssetId, 'asset_take_42');
    assert.strictEqual(targetShot?.status, 'ready');
  });

  // --- Test 10: Timeline Clip Construction from Shots ---
  await test('buildTimelineClipsFromShots creates sequential clips matching shot durations', () => {
    const project = createBaseProject('proj_timeline_gen', 'user_alice');
    const clips = domainService.buildTimelineClipsFromShots(project);

    // Should have 3 clips (shot_1a: 8s, shot_1b: 7s, shot_2a: 10s)
    assert.strictEqual(clips.length, 3);
    assert.strictEqual(clips[0].shotId, 'shot_1a');
    assert.strictEqual(clips[0].startTimeSeconds, 0);
    assert.strictEqual(clips[0].durationSeconds, 8);

    assert.strictEqual(clips[1].shotId, 'shot_1b');
    assert.strictEqual(clips[1].startTimeSeconds, 8);
    assert.strictEqual(clips[1].durationSeconds, 7);

    assert.strictEqual(clips[2].shotId, 'shot_2a');
    assert.strictEqual(clips[2].startTimeSeconds, 15);
    assert.strictEqual(clips[2].durationSeconds, 10);
  });

  console.log('\n========================================================================');
  console.log(`   Phase 2 Domain Services Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDomainServiceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
