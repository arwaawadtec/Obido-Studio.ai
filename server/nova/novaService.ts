/**
 * Obido Studio — Nova AI Production Assistant Service (Phase 3)
 * Server-authoritative production assistant powering stage guidance, pacing audit,
 * prompt polishing, and controlled consequential action suggestions.
 */

import { GoogleGenAI } from '@google/genai';

export type NovaActionType =
  | 'explain_stage'
  | 'suggest_next_steps'
  | 'check_pacing'
  | 'polish_prompt'
  | 'breakdown_advice'
  | 'chat';

export interface NovaSuggestedAction {
  id: string;
  label: string;
  description: string;
  actionType: string;
  requiresConfirmation: boolean;
  payload?: any;
}

export interface NovaPacingSummary {
  targetDurationSeconds: number;
  totalEstimatedShotDuration: number;
  variance: number;
  status: 'on_track' | 'under_target' | 'over_target';
  shotCount: number;
  averageShotDuration: number;
}

export interface NovaChatRequest {
  projectId: string;
  currentStage: string;
  message?: string;
  actionType?: NovaActionType;
  targetEntityId?: string;
  projectSummary?: {
    title?: string;
    purpose?: string;
    targetDurationSeconds?: number;
    visualStyle?: string;
    scenesCount?: number;
    shotsCount?: number;
    currentScriptLogline?: string;
    totalEstimatedShotDuration?: number;
  };
  project?: any;
}

export interface NovaChatResponse {
  success: boolean;
  reply: string;
  stage: string;
  stageInsight: string;
  suggestedActions: NovaSuggestedAction[];
  pacingSummary: NovaPacingSummary;
  source: 'gemini_model' | 'director_rules';
  timestamp: string;
}

