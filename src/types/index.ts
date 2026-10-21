export type AspectRatio = '16:9' | '9:16' | '1:1';

export type VideoPurpose =
  | 'marketing'
  | 'explainer'
  | 'social_ad'
  | 'tutorial'
  | 'documentary'
  | 'product_launch'
  | 'brand_story';

export type VisualStyle =
  | 'cinematic_photorealistic'
  | 'minimal_3d'
  | 'editorial_film'
  | 'high_tech_holographic'
  | 'anime_vector'
  | 'documentary_realism';

export type WorkflowStage =
  | 'brief'
  | 'script'
  | 'storyboard'
  | 'prompts'
  | 'assets'
  | 'generation'
  | 'editing'
  | 'export';

export type JobStatus = 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'creator' | 'producer' | 'admin';
  avatar?: string;
  tier: 'free' | 'pro' | 'studio';
}

export interface ProjectBrief {
  title: string;
  purpose: VideoPurpose;
  targetAudience: string;
  language: string;
  aspectRatio: AspectRatio;
  targetDurationSeconds: number;
  visualStyle: VisualStyle;
  rawIdea: string;
  keyTakeaway: string;
  toneOfVoice: string;
  callToAction: string;
  brandColors?: string[];
  referenceLinks?: string[];
  lastUpdated: string;
}

export interface ScriptVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  title: string;
  logline: string;
  hook: string;
  fullText: string;
  estimatedSpeakingWords: number;
  estimatedDurationSeconds: number;
  isCurrent: boolean;
  notes?: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  narrativePurpose: string;
  estimatedDurationSeconds: number;
  visualDescription: string;
  narrationDialogue: string;
  audioCues: string;
  cameraFraming: 'Wide establishing' | 'Medium shot' | 'Close-up' | 'Over-the-shoulder' | 'POV / Macro' | 'Dynamic tracking';
  referenceImagePlaceholder?: string;
  associatedAssetId?: string;
  status: 'draft' | 'ready_for_prompt' | 'prompted' | 'generated' | 'approved';
}

export interface PromptVersion {
  id: string;
  sceneId: string;
  versionNumber: number;
  createdAt: string;
  visualPrompt: string;
  motionInstructions: string;
  cameraDirection: string;
  negativePrompt: string;
  audioInstructions: string;
  targetProvider: string;
  targetModel: string;
  isFavorite?: boolean;
}

export interface Asset {
  id: string;
  projectId: string;
  sceneId?: string;
  name: string;
  type: 'video' | 'image' | 'audio_voiceover' | 'audio_music' | 'audio_sfx';
  url: string;
  thumbnailUrl?: string;
  filesizeBytes: number;
  durationSeconds?: number;
  dimensions?: { width: number; height: number };
  aspectRatio?: AspectRatio;
  format: string;
  provider: string;
  createdAt: string;
  isSimulatedDemo: boolean;
  metadata?: Record<string, any>;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  sceneId?: string;
  taskType: 'text_to_video' | 'image_to_video' | 'text_to_speech' | 'music_composition' | 'scene_extension';
  provider: 'gemini_omni' | 'runway_gen3' | 'luma_dream' | 'local_demo';
  modelName: string;
  prompt: string;
  parameters: {
    aspectRatio: AspectRatio;
    resolution: '720p' | '1080p' | '4k';
    durationSeconds: number;
    motionStrength: number;
    seed?: number;
    negativePrompt?: string;
  };
  status: JobStatus;
  progressPercent: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  resultAssetId?: string;
  isSimulated: boolean;
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  assetId?: string;
  track: 'video' | 'voiceover' | 'music' | 'subtitles';
  startTimeSeconds: number;
  durationSeconds: number;
  sourceInSeconds: number;
  volume: number;
  title: string;
  transitionIn?: 'cut' | 'crossfade' | 'dip_to_black' | 'wipe_right';
  subtitleText?: string;
}

export interface Timeline {
  id: string;
  projectId: string;
  totalDurationSeconds: number;
  fps: number;
  aspectRatio: AspectRatio;
  clips: TimelineClip[];
  lastModified: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  aspectRatio: AspectRatio;
  resolution: '720p' | '1080p' | '4k';
  frameRate: 24 | 30 | 60;
  format: 'mp4' | 'webm' | 'gif';
  burnSubtitles: boolean;
  audioBitrateKbps: 128 | 192 | 320;
  status: JobStatus;
  progressPercent: number;
  outputUrl?: string;
  outputSizeBytes?: number;
  createdAt: string;
  completedAt?: string;
  isConfigured: boolean;
  statusMessage?: string;
}

export interface ProviderConfiguration {
  id: string;
  name: string;
  category: 'text_script' | 'video_generation' | 'text_to_speech' | 'music_sfx';
  providerKey: 'gemini' | 'runway' | 'luma' | 'elevenlabs' | 'local_demo';
  status: 'connected' | 'unconfigured' | 'demo_mode';
  supportedModels: string[];
  activeModel: string;
  requiresPaidKey: boolean;
  description: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  brief: ProjectBrief;
  scripts: ScriptVersion[];
  currentScriptId?: string;
  scenes: Scene[];
  prompts: Record<string, PromptVersion[]>; // sceneId -> versions
  activePromptVersion: Record<string, string>; // sceneId -> promptId
  assets: Asset[];
  generationJobs: GenerationJob[];
  timeline: Timeline;
  exportJobs: ExportJob[];
  createdAt: string;
  updatedAt: string;
  isLocalOnly: boolean;
}

export interface VideoTemplate {
  id: string;
  title: string;
  category: VideoPurpose;
  description: string;
  targetDurationSeconds: number;
  aspectRatio: AspectRatio;
  visualStyle: VisualStyle;
  scenesCount: number;
  defaultIdea: string;
  tags: string[];
}
