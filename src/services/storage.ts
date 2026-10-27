import { Project, VideoTemplate, WorkflowStage, Scene, Shot, PromptVersion, Asset, GenerationJob, TimelineClip, ProjectCollaborator, ProjectPermission } from '../types';
import { firestoreService } from './firestoreService';
import { classifyConnectionError, reconnectNetwork } from './firebase';
import {
  migrateProjectToShots,
  calculateSceneDuration,
  getShotsForScene,
  mapLegacyFraming,
  mapLegacyCameraMovement,
  getPromptsForShot,
  getActivePromptForShot,
} from './shotMigration';
import { domainService } from './domainService';

const STORAGE_KEY = 'obido_studio_projects_v1';
const ACTIVE_PROJECT_KEY = 'obido_studio_active_project_id';
const LANGUAGE_PREF_KEY = 'obido_studio_lang';

export const TEMPLATES: VideoTemplate[] = [
  {
    id: 'tpl_tech_explainer',
    title: 'AI & Tech Product Explainer',
    category: 'explainer',
    description: 'A punchy 60-second structural breakdown showing real problems, solution mechanics, and actionable call to action.',
    targetDurationSeconds: 60,
    aspectRatio: '16:9',
    visualStyle: 'high_tech_holographic',
    scenesCount: 5,
    defaultIdea: 'A modern AI platform that automates multi-agent engineering workflows with high fidelity visual observability.',
    tags: ['Tech', 'B2B', 'SaaS', '16:9']
  },
  {
    id: 'tpl_social_hook_reel',
    title: '30s High-Retention Social Hook',
    category: 'social_ad',
    description: 'Ultra-fast vertical pacing built for TikTok, Reels & Shorts with an arresting 3-second visual disruptor.',
    targetDurationSeconds: 30,
    aspectRatio: '9:16',
    visualStyle: 'cinematic_photorealistic',
    scenesCount: 4,
    defaultIdea: 'Stop wasting 40 hours a week on manual video cutting. Here is the AI workflow top creators use in 2026.',
    tags: ['Mobile', 'Reels', 'Social', '9:16']
  },
  {
    id: 'tpl_brand_story',
    title: 'Minimalist Brand & Atelier Story',
    category: 'brand_story',
    description: 'Cinematic visual documentary style emphasizing craftsmanship, tactile textures, and emotional resonance.',
    targetDurationSeconds: 90,
    aspectRatio: '16:9',
    visualStyle: 'editorial_film',
    scenesCount: 6,
    defaultIdea: 'The philosophy of timeless Scandinavian design meets precision algorithmic robotics in our Copenhagen studio.',
    tags: ['Brand', 'Luxury', 'Editorial', '16:9']
  },
  {
    id: 'tpl_product_launch',
    title: 'Keynote Feature Launch',
    category: 'product_launch',
    description: 'High-energy cinematic reveal with dynamic camera zooms, metric callouts, and product beauty shots.',
    targetDurationSeconds: 45,
    aspectRatio: '16:9',
    visualStyle: 'minimal_3d',
    scenesCount: 4,
    defaultIdea: 'Introducing Lumina: the worlds first holographic spatial display with zero-latency eye tracking.',
    tags: ['Hardware', 'Launch', '3D', '16:9']
  }
];

