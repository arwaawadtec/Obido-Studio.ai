import { Project, VideoTemplate, WorkflowStage, Scene, PromptVersion, Asset, GenerationJob, TimelineClip } from '../types';
import { firestoreService } from './firestoreService';

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
        this.projects = SAMPLE_PROJECTS;
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.projects = JSON.parse(stored);
      } else {
        this.projects = SAMPLE_PROJECTS;
        this.persist();
      }
    } catch {
      this.projects = SAMPLE_PROJECTS;
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

  getProjects(userId?: string): Project[] {
    if (!userId) {
      // Unauthenticated / guest preview: return default projects
      return [...this.projects];
    }
    // Return ONLY projects belonging to this authenticated user.
    // Do NOT seed production accounts with demo projects.
    return this.projects.filter((p) => p.userId === userId);
  }

  async queryProjects(userId?: string, shouldSimulateError: boolean = false): Promise<Project[]> {
    if (shouldSimulateError) {
      throw new Error('Unable to retrieve projects from database service. Please check your connection.');
    }

    // Cloud persistence path: when authenticated with a real cloud UID, query Firestore
    if (firestoreService.isAvailable() && userId && userId !== 'user_default' && !userId.startsWith('user_demo_')) {
      try {
        const cloudProjects = await firestoreService.getProjects(userId);
        // Update local memory cache with latest cloud documents
        const otherProjects = this.projects.filter((p) => p.userId !== userId);
        this.projects = [...otherProjects, ...cloudProjects];
        this.persist();
        return cloudProjects;
      } catch (err) {
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

  getActiveProjectId(userId?: string): string | null {
    try {
      const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (stored) {
        const proj = this.projects.find((p) => p.id === stored);
        if (proj && (!userId || proj.userId === userId)) {
          return stored;
        }
      }
      const userProjects = this.getProjects(userId);
      return userProjects[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  setActiveProjectId(id: string) {
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
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
      currentStage: 'brief',
      completedStages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: !isCloudUser,
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
      firestoreService.saveProject(newProject, finalOwnerId).catch((err) => {
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

    this.projects[idx] = {
      ...this.projects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updated = this.projects[idx];
    this.persist();

    if (firestoreService.isAvailable() && updated.userId !== 'user_default' && !updated.userId.startsWith('user_demo_')) {
      firestoreService.saveProject(updated, updated.userId).catch((err) => {
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
    const newScene: Scene = {
      ...scene,
      id: 'sc_' + Math.random().toString(36).substring(2, 9),
      sceneNumber,
    };

    const updatedScenes = [...project.scenes, newScene];
    this.updateProject(projectId, { scenes: updatedScenes });
    return newScene;
  }

  updateScene(projectId: string, sceneId: string, updates: Partial<Scene>) {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedScenes = project.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...updates } : sc));
    this.updateProject(projectId, { scenes: updatedScenes });
  }

  deleteScene(projectId: string, sceneId: string) {
    const project = this.getProject(projectId);
    if (!project) return;

    const filtered = project.scenes.filter((sc) => sc.id !== sceneId);
    // Re-index scene numbers cleanly
    const reindexed = filtered.map((sc, i) => ({ ...sc, sceneNumber: i + 1 }));
    this.updateProject(projectId, { scenes: reindexed });
  }

  reorderScenes(projectId: string, sourceIndex: number, destinationIndex: number) {
    const project = this.getProject(projectId);
    if (!project) return;

    const scenes = [...project.scenes];
    const [moved] = scenes.splice(sourceIndex, 1);
    scenes.splice(destinationIndex, 0, moved);

    const reindexed = scenes.map((sc, i) => ({ ...sc, sceneNumber: i + 1 }));
    this.updateProject(projectId, { scenes: reindexed });
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

  addGenerationJob(projectId: string, job: Omit<GenerationJob, 'id' | 'queuedAt'>): GenerationJob {
    const project = this.getProject(projectId);
    const newJob: GenerationJob = {
      ...job,
      id: 'job_' + Math.random().toString(36).substring(2, 9),
      queuedAt: new Date().toISOString(),
    };

    if (project) {
      this.updateProject(projectId, {
        generationJobs: [newJob, ...project.generationJobs],
      });
    }
    return newJob;
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
