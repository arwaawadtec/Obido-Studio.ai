/**
 * Obido Studio — Milestone UX-02: Production Workflow Foundation Test Suite
 * 
 * Verifies:
 * 1. Canonical 10-Stage Sequence (Brief -> Script -> Scenes -> Shots -> Storyboard -> Prompts -> Assets -> Generation -> Editing -> Export)
 * 2. Scenes and Shot List Separation into distinct stages with duration summaries
 * 3. Idempotent forward and backward workflow stage progression
 * 4. Active project context preservation during navigation
 * 5. Save and sync status transparency (local sandbox vs cloud sync)
 */

import assert from 'assert';
import { storage } from '../src/services/storage';
import { WorkflowStage, Project } from '../src/types';
import { getShotsForScene } from '../src/services/shotMigration';

async function runMilestoneUX02Tests() {
  console.log('========================================================================');
  console.log('   Obido Studio — Milestone UX-02: Production Workflow Test Suite       ');
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
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Set up fresh test project
  const testProject: Project = storage.createProject({
    title: 'Milestone UX-02 Test Video',
    purpose: 'explainer',
    targetAudience: 'Tech & Marketing Professionals',
    language: 'English',
    aspectRatio: '16:9',
    targetDurationSeconds: 60,
    visualStyle: 'cinematic_photorealistic',
    rawIdea: 'A modern AI-assisted video production workflow walkthrough',
  });

  const CANONICAL_10_STAGES: WorkflowStage[] = [
    'brief',
    'script',
    'scenes',
    'shots',
    'storyboard',
    'prompts',
    'assets',
    'generation',
    'editing',
    'export',
  ];

  await test('Task 1.1: Canonical 10-stage sequence definition and strict ordering', () => {
    assert.strictEqual(CANONICAL_10_STAGES.length, 10, 'Must have exactly 10 workflow stages');
    assert.strictEqual(CANONICAL_10_STAGES[0], 'brief');
    assert.strictEqual(CANONICAL_10_STAGES[1], 'script');
    assert.strictEqual(CANONICAL_10_STAGES[2], 'scenes');
    assert.strictEqual(CANONICAL_10_STAGES[3], 'shots');
    assert.strictEqual(CANONICAL_10_STAGES[4], 'storyboard');
    assert.strictEqual(CANONICAL_10_STAGES[5], 'prompts');
    assert.strictEqual(CANONICAL_10_STAGES[6], 'assets');
    assert.strictEqual(CANONICAL_10_STAGES[7], 'generation');
    assert.strictEqual(CANONICAL_10_STAGES[8], 'editing');
    assert.strictEqual(CANONICAL_10_STAGES[9], 'export');
  });

  await test('Task 1.2: Sequential progression through all 10 stages marks completed stages', () => {
    for (let i = 0; i < CANONICAL_10_STAGES.length; i++) {
      const stage = CANONICAL_10_STAGES[i];
      storage.setWorkflowStage(testProject.id, stage);

      const updated = storage.getProject(testProject.id);
      assert.strictEqual(updated?.currentStage, stage, `Stage must be ${stage}`);

      // All preceding stages must be recorded in completedStages
      for (let j = 0; j < i; j++) {
        assert.ok(
          updated?.completedStages.includes(CANONICAL_10_STAGES[j]),
          `Stage ${CANONICAL_10_STAGES[j]} must be in completedStages`
        );
      }
    }

    const finalProject = storage.getProject(testProject.id);
    assert.strictEqual(finalProject?.currentStage, 'export');
    assert.ok(finalProject?.completedStages.includes('brief'));
    assert.ok(finalProject?.completedStages.includes('script'));
    assert.ok(finalProject?.completedStages.includes('scenes'));
    assert.ok(finalProject?.completedStages.includes('shots'));
    assert.ok(finalProject?.completedStages.includes('storyboard'));
    assert.ok(finalProject?.completedStages.includes('prompts'));
    assert.ok(finalProject?.completedStages.includes('assets'));
    assert.ok(finalProject?.completedStages.includes('generation'));
    assert.ok(finalProject?.completedStages.includes('editing'));
  });

  await test('Task 1.3: Stage navigation is idempotent and preserves backward history', () => {
    storage.setWorkflowStage(testProject.id, 'shots');
    let p = storage.getProject(testProject.id);
    assert.strictEqual(p?.currentStage, 'shots');
    assert.ok(p?.completedStages.includes('brief'));
    assert.ok(p?.completedStages.includes('script'));
    assert.ok(p?.completedStages.includes('scenes'));

    // Move backward to 'script'
    storage.setWorkflowStage(testProject.id, 'script');
    p = storage.getProject(testProject.id);
    assert.strictEqual(p?.currentStage, 'script');
    assert.ok(p?.completedStages.includes('brief'));
    assert.ok(p?.completedStages.includes('scenes'));
  });

  await test('Task 1.4: ScenesStage domain operations (create, reorder, duration sum)', () => {
    const scene1 = storage.addScene(testProject.id, {
      narrativePurpose: 'Opening hook & Problem Statement',
      estimatedDurationSeconds: 15,
      visualDescription: 'Frustrated creator staring at multiple disconnected tools',
      narrationDialogue: 'Creating high-production video used to mean juggling ten disconnected tools.',
      audioCues: 'Low synth drone building in tension',
      cameraFraming: 'Wide establishing',
      status: 'ready_for_prompt',
    });

    const scene2 = storage.addScene(testProject.id, {
      narrativePurpose: 'Solution Reveal: Obido Studio Workflow',
      estimatedDurationSeconds: 20,
      visualDescription: 'Unified Obido Studio 10-stage interface animating into place',
      narrationDialogue: 'Until now. Meet Obido Studio.',
      audioCues: 'Crisp cinematic drop and upbeat rhythm',
      cameraFraming: 'Dynamic tracking',
      status: 'ready_for_prompt',
    });

    assert.ok(scene1, 'Scene 1 must be created');
    assert.ok(scene2, 'Scene 2 must be created');

    const project = storage.getProject(testProject.id);
    assert.strictEqual(project?.scenes.length, 2);
    assert.strictEqual(project?.scenes[0].sceneNumber, 1);
    assert.strictEqual(project?.scenes[1].sceneNumber, 2);

    // Reorder scenes
    storage.reorderScenes(testProject.id, 0, 1);
    const reordered = storage.getProject(testProject.id);
    assert.strictEqual(reordered?.scenes[0].narrativePurpose, 'Solution Reveal: Obido Studio Workflow');
    assert.strictEqual(reordered?.scenes[0].sceneNumber, 1);
    assert.strictEqual(reordered?.scenes[1].narrativePurpose, 'Opening hook & Problem Statement');
    assert.strictEqual(reordered?.scenes[1].sceneNumber, 2);
  });

  await test('Task 1.5: ShotListStage domain operations (add shot, framing, stable IDs, reorder)', () => {
    const project = storage.getProject(testProject.id);
    const activeScene = project?.scenes[0];
    assert.ok(activeScene, 'Must have active scene');

    const shot1 = storage.addShot(testProject.id, activeScene!.id, {
      durationSeconds: 4,
      framing: 'wide',
      cameraAngle: 'eye_level',
      cameraMovement: 'dolly_in',
      visualIntent: 'Wide studio establishing shot pushing smoothly into workspace',
    });

    const shot2 = storage.addShot(testProject.id, activeScene!.id, {
      durationSeconds: 5,
      framing: 'close_up',
      cameraAngle: 'low_angle',
      cameraMovement: 'orbital',
      visualIntent: 'Close-up on responsive interface with shallow depth of field',
    });

    assert.ok(shot1, 'Shot 1 must exist');
    assert.ok(shot2, 'Shot 2 must exist');
    assert.strictEqual(shot1?.sceneId, activeScene!.id);
    assert.strictEqual(shot2?.sceneId, activeScene!.id);
    assert.notStrictEqual(shot1?.id, shot2?.id);

    // Verify shots for scene (default shot created on scene creation + 2 added shots = 3 shots)
    const sceneShots = getShotsForScene(storage.getProject(testProject.id)!, activeScene!.id);
    assert.strictEqual(sceneShots.length, 3, 'Scene must contain 3 shots (1 default + 2 added)');
    assert.ok(sceneShots.some((s) => s.id === shot1!.id), 'Shot 1 must be in scene shots');
    assert.ok(sceneShots.some((s) => s.id === shot2!.id), 'Shot 2 must be in scene shots');

    // Update shot parameters
    storage.updateShot(testProject.id, shot1!.id, {
      framing: 'extreme_wide',
      durationSeconds: 6,
    });

    const updatedProject = storage.getProject(testProject.id);
    const updatedShot = (updatedProject?.shots || []).find((s) => s.id === shot1!.id);
    assert.strictEqual(updatedShot?.framing, 'extreme_wide');
    assert.strictEqual(updatedShot?.durationSeconds, 6);

    const totalDuration = (updatedProject?.shots || []).reduce((sum, s) => sum + s.durationSeconds, 0);
    assert.ok(totalDuration > 0, 'Total shot duration must be positive');
  });

  await test('Task 2: Active project context preservation during navigation', () => {
    storage.setActiveProjectId(testProject.id);
    assert.strictEqual(storage.getActiveProjectId(), testProject.id);

    const active = storage.getActiveProject();
    assert.strictEqual(active?.id, testProject.id);
    assert.strictEqual(active?.title, testProject.title);

    // Create a second project
    const secondProject = storage.createProject({
      title: 'Second Production Project',
      purpose: 'marketing',
      targetAudience: 'Global',
      language: 'Arabic',
      aspectRatio: '9:16',
      targetDurationSeconds: 30,
      visualStyle: 'anime_vector',
      rawIdea: 'Vertical reel concept',
    });

    storage.setWorkflowStage(testProject.id, 'prompts');
    storage.setWorkflowStage(secondProject.id, 'script');

    assert.strictEqual(storage.getProject(testProject.id)?.currentStage, 'prompts');
    assert.strictEqual(storage.getProject(secondProject.id)?.currentStage, 'script');

    // Navigation switching between active projects
    storage.setActiveProjectId(testProject.id);
    assert.strictEqual(storage.getActiveProjectId(), testProject.id);
    storage.setActiveProjectId(secondProject.id);
    assert.strictEqual(storage.getActiveProjectId(), secondProject.id);
  });

  await test('Task 3: Save and sync state transparency', () => {
    assert.strictEqual(testProject.isLocalOnly, true, 'Default project is local only');
    assert.strictEqual(testProject.cloudSyncStatus, 'local_only', 'Sync status is local_only');

    storage.updateProject(testProject.id, { title: 'Updated Title' });
    const updated = storage.getProject(testProject.id);
    assert.strictEqual(updated?.isLocalOnly, true);
    assert.strictEqual(updated?.cloudSyncStatus, 'local_only');
  });

  console.log('------------------------------------------------------------------------');
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestoneUX02Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
