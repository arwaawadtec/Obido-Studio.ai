/**
 * Obido Studio — Server-side AI Provider Abstraction Contracts
 * Defines provider-neutral interfaces, request/response models, and error structures.
 */

export type AIErrorCode =
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'UNAUTHENTICATED'
  | 'TIMEOUT'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export interface NormalizedAIError {
  message: string;
  code: AIErrorCode;
  retryable: boolean;
  statusCode: number;
  provider: string;
  details?: string;
}

export interface ScriptGenerationParams {
  title?: string;
  purpose?: string;
  targetAudience?: string;
  language?: string;
  aspectRatio?: string;
  targetDurationSeconds?: number;
  visualStyle?: string;
  rawIdea?: string;
  toneOfVoice?: string;
  callToAction?: string;
}

export interface ScriptGenerationResult {
  title: string;
  logline: string;
  hook: string;
  fullText: string;
  estimatedSpeakingWords: number;
  estimatedDurationSeconds: number;
}

export interface StoryboardGenerationParams {
  scriptText?: string;
  brief?: {
    title?: string;
    visualStyle?: string;
    targetDurationSeconds?: number;
    aspectRatio?: string;
    rawIdea?: string;
  };
}

export interface StoryboardScene {
  sceneNumber: number;
  narrativePurpose: string;
  estimatedDurationSeconds: number;
  visualDescription: string;
  narrationDialogue: string;
  audioCues: string;
  cameraFraming: string;
}

export interface PromptEnhanceParams {
  visualDescription: string;
  cameraFraming?: string;
  visualStyle?: string;
  targetProvider?: string;
}

export interface EnhancedPromptResult {
  visualPrompt: string;
  motionInstructions: string;
  cameraDirection: string;
  negativePrompt: string;
  audioInstructions: string;
}

export interface BriefRefineParams {
  rawIdea: string;
  purpose?: string;
  language?: string;
}

export interface RefinedBriefResult {
  refinedTitle: string;
  targetAudience: string;
  keyTakeaway: string;
  toneOfVoice: string;
  suggestedDurationSeconds: number;
  suggestedVisualStyle: string;
  callToAction: string;
}

export interface ProviderModelConfig {
  scriptModel?: string;
  storyboardModel?: string;
  promptEnhanceModel?: string;
  briefRefineModel?: string;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  generateScript(params: ScriptGenerationParams, modelOverride?: string): Promise<ScriptGenerationResult>;
  generateStoryboard(params: StoryboardGenerationParams, modelOverride?: string): Promise<StoryboardScene[]>;
  enhancePrompt(params: PromptEnhanceParams, modelOverride?: string): Promise<EnhancedPromptResult>;
  refineBrief(params: BriefRefineParams, modelOverride?: string): Promise<RefinedBriefResult>;
}