export class NovaService {
  private aiClient: GoogleGenAI | null = null;
  private modelName: string;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || '');
    this.modelName = modelName || process.env.GEMINI_NOVA_MODEL || 'gemini-3.8-flash';
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
  }

  isAIAvailable(): boolean {
    return !!this.aiClient;
  }

  /**
   * Calculate precise pacing metrics based on project and shot data
   */
  calculatePacing(project: any, projectSummary?: any): NovaPacingSummary {
    const targetDuration =
      project?.brief?.targetDurationSeconds ||
      projectSummary?.targetDurationSeconds ||
      60;

    let totalDuration = 0;
    let shotCount = 0;

    if (Array.isArray(project?.shots) && project.shots.length > 0) {
      shotCount = project.shots.length;
      totalDuration = project.shots.reduce(
        (sum: number, sh: any) => sum + (Number(sh.durationSeconds) || 3),
        0
      );
    } else if (projectSummary?.shotsCount) {
      shotCount = projectSummary.shotsCount;
      totalDuration = projectSummary.totalEstimatedShotDuration || shotCount * 3.5;
    }

    const variance = totalDuration - targetDuration;
    let status: 'on_track' | 'under_target' | 'over_target' = 'on_track';
    if (variance < -4) {
      status = 'under_target';
    } else if (variance > 4) {
      status = 'over_target';
    }

    const avgDuration = shotCount > 0 ? parseFloat((totalDuration / shotCount).toFixed(1)) : 0;

    return {
      targetDurationSeconds: targetDuration,
      totalEstimatedShotDuration: Math.round(totalDuration * 10) / 10,
      variance: Math.round(variance * 10) / 10,
      status,
      shotCount,
      averageShotDuration: avgDuration,
    };
  }

  /**
   * Primary Nova conversation and stage advice generator
   */
  async processChat(req: NovaChatRequest): Promise<NovaChatResponse> {
    const stage = req.currentStage || 'brief';
    const actionType = req.actionType || 'chat';
    const project = req.project;
    const summary = req.projectSummary;
    const pacing = this.calculatePacing(project, summary);

    // Rule-based fallback engine ensures deterministic reliability even if offline or lacking API keys
    const fallbackResponse = this.generateDeterministicAdvice(stage, actionType, req.message, project, pacing);

    // If Gemini is available and key is configured, enrich with dynamic model intelligence
    if (this.aiClient && process.env.GEMINI_API_KEY) {
      try {
        const enrichedReply = await this.callGeminiModel(stage, actionType, req.message, project, pacing);
        if (enrichedReply) {
          return {
            success: true,
            reply: enrichedReply.reply || fallbackResponse.reply,
            stage,
            stageInsight: enrichedReply.stageInsight || fallbackResponse.stageInsight,
            suggestedActions: enrichedReply.suggestedActions.length > 0
              ? enrichedReply.suggestedActions
              : fallbackResponse.suggestedActions,
            pacingSummary: pacing,
            source: 'gemini_model',
            timestamp: new Date().toISOString(),
          };
        }
      } catch (err: any) {
        console.warn(`[NovaService] Gemini model call failed (${err.message}), falling back to deterministic director rules.`);
      }
    }

    return {
      success: true,
      reply: fallbackResponse.reply,
      stage,
      stageInsight: fallbackResponse.stageInsight,
      suggestedActions: fallbackResponse.suggestedActions,
      pacingSummary: pacing,
      source: 'director_rules',
      timestamp: new Date().toISOString(),
    };
  }

  private async callGeminiModel(
    stage: string,
    actionType: NovaActionType,
    userMessage: string | undefined,
    project: any,
    pacing: NovaPacingSummary
  ): Promise<{ reply: string; stageInsight: string; suggestedActions: NovaSuggestedAction[] } | null> {
    if (!this.aiClient) return null;

    const systemPrompt = `You are Nova, the senior AI film director and production supervisor of Obido Studio.
Your role is to guide video creators through the 10 production workflow stages:
1. Brief, 2. Script, 3. Storyboard (Scenes), 4. Shot List, 5. Storyboard Frames, 6. Prompts, 7. Assets, 8. Generation, 9. Editing, 10. Export.

CRITICAL RULES:
- Provide concise, practical, cinematic advice (2-4 sentences max per recommendation).
- Maintain an encouraging, sharp, professional tone.
- When suggesting project alterations or stage advancements, output actionable proposals that require user confirmation.
- Respond with valid JSON matching this schema:
{
  "reply": "string (the conversational advice to the creator)",
  "stageInsight": "string (1-sentence status of active stage)",
  "suggestedActions": [
    {
      "id": "action_id",
      "label": "Short button label",
      "description": "What this action will do",
      "actionType": "suggest_next_steps | polish_prompt | check_pacing | navigate_stage",
      "requiresConfirmation": true,
      "payload": {}
    }
  ]
}`;

    const projectContext = {
      title: project?.title || 'Untitled Project',
      purpose: project?.brief?.purpose || 'marketing',
      targetDurationSeconds: pacing.targetDurationSeconds,
      currentShotCount: pacing.shotCount,
      totalEstimatedShotDuration: pacing.totalEstimatedShotDuration,
      pacingVariance: pacing.variance,
      pacingStatus: pacing.status,
      currentStage: stage,
      actionRequested: actionType,
      userMessage: userMessage || 'Provide guidance for this stage',
    };

    const response = await this.aiClient.models.generateContent({
      model: this.modelName,
      contents: JSON.stringify(projectContext),
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      return {
        reply: parsed.reply || '',
        stageInsight: parsed.stageInsight || '',
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions.map((a: any, i: number) => ({
              id: a.id || `act_${Date.now()}_${i}`,
              label: a.label || 'Apply Suggestion',
              description: a.description || 'Applies Nova recommendation',
              actionType: a.actionType || 'suggest_next_steps',
              requiresConfirmation: a.requiresConfirmation ?? true,
              payload: a.payload || {},
            }))
          : [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Deterministic director rules guaranteeing high-quality advice across all 10 stages
   */
  private generateDeterministicAdvice(
    stage: string,
    actionType: NovaActionType,
    userMessage: string | undefined,
    project: any,
    pacing: NovaPacingSummary
  ): { reply: string; stageInsight: string; suggestedActions: NovaSuggestedAction[] } {
    const title = project?.title || 'your project';

    // 1. Pacing check specific intent
    if (actionType === 'check_pacing') {
      let advice = '';
      if (pacing.status === 'on_track') {
        advice = `Excellent pacing balance! Total shot duration (${pacing.totalEstimatedShotDuration}s) is aligned with your target (${pacing.targetDurationSeconds}s). Each shot averages ${pacing.averageShotDuration}s, delivering optimal cinematic rhythm.`;
      } else if (pacing.status === 'under_target') {
        advice = `Pacing is fast: Total coverage is currently ${pacing.totalEstimatedShotDuration}s, leaving a ${Math.abs(pacing.variance)}s gap from your ${pacing.targetDurationSeconds}s target. Consider adding 1-2 reaction or atmosphere cutaway shots.`;
      } else {
        advice = `Pacing is dense: Total coverage is ${pacing.totalEstimatedShotDuration}s, exceeding target by ${pacing.variance}s. Trim 0.5s from intermediate establishing shots to keep the viewer engaged.`;
      }

      return {
        reply: advice,
        stageInsight: `Pacing Status: ${pacing.status.toUpperCase()} (${pacing.totalEstimatedShotDuration}s / ${pacing.targetDurationSeconds}s target).`,
        suggestedActions: [
          {
            id: 'act_rebalance_durations',
            label: 'Normalize Shot Durations',
            description: 'Recalculates shot duration targets evenly across all scenes to match brief duration.',
            actionType: 'check_pacing',
            requiresConfirmation: true,
            payload: { targetDuration: pacing.targetDurationSeconds },
          },
        ],
      };
    }

    // 2. Polish prompt specific intent
    if (actionType === 'polish_prompt') {
      return {
        reply: `I analyzed your visual prompt criteria. For cinematic continuity, add explicit camera movement (e.g., slow dolly-in, 35mm anamorphic depth of field) and lighting notes (warm volumetric haze, subtle rim light) to ensure photorealistic renders.`,
        stageInsight: 'Prompt Engineering: Enhanced camera physics and light styling ready for application.',
        suggestedActions: [
          {
            id: 'act_apply_prompt_polish',
            label: 'Inject Cinematic Modifiers',
            description: 'Appends 35mm anamorphic, volumetric lighting, and subtle camera physics to shot prompts.',
            actionType: 'polish_prompt',
            requiresConfirmation: true,
            payload: {
              suffix: ', 35mm anamorphic lens, subtle handheld motion, warm rim lighting, volumetric depth, photorealistic 8k',
            },
          },
        ],
      };
    }

    // 3. Stage-specific guidance
    switch (stage) {
      case 'brief':
        return {
          reply: `Welcome to the Brief stage for "${title}". A compelling video requires a sharp hook and a singular key takeaway. Ensure your target duration (${pacing.targetDurationSeconds}s) and visual style match your target audience expectations.`,
          stageInsight: 'Define target audience, tone, and core message before writing the screenplay.',
          suggestedActions: [
            {
              id: 'act_proceed_to_script',
              label: 'Proceed to Script Stage',
              description: 'Locks current brief parameters and transitions workspace to Screenplay authoring.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'script' },
            },
          ],
        };

      case 'script':
        return {
          reply: `In the Script stage, aim for a 3-act progression: Hook in the first 3 seconds, core narrative in the body, and a punchy CTA in the finale. Spoken dialogue should target ~2.3 words per second for clarity.`,
          stageInsight: 'Screenplay drafting: ensure dialogue and voiceover timing align with shot pacing.',
          suggestedActions: [
            {
              id: 'act_proceed_to_scenes',
              label: 'Proceed to Scenes Stage',
              description: 'Transitions to Narrative Scene beat organization.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'scenes' },
            },
            {
              id: 'act_audit_script_pacing',
              label: 'Audit Screenplay Pacing',
              description: 'Compares word count with speaking pace and target duration.',
              actionType: 'check_pacing',
              requiresConfirmation: false,
            },
          ],
        };

      case 'scenes':
        return {
          reply: `In the Scenes stage, establish your story rhythm. Balance exposition, dramatic peaks, and concluding payoffs across scene beats. Ensure cumulative scene durations align with your ${pacing.targetDurationSeconds}s target.`,
          stageInsight: `Scene Architecture: ${project?.scenes?.length || 0} scenes planned. Pacing status: ${pacing.status}.`,
          suggestedActions: [
            {
              id: 'act_proceed_to_shots',
              label: 'Proceed to Shot List',
              description: 'Breaks scenes into constituent camera angles and shots.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'shots' },
            },
            {
              id: 'act_audit_scene_pacing',
              label: 'Audit Scene Durations',
              description: 'Calculates total scene durations against project target duration.',
              actionType: 'check_pacing',
              requiresConfirmation: false,
            },
          ],
        };

      case 'shots':
        return {
          reply: `In the Shot List stage, build dynamic visual pacing. Alternate between establishing Wides, character Close-ups, and motion tracking to avoid static framing. Your project currently has ${pacing.shotCount} shots averaging ${pacing.averageShotDuration}s each.`,
          stageInsight: `Cinematography: ${pacing.shotCount} shots defined with custom camera framing and motion.`,
          suggestedActions: [
            {
              id: 'act_proceed_to_storyboard',
              label: 'Advance to Storyboard',
              description: 'Transitions shots to visual panel representations.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'storyboard' },
            },
            {
              id: 'act_check_coverage',
              label: 'Run Shot Coverage Check',
              description: 'Verifies shot framing diversity (Wide, Medium, Close-up) across all scenes.',
              actionType: 'breakdown_advice',
              requiresConfirmation: false,
            },
          ],
        };

      case 'storyboard':
        return {
          reply: `Your storyboard currently contains ${pacing.shotCount} visual panels. Review character appearance continuity, lighting palettes, and aspect ratio boundaries before generating technical prompts.`,
          stageInsight: `Visual Continuity: ${pacing.shotCount} panels organized with aspect ratio canvas previews.`,
          suggestedActions: [
            {
              id: 'act_proceed_to_prompts',
              label: 'Advance to Prompts Stage',
              description: 'Transfers storyboard shots into detailed generative prompt versions.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'prompts' },
            },
          ],
        };

      case 'prompts':
        return {
          reply: `In the Prompts stage, precision is key. Define the subject, environment, lighting, and camera movement in strict order. Keep prompt versions versioned so you can compare multiple generative interpretations.`,
          stageInsight: 'Prompt engineering: optimize generative tokens and camera movement cues.',
          suggestedActions: [
            {
              id: 'act_polish_all_prompts',
              label: 'Refine Active Shot Prompts',
              description: 'Enhances descriptive sensory keywords and camera directives.',
              actionType: 'polish_prompt',
              requiresConfirmation: true,
            },
            {
              id: 'act_proceed_to_generation',
              label: 'Open Video Generation',
              description: 'Transfers validated prompts to the multi-provider render queue.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'generation' },
            },
          ],
        };

      case 'assets':
        return {
          reply: `Organize your visual and audio assets here. Verify that asset resolutions match your project aspect ratio (${project?.brief?.aspectRatio || '16:9'}) and that each shot has an assigned primary asset.`,
          stageInsight: 'Media management: inspect resolution, framerates, and shot assignments.',
          suggestedActions: [
            {
              id: 'act_proceed_to_editing',
              label: 'Open Timeline Editor',
              description: 'Loads all approved shot assets into multi-track sequencing.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'editing' },
            },
          ],
        };

      case 'generation':
        return {
          reply: `Monitor your video generation jobs. If any render fails or is queued, you can inspect provider parameters or use the local demo provider to test immediate timeline integration.`,
          stageInsight: 'Video synthesis: monitor job status, seed values, and provider queues.',
          suggestedActions: [
            {
              id: 'act_proceed_to_assets',
              label: 'Review Generated Assets',
              description: 'Moves to Assets stage to audit completed renders.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'assets' },
            },
          ],
        };

      case 'editing':
        return {
          reply: `You are in the Timeline Editor. Arrange clips sequentially, trim head and tail handles, and balance audio levels between voiceover and background atmosphere.`,
          stageInsight: 'Timeline editing: arrange clips, refine cuts, and verify audio sync.',
          suggestedActions: [
            {
              id: 'act_check_final_pacing',
              label: 'Verify Timeline Duration',
              description: 'Checks that sequenced clip durations match project duration.',
              actionType: 'check_pacing',
              requiresConfirmation: false,
            },
            {
              id: 'act_proceed_to_export',
              label: 'Proceed to Export',
              description: 'Prepares final render composition for download.',
              actionType: 'navigate_stage',
              requiresConfirmation: false,
              payload: { targetStage: 'export' },
            },
          ],
        };

      case 'export':
        return {
          reply: `Final stage! Review your video render specs: ${project?.brief?.aspectRatio || '16:9'} aspect ratio, ${pacing.targetDurationSeconds}s target length, and standard H.264/MP4 delivery. Click 'Download Project' in the dashboard for complete offline backups.`,
          stageInsight: 'Final export: render high-bitrate video and export backup archives.',
          suggestedActions: [
            {
              id: 'act_download_backup',
              label: 'Download Project Backup',
              description: 'Exports complete project state as a portable JSON file.',
              actionType: 'export_backup',
              requiresConfirmation: false,
            },
          ],
        };

      default:
        return {
          reply: `I am Nova, your AI video production director. How can I assist you with your current project phase?`,
          stageInsight: `Active stage: ${stage}. Ready to assist with pacing, prompts, or sequencing.`,
          suggestedActions: [
            {
              id: 'act_explain_current_stage',
              label: `Explain ${stage} Stage`,
              description: 'Details best practices and key deliverables for this stage.',
              actionType: 'explain_stage',
              requiresConfirmation: false,
            },
          ],
        };
    }
  }
}

export const novaService = new NovaService();