const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'proj_quantum_leap',
    userId: 'user_default',
    title: 'Quantum Leap: Autonomous Data Workflows',
    description: 'B2B product explainer demonstrating automated pipeline intelligence for enterprise cloud engineers.',
    currentStage: 'storyboard',
    completedStages: ['brief', 'script'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    isLocalOnly: true,
    brief: {
      title: 'Quantum Leap: Autonomous Data Workflows',
      purpose: 'explainer',
      targetAudience: 'Chief Technology Officers and Senior Data Engineers at high-growth tech companies',
      language: 'English',
      aspectRatio: '16:9',
      targetDurationSeconds: 60,
      visualStyle: 'high_tech_holographic',
      rawIdea: 'Explain how our distributed pipeline automatically self-heals broken ETL streams without waking on-call engineers at 3 AM.',
      keyTakeaway: 'Zero downtime and instant automated anomaly recovery in seconds.',
      toneOfVoice: 'Authoritative, precise, clean, technical without buzzword jargon.',
      callToAction: 'Book a technical benchmark session with our engineering team.',
      brandColors: ['#635BFF', '#11152B', '#38D9F9'],
      lastUpdated: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    scripts: [
      {
        id: 'script_v1',
        versionNumber: 1,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        title: 'Quantum Leap — The 60-Second Proof',
        logline: 'When data pipelines fail at 3 AM, autonomous agents isolate and patch schemas before users ever notice.',
        hook: 'At 3:14 AM, your primary transaction pipeline stalls. You dont wake up.',
        fullText: `[SCENE 1 - 0:00-0:10]
Voiceover: At 3:14 AM, a critical schema drift triggers a failure in your primary data pipeline. But tonight, nobody gets paged.

[SCENE 2 - 0:10-0:22]
Voiceover: Quantum Leap's autonomous telemetry engine catches the mismatch in 14 milliseconds, reconstructing the corrupted downstream DAG before latency cascades.

[SCENE 3 - 0:22-0:36]
Voiceover: Traditional monitoring merely alerts you to fires. Quantum Leap writes the idempotent fix, validates integrity against synthetic test fixtures, and hot-swaps the node.

[SCENE 4 - 0:36-0:48]
Voiceover: Over 400 engineering teams have eliminated night-shift alerts and reclaimed 28 developer hours every week.

[SCENE 5 - 0:48-1:00]
Voiceover: Stop babysitting pipelines. Start building products. Schedule your live technical benchmark at quantumleap.dev today.`,
        estimatedSpeakingWords: 128,
        estimatedDurationSeconds: 60,
        isCurrent: true,
      }
    ],
    currentScriptId: 'script_v1',
    scenes: [
      {
        id: 'sc_1',
        sceneNumber: 1,
        narrativePurpose: 'Establish the high-stakes 3 AM crisis and quiet confidence of automated resilience.',
        estimatedDurationSeconds: 10,
        visualDescription: 'Extreme close up of a modern glowing server rack rackmount led turning amber, then smooth camera pull-back showing a dark quiet engineering lab in moonlight.',
        narrationDialogue: 'At 3:14 AM, a critical schema drift triggers a failure in your primary data pipeline. But tonight, nobody gets paged.',
        audioCues: 'Low resonant sub-bass drone with quiet electrical hum and mechanical relay click.',
        cameraFraming: 'Close-up',
        status: 'approved',
      },
      {
        id: 'sc_2',
        sceneNumber: 2,
        narrativePurpose: 'Demonstrate the speed and precision of algorithmic detection.',
        estimatedDurationSeconds: 12,
        visualDescription: 'Holographic schematic of a distributed DAG graph in glowing cyan and indigo light, nodes self-reorganizing effortlessly.',
        narrationDialogue: 'Quantum Leap autonomous telemetry engine catches the mismatch in 14 milliseconds, reconstructing the corrupted downstream DAG before latency cascades.',
        audioCues: 'Fast microscopic digital click-train and swift whoosh transition.',
        cameraFraming: 'Wide establishing',
        status: 'approved',
      },
      {
        id: 'sc_3',
        sceneNumber: 3,
        narrativePurpose: 'Contrast reactive alerting with proactive self-healing.',
        estimatedDurationSeconds: 14,
        visualDescription: 'Split view: red cascading error logs dissolving into crisp green verified verification checksums on an ultra-minimalist terminal.',
        narrationDialogue: 'Traditional monitoring merely alerts you to fires. Quantum Leap writes the idempotent fix, validates integrity against synthetic test fixtures, and hot-swaps the node.',
        audioCues: 'Crisp keyboard staccato, rising synth swell of clarity.',
        cameraFraming: 'Medium shot',
        status: 'ready_for_prompt',
      },
      {
        id: 'sc_4',
        sceneNumber: 4,
        narrativePurpose: 'Quantified social proof and engineering relief.',
        estimatedDurationSeconds: 12,
        visualDescription: 'Modern well-lit sun-drenched engineering loft, software architects collaborating over coffee with a large clean dashboard showing 99.999% uptime.',
        narrationDialogue: 'Over 400 engineering teams have eliminated night-shift alerts and reclaimed 28 developer hours every week.',
        audioCues: 'Warm organic acoustic strings mixed with subtle modern percussion.',
        cameraFraming: 'Medium shot',
        status: 'draft',
      },
      {
        id: 'sc_5',
        sceneNumber: 5,
        narrativePurpose: 'Direct, confident call to action.',
        estimatedDurationSeconds: 12,
        visualDescription: 'Clean typography lockup on dark navy canvas: Quantum Leap wordmark with subtle cyan particle shimmer, URL quantumleap.dev.',
        narrationDialogue: 'Stop babysitting pipelines. Start building products. Schedule your live technical benchmark at quantumleap.dev today.',
        audioCues: 'Decisive resonant chord with gentle fade out.',
        cameraFraming: 'Close-up',
        status: 'draft',
      }
    ],
    prompts: {
      'sc_1': [
        {
          id: 'p_1_1',
          sceneId: 'sc_1',
          versionNumber: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          visualPrompt: 'Cinematic macro view of server chassis indicator lights glowing in dark room, cold slate blue lighting, shallow depth of field, 35mm film grain, 8k resolution',
          motionInstructions: 'Slow continuous dolly-out zoom backwards from lens, gentle rotation 5 degrees',
          cameraDirection: 'Macro 50mm f/1.4 lens, low angle looking up',
          negativePrompt: 'blurry, flickering, low resolution, cartoon, 3d render artifacts, text, watermarks',
          audioInstructions: 'Sub-bass drone 40Hz with soft mechanical click',
          targetProvider: 'gemini_omni',
          targetModel: 'gemini-omni-1.1-flash',
          isFavorite: true,
        }
      ],
      'sc_2': [
        {
          id: 'p_2_1',
          sceneId: 'sc_2',
          versionNumber: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          visualPrompt: 'Translucent 3D glowing graph network nodes floating in dark vacuum, geometric lines connecting in cyan #38D9F9 and indigo #635BFF, clean modern data visualization',
          motionInstructions: 'Camera orbital fly-around 45 degrees over 8 seconds, smooth deceleration',
          cameraDirection: 'Wide isometric perspective, crystal clear glass materials',
          negativePrompt: 'cluttered, low-poly, pixelated, neon rainbow glow, oversaturated',
          audioInstructions: 'Micro digital ping with gentle air swoosh',
          targetProvider: 'gemini_omni',
          targetModel: 'gemini-omni-1.1-flash',
          isFavorite: true,
        }
      ]
    },
    activePromptVersion: {
      'sc_1': 'p_1_1',
      'sc_2': 'p_2_1',
    },
    assets: [
      {
        id: 'asset_demo_clip_1',
        projectId: 'proj_quantum_leap',
        sceneId: 'sc_1',
        name: 'Scene 1 — Server Rack 3AM (Demo Clip)',
        type: 'video',
        url: '',
        filesizeBytes: 14200000,
        durationSeconds: 10,
        dimensions: { width: 1920, height: 1080 },
        aspectRatio: '16:9',
        format: 'mp4',
        provider: 'local_demo',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        isSimulatedDemo: true,
        metadata: {
          note: 'Demonstration asset placeholder for workflow preview. Provider-independent pipeline ready.'
        }
      }
    ],
    generationJobs: [
      {
        id: 'job_sample_1',
        projectId: 'proj_quantum_leap',
        sceneId: 'sc_1',
        taskType: 'text_to_video',
        provider: 'local_demo',
        modelName: 'Demo Video Engine v1',
        prompt: 'Cinematic macro view of server chassis indicator lights glowing in dark room',
        parameters: {
          aspectRatio: '16:9',
          resolution: '1080p',
          durationSeconds: 10,
          motionStrength: 6,
        },
        status: 'succeeded',
        progressPercent: 100,
        queuedAt: new Date(Date.now() - 86400000).toISOString(),
        startedAt: new Date(Date.now() - 86400000 + 2000).toISOString(),
        completedAt: new Date(Date.now() - 86400000 + 45000).toISOString(),
        resultAssetId: 'asset_demo_clip_1',
        isSimulated: true,
      }
    ],
    timeline: {
      id: 'time_1',
      projectId: 'proj_quantum_leap',
      totalDurationSeconds: 60,
      fps: 30,
      aspectRatio: '16:9',
      clips: [
        {
          id: 'clip_sc1',
          sceneId: 'sc_1',
          assetId: 'asset_demo_clip_1',
          track: 'video',
          startTimeSeconds: 0,
          durationSeconds: 10,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Scene 1: Server Chassis Alert',
          transitionIn: 'cut',
        },
        {
          id: 'clip_sc2',
          sceneId: 'sc_2',
          track: 'video',
          startTimeSeconds: 10,
          durationSeconds: 12,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Scene 2: Holographic DAG Graph',
          transitionIn: 'crossfade',
        },
        {
          id: 'clip_sc3',
          sceneId: 'sc_3',
          track: 'video',
          startTimeSeconds: 22,
          durationSeconds: 14,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Scene 3: Automated Fix & Checksum',
          transitionIn: 'crossfade',
        },
        {
          id: 'clip_sc4',
          sceneId: 'sc_4',
          track: 'video',
          startTimeSeconds: 36,
          durationSeconds: 12,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Scene 4: Engineering Team Loft',
          transitionIn: 'crossfade',
        },
        {
          id: 'clip_sc5',
          sceneId: 'sc_5',
          track: 'video',
          startTimeSeconds: 48,
          durationSeconds: 12,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Scene 5: Brand Outro & CTA',
          transitionIn: 'dip_to_black',
        },
        {
          id: 'clip_vo1',
          sceneId: 'sc_1',
          track: 'voiceover',
          startTimeSeconds: 0.5,
          durationSeconds: 8.5,
          sourceInSeconds: 0,
          volume: 0.95,
          title: 'Voiceover: 3AM Schema Drift',
          subtitleText: 'At 3:14 AM, a critical schema drift triggers a failure in your primary data pipeline.',
        },
        {
          id: 'clip_sub1',
          sceneId: 'sc_1',
          track: 'subtitles',
          startTimeSeconds: 0.5,
          durationSeconds: 8.5,
          sourceInSeconds: 0,
          volume: 1,
          title: 'Subtitles SC1',
          subtitleText: 'At 3:14 AM, a critical schema drift triggers a failure in your primary data pipeline. But tonight, nobody gets paged.',
        }
      ],
      lastModified: new Date(Date.now() - 3600000).toISOString(),
    },
    exportJobs: [],
  },
  {
    id: 'proj_neon_reel',
    userId: 'user_default',
    title: 'Neon Velocity: Future of Creative Tools',
    description: 'Dynamic 30-second vertical social ad with high-energy cuts and typography hooks.',
    currentStage: 'prompts',
    completedStages: ['brief', 'script', 'storyboard'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    isLocalOnly: true,
    brief: {
      title: 'Neon Velocity: Future of Creative Tools',
      purpose: 'social_ad',
      targetAudience: 'Independent video creators and digital marketers on TikTok and Instagram',
      language: 'English',
      aspectRatio: '9:16',
      targetDurationSeconds: 30,
      visualStyle: 'cinematic_photorealistic',
      rawIdea: 'How creators are producing broadcast-quality ads on their phone in 15 minutes using AI storyboards.',
      keyTakeaway: 'Obido Studio gives you Hollywood pre-production in your pocket.',
      toneOfVoice: 'Energetic, direct, relatable, punchy.',
      callToAction: 'Try Obido Studio free today.',
      brandColors: ['#38D9F9', '#9B8CFF', '#11152B'],
      lastUpdated: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    scripts: [
      {
        id: 'script_reel_1',
        versionNumber: 1,
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        title: '30-Second Creator Hook',
        logline: 'The secret weapon high-output video creators are using in 2026.',
        hook: 'If youre still staring at a blank Premiere timeline for 4 hours, watch this.',
        fullText: `[0:00-0:06] If youre still staring at a blank editing timeline for 4 hours, stop.
[0:06-0:14] Obido Studio turns your rough idea into a scene-by-scene storyboard, camera prompts, and ready-to-cut assets in 90 seconds.
[0:14-0:22] Human control at every single step: adjust pacing, rewrite dialogue, and choose your render engine.
[0:22-0:30] Tap the link below and create your first video right now.`,
        estimatedSpeakingWords: 68,
        estimatedDurationSeconds: 30,
        isCurrent: true,
      }
    ],
    currentScriptId: 'script_reel_1',
    scenes: [
      {
        id: 'sc_r1',
        sceneNumber: 1,
        narrativePurpose: 'Scroll-stopping visual hook exposing the pain of blank timeline.',
        estimatedDurationSeconds: 6,
        visualDescription: 'Frustrated creator staring at dark laptop screen reflection in dark studio, dramatic lighting.',
        narrationDialogue: 'If youre still staring at a blank editing timeline for 4 hours, stop.',
        audioCues: 'Sudden silence cut followed by deep kick drum drop.',
        cameraFraming: 'Close-up',
        status: 'approved',
      },
      {
        id: 'sc_r2',
        sceneNumber: 2,
        narrativePurpose: 'The transformation to fast storyboard generation.',
        estimatedDurationSeconds: 8,
        visualDescription: 'Fast montaged swipe of scenes appearing on an iPad screen, vibrant cards snapping into order.',
        narrationDialogue: 'Obido Studio turns your rough idea into a scene-by-scene storyboard, camera prompts, and ready-to-cut assets in 90 seconds.',
        audioCues: 'Crisp card shuffle and digital riser.',
        cameraFraming: 'Over-the-shoulder',
        status: 'approved',
      },
      {
        id: 'sc_r3',
        sceneNumber: 3,
        narrativePurpose: 'Human agency and fine-grained control.',
        estimatedDurationSeconds: 8,
        visualDescription: 'Creator hand tweaking timeline sliders and camera direction handles with precision.',
        narrationDialogue: 'Human control at every single step: adjust pacing, rewrite dialogue, and choose your render engine.',
        audioCues: 'Smooth mechanical click and upbeat synth track.',
        cameraFraming: 'POV / Macro',
        status: 'ready_for_prompt',
      },
      {
        id: 'sc_r4',
        sceneNumber: 4,
        narrativePurpose: 'Call to action and immediate conversion.',
        estimatedDurationSeconds: 8,
        visualDescription: 'Glowing smartphone displaying the completed video export ready to post, creator smiles.',
        narrationDialogue: 'Tap the link below and create your first video right now.',
        audioCues: 'Crisp finish bell tone and musical resolution.',
        cameraFraming: 'Medium shot',
        status: 'draft',
      }
    ],
    prompts: {},
    activePromptVersion: {},
    assets: [],
    generationJobs: [],
    timeline: {
      id: 'time_reel',
      projectId: 'proj_neon_reel',
      totalDurationSeconds: 30,
      fps: 30,
      aspectRatio: '9:16',
      clips: [],
      lastModified: new Date(Date.now() - 86400000).toISOString(),
    },
    exportJobs: [],
  }
];

class StorageService {
  private projects: Project[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof localStorage === 'undefined') {
        this.projects = SAMPLE_PROJECTS.map((p) => migrateProjectToShots(p));
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored);
        this.projects = Array.isArray(raw) ? raw.map((p: Project) => migrateProjectToShots(p)) : [];
      } else {
        this.projects = SAMPLE_PROJECTS.map((p) => migrateProjectToShots(p));
        this.persist();
      }
    } catch {
      this.projects = SAMPLE_PROJECTS.map((p) => migrateProjectToShots(p));
    }
  }

  private persist() {
    if (typeof localStorage === 'undefined') {
      this.notify();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
    } catch (e) {
      console.warn('StorageService: failed to persist to localStorage', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getProjects(userId?: string, userEmail?: string): Project[] {
    const cleanEmail = userEmail?.trim().toLowerCase();
    if (!userId) {
      // Unauthenticated / guest preview: return ONLY guest demo projects
      return this.projects
        .filter((p) => p.userId === 'user_default')
        .map((p) => ({ ...p, userPermission: 'owner' as ProjectPermission }));
    }
    // Return projects owned by this user OR shared with this user via email
    return this.projects
      .filter((p) => {
        if (p.userId === userId) return true;
        if (cleanEmail && p.memberEmails && p.memberEmails.includes(cleanEmail)) return true;
        return false;
      })
      .map((p) => {
        let perm: ProjectPermission = 'owner';
        if (p.userId === userId) {
          perm = 'owner';
        } else if (cleanEmail && p.editorEmails?.includes(cleanEmail)) {
          perm = 'editor';
        } else if (cleanEmail && p.viewerEmails?.includes(cleanEmail)) {
          perm = 'viewer';
        }
        return { ...p, userPermission: perm };
      });
  }

  /**
   * SEC-01: Safely cleans up user-specific cached project data on sign-out.
   * - Preserves unsynchronized local drafts under a quarantined user-scoped key so work is never lost.
   * - Removes all projects belonging to the signed-out user from the shared local cache (this.projects & STORAGE_KEY).
   * - Invalidates active-project cache if it belonged to the signed-out user.
   * - Prevents the signed-out user's projects from appearing in another user's UI.
   */
  handleUserSignOut(signedOutUserId?: string) {
    try {
      const hasLocalStorage = typeof localStorage !== 'undefined';
      if (!signedOutUserId) {
        if (hasLocalStorage) {
          try {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
          } catch {}
        }
        this.projects = [...SAMPLE_PROJECTS];
        this.persist();
        return;
      }

      // 1. Identify all projects belonging to this user
      const userProjects = this.projects.filter((p) => p.userId === signedOutUserId);

      // 2. Identify and quarantine any unsynchronized local drafts so they are not permanently deleted
      const unsyncedDrafts = userProjects.filter((p) => p.isLocalOnly === true && !p.migratedFromLocal);
      if (unsyncedDrafts.length > 0 && hasLocalStorage) {
        const quarantineKey = `obido_studio_unsynced_${signedOutUserId}`;
        try {
          localStorage.setItem(quarantineKey, JSON.stringify(unsyncedDrafts));
        } catch (e) {
          console.warn('[StorageService] Failed to quarantine unsynced drafts:', e);
        }
      }

      // 3. Remove all projects of the signed-out user from active memory and shared storage
      const remainingProjects = this.projects.filter((p) => p.userId !== signedOutUserId);
      this.projects = remainingProjects.length > 0 ? remainingProjects : [...SAMPLE_PROJECTS];

      if (hasLocalStorage) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
        } catch (e) {
          console.warn('[StorageService] Failed to persist cleaned projects on signout:', e);
        }

        // 4. Invalidate active project if it was owned by the signed-out user
        try {
          const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
          if (activeId) {
            const wasOwnedBySignoutUser = userProjects.some((p) => p.id === activeId);
            if (wasOwnedBySignoutUser) {
              localStorage.removeItem(ACTIVE_PROJECT_KEY);
            }
          }
        } catch {}
      }
    } catch (err) {
      console.error('[StorageService] Error during user sign-out cache cleanup:', err);
      this.projects = [...SAMPLE_PROJECTS];
    } finally {
      this.notify();
    }
  }

  /**
   * Restores any quarantined unsynchronized drafts when the user logs back in.
   */
  restoreUserUnsyncedDrafts(userId: string) {
    if (!userId || userId === 'user_default' || typeof localStorage === 'undefined') return;
    const quarantineKey = `obido_studio_unsynced_${userId}`;
    try {
      const stored = localStorage.getItem(quarantineKey);
      if (stored) {
        const drafts: Project[] = JSON.parse(stored);
        if (Array.isArray(drafts) && drafts.length > 0) {
          const existingIds = new Set(this.projects.map((p) => p.id));
          const newDrafts = drafts.filter((d) => !existingIds.has(d.id));
          if (newDrafts.length > 0) {
            this.projects = [...newDrafts, ...this.projects];
            this.persist();
          }
        }
        localStorage.removeItem(quarantineKey);
      }
    } catch (e) {
      console.warn('[StorageService] Failed to restore unsynced drafts:', e);
    }
  }

  async queryProjects(userId?: string, shouldSimulateError: boolean = false): Promise<Project[]> {
    if (shouldSimulateError) {
      throw new Error('Unable to retrieve projects from database service. Please check your connection.');
    }

    if (userId) {
      this.restoreUserUnsyncedDrafts(userId);
    }

    // Cloud persistence path: when authenticated with a real cloud UID, query Firestore
    if (firestoreService.isAvailable() && userId && userId !== 'user_default' && !userId.startsWith('user_demo_')) {
      try {
        const rawCloudProjects = await firestoreService.getProjects(userId);
        const cloudProjects = rawCloudProjects.map((p) => migrateProjectToShots(p));

        // Reconcile cloud projects with local pending edits
        const localUserProjects = this.projects.filter((p) => p.userId === userId);
        const localMap = new Map<string, Project>(localUserProjects.map((p) => [p.id, p]));

        const reconciledUserProjects: Project[] = [];
        const seenIds = new Set<string>();

        for (const cloudP of cloudProjects) {
          seenIds.add(cloudP.id);
          const localP = localMap.get(cloudP.id);
          if (localP) {
            // Check if local version has newer un-synced edits
            const localTime = new Date(localP.updatedAt || localP.createdAt).getTime();
            const cloudTime = new Date(cloudP.updatedAt || cloudP.createdAt).getTime();
            const hasPendingSync = localP.cloudSyncStatus === 'pending';

            if (hasPendingSync && localTime > cloudTime) {
              // Preserve local version and trigger background sync to cloud
              reconciledUserProjects.push(localP);
              firestoreService.saveProject(localP, userId).catch(() => {});
            } else {
              // Cloud version is up-to-date or newer
              reconciledUserProjects.push({
                ...cloudP,
                cloudSyncStatus: 'synced',
              });
            }
          } else {
            reconciledUserProjects.push({
              ...cloudP,
              cloudSyncStatus: 'synced',
            });
          }
        }

        // Preserve any local projects created offline that haven't reached cloud yet
        for (const localP of localUserProjects) {
          if (!seenIds.has(localP.id)) {
            reconciledUserProjects.push(localP);
            firestoreService.saveProject(localP, userId).catch(() => {});
          }
        }

        // Update local memory cache with latest documents
        const otherProjects = this.projects.filter((p) => p.userId !== userId);
        this.projects = [...otherProjects, ...reconciledUserProjects];
        this.persist();
        return reconciledUserProjects;
      } catch (err) {
        const classification = classifyConnectionError(err);
        if (classification === 'permanent_offline') {
          // Device is offline; cleanly service from local cache
          return this.getProjects(userId);
        } else if (classification === 'failed_precondition') {
          console.warn('[StorageService] Multi-tab persistence contention (failed-precondition); serving projects from local cache.');
          return this.getProjects(userId);
        } else if (classification === 'transient_drop') {
          console.warn('[StorageService] Transient Firestore connection drop; reading projects from local cache while reconnecting.');
          reconnectNetwork().catch(() => {});
          return this.getProjects(userId);
        }
        console.warn('[StorageService] Firestore query error, falling back to local cache:', err);
        return this.getProjects(userId);
      }
    }

    // Local / demo latency simulation
    await new Promise((resolve) => setTimeout(resolve, 80));
    return this.getProjects(userId);
  }

  getProject(id: string, userId?: string): Project | undefined {
    const proj = this.projects.find((p) => p.id === id);
    if (!proj) return undefined;
    // If userId is provided, ensure ownership
    if (userId && proj.userId !== userId && proj.userId !== 'user_default') {
      return undefined; // Protected from unauthorized access
    }
    return proj;
  }

  private inMemoryActiveProjectId: string | null = null;

  getActiveProjectId(userId?: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (stored) {
          const proj = this.projects.find((p) => p.id === stored);
          if (proj && (!userId || proj.userId === userId)) {
            return stored;
          }
        }
      } else if (this.inMemoryActiveProjectId) {
        const proj = this.projects.find((p) => p.id === this.inMemoryActiveProjectId);
        if (proj && (!userId || proj.userId === userId)) {
          return this.inMemoryActiveProjectId;
        }
      }
      const userProjects = this.getProjects(userId);
      return userProjects[0]?.id ?? null;
    } catch {
      return this.inMemoryActiveProjectId ?? null;
    }
  }

  getActiveProject(userId?: string): Project | undefined {
    const activeId = this.getActiveProjectId(userId);
    return activeId ? this.getProject(activeId, userId) : undefined;
  }

  setActiveProjectId(id: string) {
    this.inMemoryActiveProjectId = id;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      }
    } catch {}
    this.notify();
  }

  createProject(briefData: Partial<Project['brief']> & { title: string; userId?: string }): Project {
    const id = 'proj_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    
    // Determine owner: explicit userId, or active session user, fallback to guest
    let ownerId = briefData.userId;
    if (!ownerId) {
      try {
        const session = localStorage.getItem('obido_studio_auth_user_v1');
        if (session) {
          const u = JSON.parse(session);
          ownerId = u?.id;
        }
      } catch {}
    }
    const finalOwnerId: string = ownerId || 'user_default';
    const isCloudUser = firestoreService.isAvailable() && finalOwnerId !== 'user_default' && !finalOwnerId.startsWith('user_demo_');

    const newProject: Project = {
      id,
      userId: finalOwnerId,
      title: briefData.title || 'Untitled Video Project',
      description: briefData.rawIdea?.substring(0, 120) || 'New Obido Studio production project',
      schemaVersion: 2,
      currentStage: 'brief',
      completedStages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: !isCloudUser,
      cloudSyncStatus: isCloudUser ? 'pending' : 'local_only',
      brief: {
        title: briefData.title || 'Untitled Video Project',
        purpose: briefData.purpose || 'explainer',
        targetAudience: briefData.targetAudience || 'General audience interested in modern digital solutions',
        language: briefData.language || 'English',
        aspectRatio: briefData.aspectRatio || '16:9',
        targetDurationSeconds: briefData.targetDurationSeconds || 60,
        visualStyle: briefData.visualStyle || 'cinematic_photorealistic',
        rawIdea: briefData.rawIdea || '',
        keyTakeaway: briefData.keyTakeaway || '',
        toneOfVoice: briefData.toneOfVoice || 'Professional, clear, engaging',
        callToAction: briefData.callToAction || 'Learn more at our website',
        brandColors: briefData.brandColors || ['#635BFF', '#11152B'],
        lastUpdated: new Date().toISOString(),
      },
      scripts: [],
      scenes: [],
      shots: [],
      prompts: {},
      activePromptVersion: {},
      assets: [],
      generationJobs: [],
      timeline: {
        id: 'time_' + id,
        projectId: id,
        totalDurationSeconds: briefData.targetDurationSeconds || 60,
        fps: 30,
        aspectRatio: briefData.aspectRatio || '16:9',
        clips: [],
        lastModified: new Date().toISOString(),
      },
      exportJobs: [],
    };

    this.projects.unshift(newProject);
    this.setActiveProjectId(id);
    this.persist();

    if (isCloudUser) {
      firestoreService.saveProject(newProject, finalOwnerId)
        .then((res) => {
          if (res?.syncStatus === 'synced') {
            const p = this.projects.find((proj) => proj.id === id);
            if (p) {
              p.cloudSyncStatus = 'synced';
              p.lastSyncedAt = new Date().toISOString();
              this.persist();
              this.notify();
            }
          }
        })
        .catch((err) => {
          console.warn('[StorageService] Background cloud save error:', err);
        });
    }

    return newProject;
  }

  createFromTemplate(templateId: string): Project | null {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return null;

    const proj = this.createProject({
      title: `${tpl.title} (Draft)`,
      purpose: tpl.category,
      aspectRatio: tpl.aspectRatio,
      targetDurationSeconds: tpl.targetDurationSeconds,
      visualStyle: tpl.visualStyle,
      rawIdea: tpl.defaultIdea,
      keyTakeaway: `Key takeaway from ${tpl.title}`,
      toneOfVoice: 'Focused, concise, modern',
      callToAction: 'Visit our link to learn more',
    });

    return proj;
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;

    const isCloudUser =
      firestoreService.isAvailable() &&
      this.projects[idx].userId !== 'user_default' &&
      !this.projects[idx].userId.startsWith('user_demo_');

    this.projects[idx] = {
      ...this.projects[idx],
      ...updates,
      cloudSyncStatus: isCloudUser ? 'pending' : (this.projects[idx].cloudSyncStatus || 'local_only'),
      updatedAt: new Date().toISOString(),
    };

    const updated = this.projects[idx];
    this.persist();

    if (isCloudUser) {
      firestoreService.saveProject(updated, updated.userId)
        .then((res) => {
          if (res?.syncStatus === 'synced') {
            const p = this.projects.find((proj) => proj.id === id);
            if (p) {
              p.cloudSyncStatus = 'synced';
              p.lastSyncedAt = new Date().toISOString();
              this.persist();
              this.notify();
            }
          } else if (res?.syncStatus === 'failed') {
            const p = this.projects.find((proj) => proj.id === id);
            if (p) {
              p.cloudSyncStatus = 'failed';
              this.persist();
              this.notify();
            }
          }
        })
        .catch((err) => {
          console.warn('[StorageService] Background cloud update error:', err);
        });
    }

    return updated;
  }

  deleteProject(id: string): boolean {
    const target = this.projects.find((p) => p.id === id);
    const initialLen = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    if (this.projects.length !== initialLen) {
      if (this.getActiveProjectId() === id) {
        this.setActiveProjectId(this.projects[0]?.id ?? '');
      }
      this.persist();

      if (target && firestoreService.isAvailable() && target.userId !== 'user_default' && !target.userId.startsWith('user_demo_')) {
        firestoreService.deleteProject(id, target.userId).catch((err) => {
          console.warn('[StorageService] Background cloud delete error:', err);
        });
      }

      return true;
    }
    return false;
  }

  setWorkflowStage(projectId: string, stage: WorkflowStage) {
    const project = this.getProject(projectId);
    if (!project) return;

    const completed = new Set(project.completedStages);
    // Mark previous stage as completed if moving forward
    const stagesOrder: WorkflowStage[] = [
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
    const currentIndex = stagesOrder.indexOf(project.currentStage);
    const targetIndex = stagesOrder.indexOf(stage);

    if (targetIndex > currentIndex) {
      for (let i = 0; i < targetIndex; i++) {
        completed.add(stagesOrder[i]);
      }
    }

    this.updateProject(projectId, {
      currentStage: stage,
      completedStages: Array.from(completed),
    });
  }

  // Scene management
  addScene(projectId: string, scene: Omit<Scene, 'id' | 'sceneNumber'>): Scene | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const sceneNumber = project.scenes.length + 1;
    const sceneId = 'sc_' + Math.random().toString(36).substring(2, 9);
    const duration = Math.max(1, scene.estimatedDurationSeconds || 5);
    const defaultShotId = `shot_${sceneId}_1`;

    const initialShot: Shot = {
      id: defaultShotId,
      projectId,
      sceneId,
      shotNumber: 1,
      name: scene.narrativePurpose ? `${scene.narrativePurpose} (Shot 1)` : `Scene ${sceneNumber} - Shot 1`,
      durationSeconds: duration,
      visualIntent: scene.visualDescription || '',
      framing: mapLegacyFraming(scene.cameraFraming),
      cameraAngle: 'eye_level',
      cameraMovement: mapLegacyCameraMovement(scene.cameraFraming),
      dialogueSnippet: scene.narrationDialogue || undefined,
      voiceoverSnippet: scene.narrationDialogue || undefined,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newScene: Scene = {
      ...scene,
      id: sceneId,
      sceneNumber,
      shotIds: [defaultShotId],
      totalDurationSeconds: duration,
      estimatedDurationSeconds: duration,
    };

    const updatedScenes = [...project.scenes, newScene];
    const updatedShots = [...(project.shots || []), initialShot];

    this.updateProject(projectId, {
      scenes: updatedScenes,
      shots: updatedShots,
    });
    return newScene;
  }

  updateScene(projectId: string, sceneId: string, updates: Partial<Scene>) {
    const project = this.getProject(projectId);
    if (!project) return;

    const sceneShots = (project.shots || []).filter((s) => s.sceneId === sceneId);
    let totalDuration = updates.estimatedDurationSeconds;
    if (sceneShots.length > 0) {
      totalDuration = sceneShots.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);
    }

    const updatedScenes = project.scenes.map((sc) =>
      sc.id === sceneId
        ? {
            ...sc,
            ...updates,
            totalDurationSeconds: totalDuration ?? sc.totalDurationSeconds ?? sc.estimatedDurationSeconds,
          }
        : sc
    );
    this.updateProject(projectId, { scenes: updatedScenes });
  }

  deleteScene(projectId: string, sceneId: string) {
    const project = this.getProject(projectId);
    if (!project) return;

    const updated = domainService.cascadeDeleteScene(project, sceneId);
    this.updateProject(projectId, {
      scenes: updated.scenes,
      shots: updated.shots,
      prompts: updated.prompts,
      activePromptVersion: updated.activePromptVersion,
      timeline: updated.timeline,
    });
  }

  reorderScenes(projectId: string, sourceIndex: number, destinationIndex: number) {
    const project = this.getProject(projectId);
    if (!project) return;

    const updated = domainService.reorderScenes(project, sourceIndex, destinationIndex);
    this.updateProject(projectId, { scenes: updated.scenes });
  }

  // Shot management
  addShot(projectId: string, sceneId: string, shotData: Partial<Shot>): Shot | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return undefined;

    const existingSceneShots = (project.shots || []).filter((s) => s.sceneId === sceneId);
    const shotNumber = existingSceneShots.length + 1;
    const shotId = `shot_${sceneId}_${Math.random().toString(36).substring(2, 8)}`;
    const durationSeconds = Math.max(1, Number(shotData.durationSeconds) || 5);

    const newShot: Shot = {
      id: shotId,
      projectId,
      sceneId,
      shotNumber,
      name: shotData.name || `${scene.narrativePurpose || 'Scene'} - Take ${shotNumber}`,
      durationSeconds,
      visualIntent: shotData.visualIntent || scene.visualDescription || '',
      framing: shotData.framing || 'medium',
      cameraAngle: shotData.cameraAngle || 'eye_level',
      cameraMovement: shotData.cameraMovement || 'static',
      dialogueSnippet: shotData.dialogueSnippet,
      voiceoverSnippet: shotData.voiceoverSnippet,
      status: shotData.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedShots = [...(project.shots || []), newShot];
    const updatedShotIds = [...(scene.shotIds || existingSceneShots.map((s) => s.id)), shotId];
    const totalDurationSeconds = calculateSceneDuration(scene, updatedShots);

    const updatedScenes = project.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            shotIds: updatedShotIds,
            totalDurationSeconds,
            estimatedDurationSeconds: totalDurationSeconds,
          }
        : s
    );

    this.updateProject(projectId, {
      scenes: updatedScenes,
      shots: updatedShots,
    });

    return newShot;
  }

  updateShot(projectId: string, shotId: string, updates: Partial<Shot>): Shot | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    const existingShot = (project.shots || []).find((s) => s.id === shotId);
    if (!existingShot) return undefined;

    const updatedShot: Shot = {
      ...existingShot,
      ...updates,
      durationSeconds: updates.durationSeconds !== undefined ? Math.max(1, Number(updates.durationSeconds) || 1) : existingShot.durationSeconds,
      updatedAt: new Date().toISOString(),
    };

    const updatedShots = (project.shots || []).map((s) => (s.id === shotId ? updatedShot : s));

    // Recalculate parent scene's totalDurationSeconds
    const sceneId = existingShot.sceneId;
    const scene = project.scenes.find((s) => s.id === sceneId);
    let updatedScenes = project.scenes;

    if (scene) {
      const totalDurationSeconds = calculateSceneDuration(scene, updatedShots);
      updatedScenes = project.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              totalDurationSeconds,
              estimatedDurationSeconds: totalDurationSeconds,
            }
          : s
      );
    }

    this.updateProject(projectId, {
      shots: updatedShots,
      scenes: updatedScenes,
    });

    return updatedShot;
  }

  deleteShot(projectId: string, shotId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const existingShot = (project.shots || []).find((s) => s.id === shotId);
    if (!existingShot) return false;

    const updated = domainService.cascadeDeleteShot(project, shotId);
    this.updateProject(projectId, {
      scenes: updated.scenes,
      shots: updated.shots,
      prompts: updated.prompts,
      activePromptVersion: updated.activePromptVersion,
      timeline: updated.timeline,
    });

    return true;
  }

  reorderShots(projectId: string, sceneId: string, sourceIndex: number, destinationIndex: number): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const updated = domainService.reorderShotsInScene(project, sceneId, sourceIndex, destinationIndex);
    this.updateProject(projectId, {
      shots: updated.shots,
      scenes: updated.scenes,
    });

    return true;
  }

  getShotsForScene(projectId: string, sceneId: string): Shot[] {
    const project = this.getProject(projectId);
    if (!project) return [];
    return getShotsForScene(project, sceneId);
  }

  // Shot Prompt Management
  getShotPrompts(projectId: string, shotId: string, sceneId?: string): PromptVersion[] {
    const project = this.getProject(projectId);
    if (!project) return [];
    return getPromptsForShot(project, shotId, sceneId);
  }

  getActiveShotPrompt(projectId: string, shotId: string, sceneId?: string): PromptVersion | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;
    return getActivePromptForShot(project, shotId, sceneId);
  }

  saveShotPrompt(
    projectId: string,
    shotId: string,
    promptData: Partial<PromptVersion>
  ): PromptVersion | undefined {
    const project = this.getProject(projectId);
    if (!project) return undefined;

    try {
      const { project: updated, version } = domainService.createShotPromptVersion(project, shotId, promptData);
      this.updateProject(projectId, {
        prompts: updated.prompts,
        activePromptVersion: updated.activePromptVersion,
        shots: updated.shots,
      });
      return version;
    } catch (err) {
      console.error('[StorageService] Failed to save shot prompt via domainService:', err);
      return undefined;
    }
  }

  setActiveShotPromptVersion(projectId: string, shotId: string, versionId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    const updated = domainService.activateShotPromptVersion(project, shotId, versionId);
    this.updateProject(projectId, {
      activePromptVersion: updated.activePromptVersion,
      shots: updated.shots,
    });
    return true;
  }

  // Assets & Jobs
  addAsset(projectId: string, asset: Omit<Asset, 'id' | 'createdAt'>): Asset {
    const project = this.getProject(projectId);
    const newAsset: Asset = {
      ...asset,
      id: 'asset_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    if (project) {
      this.updateProject(projectId, {
        assets: [newAsset, ...project.assets],
      });
    }
    return newAsset;
  }

  addGenerationJob(
    projectId: string,
    job: Omit<GenerationJob, 'id' | 'queuedAt'>,
    deduplicate: boolean = true
  ): GenerationJob {
    const project = this.getProject(projectId);
    if (!project) {
      return {
        ...job,
        id: 'job_' + Math.random().toString(36).substring(2, 9),
        queuedAt: new Date().toISOString(),
      };
    }

    const { project: updated, job: resultJob } = domainService.createDeduplicatedJob(
      project,
      job,
      deduplicate
    );

    this.updateProject(projectId, {
      generationJobs: updated.generationJobs,
    });

    return resultJob;
  }

  updateGenerationJob(projectId: string, jobId: string, updates: Partial<GenerationJob>) {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedJobs = project.generationJobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j));
    this.updateProject(projectId, { generationJobs: updatedJobs });
  }

  // Language Preference (English / Arabic RTL)
  getLanguagePreference(): 'en' | 'ar' {
    try {
      return (localStorage.getItem(LANGUAGE_PREF_KEY) as 'en' | 'ar') || 'en';
    } catch {
      return 'en';
    }
  }

  setLanguagePreference(lang: 'en' | 'ar') {
    try {
      localStorage.setItem(LANGUAGE_PREF_KEY, lang);
    } catch {}
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    this.notify();
  }

  // Export / Import
  exportProjectJSON(projectId: string): string {
    const project = this.getProject(projectId);
    return JSON.stringify(project || null, null, 2);
  }

  importProjectJSON(jsonString: string): Project | null {
    try {
      const data = JSON.parse(jsonString) as Project;
      if (!data.id || !data.title || !data.brief) {
        throw new Error('Invalid Obido Studio project schema');
      }
      data.id = 'proj_' + Math.random().toString(36).substring(2, 8) + '_imported';
      data.updatedAt = new Date().toISOString();
      this.projects.unshift(data);
      this.setActiveProjectId(data.id);
      this.persist();
      return data;
    } catch (e) {
      console.error('Failed to import project JSON:', e);
      return null;
    }
  }

  resetDemoData() {
    this.projects = SAMPLE_PROJECTS;
    this.persist();
  }
}

export const storage = new StorageService();
