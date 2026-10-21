/**
 * Obido Studio — Gemini Provider Adapter
 * Implements AIProviderAdapter using @google/genai SDK with resilience and schema guarantees.
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  AIProviderAdapter,
  ScriptGenerationParams,
  ScriptGenerationResult,
  StoryboardGenerationParams,
  StoryboardScene,
  PromptEnhanceParams,
  EnhancedPromptResult,
  BriefRefineParams,
  RefinedBriefResult,
  ProviderModelConfig,
} from './types';
import { executeWithRetry, normalizeAIError } from '../resilience/retry';

export class GeminiProviderAdapter implements AIProviderAdapter {
  readonly id = 'gemini';
  readonly name = 'Google Gemini (Native GenAI SDK)';

  private aiClient: GoogleGenAI | null = null;
  private defaultModels: Required<ProviderModelConfig>;

  constructor(apiKey?: string, models?: ProviderModelConfig) {
    const key = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || '');
    if (key) {
      this.aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }

    this.defaultModels = {
      scriptModel: models?.scriptModel || process.env.GEMINI_SCRIPT_MODEL || 'gemini-3.8-flash',
      storyboardModel: models?.storyboardModel || process.env.GEMINI_STORYBOARD_MODEL || 'gemini-3.8-flash',
      promptEnhanceModel: models?.promptEnhanceModel || process.env.GEMINI_PROMPT_MODEL || 'gemini-3.8-flash',
      briefRefineModel: models?.briefRefineModel || process.env.GEMINI_BRIEF_MODEL || 'gemini-3.8-flash',
    };
  }

  isAvailable(): boolean {
    return !!this.aiClient;
  }

  private ensureClient(): GoogleGenAI {
    if (!this.aiClient) {
      const err: any = new Error(
        'Gemini API is not configured on this server. Check your environment settings or use manual editing mode.'
      );
      err.status = 401;
      throw normalizeAIError(err, this.id);
    }
    return this.aiClient;
  }

  async generateScript(
    params: ScriptGenerationParams,
    modelOverride?: string
  ): Promise<ScriptGenerationResult> {
    const ai = this.ensureClient();
    const model = modelOverride || this.defaultModels.scriptModel;

    const prompt = `Create a professional video production script for the following project:
Project Title: ${params.title || 'Untitled'}
Purpose: ${params.purpose || 'Explainer'}
Target Audience: ${params.targetAudience || 'General audience'}
Language: ${params.language || 'English'}
Aspect Ratio: ${params.aspectRatio || '16:9'}
Target Duration: ${params.targetDurationSeconds || 60} seconds (~130-150 spoken words per minute)
Visual Style: ${params.visualStyle || 'Cinematic Photorealistic'}
Tone of Voice: ${params.toneOfVoice || 'Engaging and professional'}
Core Idea / Pitch: ${params.rawIdea || 'Showcase product capabilities'}
Call to Action: ${params.callToAction || 'Visit our website'}

Respond in JSON format with:
- title: string (Refined punchy title)
- logline: string (1-sentence summary of the video narrative)
- hook: string (First 3-5 seconds attention grabber)
- fullText: string (Formatted production screenplay with [SCENE X - mm:ss-mm:ss] headers, Voiceover text, and Visual cues)
- estimatedSpeakingWords: number
- estimatedDurationSeconds: number
`;

    // Deduplication key based on core brief inputs
    const deduplicationKey = `script_${(params.title || '')}_${(params.rawIdea || '').slice(0, 50)}_${params.targetDurationSeconds}`;

    return executeWithRetry(
      async () => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You are an elite Hollywood and commercial creative director. Write crisp, high-retention video screenplays with zero fluff, clear narrative progression, and natural spoken rhythm.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                logline: { type: Type.STRING },
                hook: { type: Type.STRING },
                fullText: { type: Type.STRING },
                estimatedSpeakingWords: { type: Type.INTEGER },
                estimatedDurationSeconds: { type: Type.INTEGER },
              },
              required: [
                'title',
                'logline',
                'hook',
                'fullText',
                'estimatedSpeakingWords',
                'estimatedDurationSeconds',
              ],
            },
          },
        });

        const text = response.text;
        if (!text) {
          throw new Error('Empty response from model');
        }

        const data = JSON.parse(text);
        if (!data.title || !data.fullText) {
          throw new Error('Invalid output structure: missing title or fullText in script response');
        }

        return {
          title: String(data.title),
          logline: String(data.logline || ''),
          hook: String(data.hook || ''),
          fullText: String(data.fullText),
          estimatedSpeakingWords: Number(data.estimatedSpeakingWords) || 0,
          estimatedDurationSeconds: Number(data.estimatedDurationSeconds) || params.targetDurationSeconds || 60,
        };
      },
      {
        providerName: this.id,
        deduplicationKey,
      }
    );
  }

  async generateStoryboard(
    params: StoryboardGenerationParams,
    modelOverride?: string
  ): Promise<StoryboardScene[]> {
    const ai = this.ensureClient();
    const model = modelOverride || this.defaultModels.storyboardModel;

    const prompt = `Based on the following video script and brief, break it down into an ordered storyboard of consecutive scenes:

Project Brief:
- Title: ${params.brief?.title || 'Untitled'}
- Visual Style: ${params.brief?.visualStyle || 'Cinematic'}
- Target Duration: ${params.brief?.targetDurationSeconds || 60} seconds
- Aspect Ratio: ${params.brief?.aspectRatio || '16:9'}

Full Script Text:
${params.scriptText || params.brief?.rawIdea || 'Intro to solution'}

Break this down into 3 to 7 logical scenes that cover the entire duration. Ensure sum of scene estimatedDurationSeconds roughly equals ${params.brief?.targetDurationSeconds || 60} seconds.

Output an array of scene objects.`;

    const deduplicationKey = `sb_${(params.scriptText || '').slice(0, 60)}_${params.brief?.targetDurationSeconds}`;

    return executeWithRetry(
      async () => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You are an experienced storyboard artist and cinematographer. Create vivid, specific visual scene descriptions, clear camera framing (Wide establishing, Medium shot, Close-up, Over-the-shoulder, POV / Macro, Dynamic tracking), and exact audio cues.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  narrativePurpose: { type: Type.STRING },
                  estimatedDurationSeconds: { type: Type.INTEGER },
                  visualDescription: { type: Type.STRING },
                  narrationDialogue: { type: Type.STRING },
                  audioCues: { type: Type.STRING },
                  cameraFraming: {
                    type: Type.STRING,
                    description: 'Camera framing style',
                  },
                },
                required: [
                  'sceneNumber',
                  'narrativePurpose',
                  'estimatedDurationSeconds',
                  'visualDescription',
                  'narrationDialogue',
                  'audioCues',
                  'cameraFraming',
                ],
              },
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from model');

        const scenes = JSON.parse(text);
        if (!Array.isArray(scenes)) {
          throw new Error('Invalid output structure: storyboard response must be an array of scenes');
        }

        return scenes.map((s: any, idx: number) => ({
          sceneNumber: typeof s.sceneNumber === 'number' ? s.sceneNumber : idx + 1,
          narrativePurpose: String(s.narrativePurpose || ''),
          estimatedDurationSeconds: Number(s.estimatedDurationSeconds) || 5,
          visualDescription: String(s.visualDescription || ''),
          narrationDialogue: String(s.narrationDialogue || ''),
          audioCues: String(s.audioCues || ''),
          cameraFraming: String(s.cameraFraming || 'Medium shot'),
        }));
      },
      {
        providerName: this.id,
        deduplicationKey,
      }
    );
  }

  async enhancePrompt(
    params: PromptEnhanceParams,
    modelOverride?: string
  ): Promise<EnhancedPromptResult> {
    const ai = this.ensureClient();
    const model = modelOverride || this.defaultModels.promptEnhanceModel;

    const prompt = `Compose a set of production prompts for video generation models (Veo, Omni, Runway Gen-3, Luma Dream Machine) for this scene:

Visual Description: ${params.visualDescription}
Camera Framing: ${params.cameraFraming || 'Medium shot'}
Visual Style: ${params.visualStyle || 'Cinematic Photorealistic'}
Target Provider: ${params.targetProvider || 'Gemini Omni / Veo'}

Generate:
1. visualPrompt: Rich descriptive prompt detailing environment, lighting, texture, lens choice, color temperature. Avoid buzzwords like "photorealistic", use photographic terms instead (e.g. "35mm anamorphic, f/2.0 aperture, volumetric rim lighting").
2. motionInstructions: Camera motion and subject motion vectors (e.g. "slow cinematic dolly backward, subtle breeze rustling cloth").
3. cameraDirection: Lens focal length, camera height, and perspective.
4. negativePrompt: Common artifacts to avoid (morphing, low-res, text watermarks, floating limbs, flickering).
5. audioInstructions: Ambient room tone and sound design notes.`;

    const deduplicationKey = `prompt_${(params.visualDescription || '').slice(0, 50)}_${params.cameraFraming}`;

    return executeWithRetry(
      async () => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                visualPrompt: { type: Type.STRING },
                motionInstructions: { type: Type.STRING },
                cameraDirection: { type: Type.STRING },
                negativePrompt: { type: Type.STRING },
                audioInstructions: { type: Type.STRING },
              },
              required: [
                'visualPrompt',
                'motionInstructions',
                'cameraDirection',
                'negativePrompt',
                'audioInstructions',
              ],
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from model');

        const details = JSON.parse(text);
        return {
          visualPrompt: String(details.visualPrompt || ''),
          motionInstructions: String(details.motionInstructions || ''),
          cameraDirection: String(details.cameraDirection || ''),
          negativePrompt: String(details.negativePrompt || ''),
          audioInstructions: String(details.audioInstructions || ''),
        };
      },
      {
        providerName: this.id,
        deduplicationKey,
      }
    );
  }

  async refineBrief(
    params: BriefRefineParams,
    modelOverride?: string
  ): Promise<RefinedBriefResult> {
    const ai = this.ensureClient();
    const model = modelOverride || this.defaultModels.briefRefineModel;

    const prompt = `Refine this initial video idea into a structured production brief:
Initial Idea: ${params.rawIdea}
Purpose: ${params.purpose || 'Explainer'}
Language: ${params.language || 'English'}

Provide:
- refinedTitle: Punchy, memorable title
- targetAudience: Specific, actionable audience profile
- keyTakeaway: The 1 single message viewers remember
- toneOfVoice: Descriptive style guidance (e.g. "Crisp, authoritative, warm")
- suggestedDurationSeconds: 15, 30, 60, or 90
- suggestedVisualStyle: One of: cinematic_photorealistic, minimal_3d, editorial_film, high_tech_holographic, anime_vector, documentary_realism
- callToAction: Clear next step for the viewer`;

    const deduplicationKey = `brief_${(params.rawIdea || '').slice(0, 60)}_${params.purpose}`;

    return executeWithRetry(
      async () => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                refinedTitle: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                keyTakeaway: { type: Type.STRING },
                toneOfVoice: { type: Type.STRING },
                suggestedDurationSeconds: { type: Type.INTEGER },
                suggestedVisualStyle: { type: Type.STRING },
                callToAction: { type: Type.STRING },
              },
              required: [
                'refinedTitle',
                'targetAudience',
                'keyTakeaway',
                'toneOfVoice',
                'suggestedDurationSeconds',
                'suggestedVisualStyle',
                'callToAction',
              ],
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from model');

        const brief = JSON.parse(text);
        return {
          refinedTitle: String(brief.refinedTitle || ''),
          targetAudience: String(brief.targetAudience || ''),
          keyTakeaway: String(brief.keyTakeaway || ''),
          toneOfVoice: String(brief.toneOfVoice || ''),
          suggestedDurationSeconds: Number(brief.suggestedDurationSeconds) || 60,
          suggestedVisualStyle: String(brief.suggestedVisualStyle || 'cinematic_photorealistic'),
          callToAction: String(brief.callToAction || ''),
        };
      },
      {
        providerName: this.id,
        deduplicationKey,
      }
    );
  }
}
