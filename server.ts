import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK per guidelines
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health & Capabilities Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Obido Studio Server',
    hasApiKey: !!apiKey,
    models: {
      textAndScript: 'gemini-3.8-flash',
      tts: 'gemini-3.8-flash-lite-tts',
      videoGenerationTarget: 'gemini-omni-1.1-flash',
    },
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// AI Script Generation Endpoint
app.post('/api/ai/script', async (req, res) => {
  try {
    const { title, purpose, targetAudience, language, aspectRatio, targetDurationSeconds, visualStyle, rawIdea, toneOfVoice, callToAction } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on this server. Check your environment settings or use manual editing mode.',
      });
    }

    const prompt = `Create a professional video production script for the following project:
Project Title: ${title || 'Untitled'}
Purpose: ${purpose || 'Explainer'}
Target Audience: ${targetAudience || 'General audience'}
Language: ${language || 'English'}
Aspect Ratio: ${aspectRatio || '16:9'}
Target Duration: ${targetDurationSeconds || 60} seconds (~130-150 spoken words per minute)
Visual Style: ${visualStyle || 'Cinematic Photorealistic'}
Tone of Voice: ${toneOfVoice || 'Engaging and professional'}
Core Idea / Pitch: ${rawIdea || 'Showcase product capabilities'}
Call to Action: ${callToAction || 'Visit our website'}

Respond in JSON format with:
- title: string (Refined punchy title)
- logline: string (1-sentence summary of the video narrative)
- hook: string (First 3-5 seconds attention grabber)
- fullText: string (Formatted production screenplay with [SCENE X - mm:ss-mm:ss] headers, Voiceover text, and Visual cues)
- estimatedSpeakingWords: number
- estimatedDurationSeconds: number
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite Hollywood and commercial creative director. Write crisp, high-retention video screenplays with zero fluff, clear narrative progression, and natural spoken rhythm.',
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
          required: ['title', 'logline', 'hook', 'fullText', 'estimatedSpeakingWords', 'estimatedDurationSeconds'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from model');
    }

    const scriptData = JSON.parse(text);
    res.json({ success: true, script: scriptData });
  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate script with AI',
    });
  }
});

// AI Storyboard Generation Endpoint
app.post('/api/ai/storyboard', async (req, res) => {
  try {
    const { scriptText, brief } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on this server.',
      });
    }

    const prompt = `Based on the following video script and brief, break it down into an ordered storyboard of consecutive scenes:

Project Brief:
- Title: ${brief?.title || 'Untitled'}
- Visual Style: ${brief?.visualStyle || 'Cinematic'}
- Target Duration: ${brief?.targetDurationSeconds || 60} seconds
- Aspect Ratio: ${brief?.aspectRatio || '16:9'}

Full Script Text:
${scriptText || brief?.rawIdea || 'Intro to solution'}

Break this down into 3 to 7 logical scenes that cover the entire duration. Ensure sum of scene estimatedDurationSeconds roughly equals ${brief?.targetDurationSeconds || 60} seconds.

Output an array of scene objects.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an experienced storyboard artist and cinematographer. Create vivid, specific visual scene descriptions, clear camera framing (Wide establishing, Medium shot, Close-up, Over-the-shoulder, POV / Macro, Dynamic tracking), and exact audio cues.',
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
    res.json({ success: true, scenes });
  } catch (error: any) {
    console.error('Error generating storyboard:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate storyboard scenes',
    });
  }
});

// AI Video Prompt Refiner Endpoint
app.post('/api/ai/prompt-enhance', async (req, res) => {
  try {
    const { visualDescription, cameraFraming, visualStyle, targetProvider } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on this server.',
      });
    }

    const prompt = `Compose a set of production prompts for video generation models (Veo, Omni, Runway Gen-3, Luma Dream Machine) for this scene:

Visual Description: ${visualDescription}
Camera Framing: ${cameraFraming || 'Medium shot'}
Visual Style: ${visualStyle || 'Cinematic Photorealistic'}
Target Provider: ${targetProvider || 'Gemini Omni / Veo'}

Generate:
1. visualPrompt: Rich descriptive prompt detailing environment, lighting, texture, lens choice, color temperature. Avoid buzzwords like "photorealistic", use photographic terms instead (e.g. "35mm anamorphic, f/2.0 aperture, volumetric rim lighting").
2. motionInstructions: Camera motion and subject motion vectors (e.g. "slow cinematic dolly backward, subtle breeze rustling cloth").
3. cameraDirection: Lens focal length, camera height, and perspective.
4. negativePrompt: Common artifacts to avoid (morphing, low-res, text watermarks, floating limbs, flickering).
5. audioInstructions: Ambient room tone and sound design notes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
          required: ['visualPrompt', 'motionInstructions', 'cameraDirection', 'negativePrompt', 'audioInstructions'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from model');

    const promptDetails = JSON.parse(text);
    res.json({ success: true, prompt: promptDetails });
  } catch (error: any) {
    console.error('Error enhancing prompt:', error);
    res.status(500).json({
      error: error?.message || 'Failed to enhance prompt',
    });
  }
});

// AI Brief Refiner Endpoint
app.post('/api/ai/refine-brief', async (req, res) => {
  try {
    const { rawIdea, purpose, language } = req.body;

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on this server.',
      });
    }

    const prompt = `Refine this initial video idea into a structured production brief:
Initial Idea: ${rawIdea}
Purpose: ${purpose || 'Explainer'}
Language: ${language || 'English'}

Provide:
- refinedTitle: Punchy, memorable title
- targetAudience: Specific, actionable audience profile
- keyTakeaway: The 1 single message viewers remember
- toneOfVoice: Descriptive style guidance (e.g. "Crisp, authoritative, warm")
- suggestedDurationSeconds: 15, 30, 60, or 90
- suggestedVisualStyle: One of: cinematic_photorealistic, minimal_3d, editorial_film, high_tech_holographic, anime_vector, documentary_realism
- callToAction: Clear next step for the viewer`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    res.json({ success: true, brief: JSON.parse(text) });
  } catch (error: any) {
    console.error('Error refining brief:', error);
    res.status(500).json({
      error: error?.message || 'Failed to refine brief',
    });
  }
});

// Provider Setup & Status List
app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'prov_gemini_omni',
        name: 'Google Gemini & Veo (Interactions API)',
        category: 'video_generation',
        providerKey: 'gemini',
        status: apiKey ? 'connected' : 'unconfigured',
        supportedModels: ['gemini-omni-1.1-flash', 'gemini-3.8-flash'],
        activeModel: 'gemini-omni-1.1-flash',
        requiresPaidKey: true,
        description: 'Native Google GenAI multimodal video and script generation engine.',
      },
      {
        id: 'prov_runway',
        name: 'Runway Gen-3 Alpha',
        category: 'video_generation',
        providerKey: 'runway',
        status: 'demo_mode',
        supportedModels: ['gen3a_turbo', 'gen3a'],
        activeModel: 'gen3a_turbo',
        requiresPaidKey: true,
        description: 'External API integration adapter for cinematic video synthesis.',
      },
      {
        id: 'prov_luma',
        name: 'Luma Dream Machine',
        category: 'video_generation',
        providerKey: 'luma',
        status: 'demo_mode',
        supportedModels: ['ray-2', 'ray-1-6'],
        activeModel: 'ray-2',
        requiresPaidKey: true,
        description: 'High-motion camera physics and spatial rendering.',
      },
      {
        id: 'prov_local_demo',
        name: 'Obido Local Studio Engine',
        category: 'video_generation',
        providerKey: 'local_demo',
        status: 'connected',
        supportedModels: ['obido-prototype-v1'],
        activeModel: 'obido-prototype-v1',
        requiresPaidKey: false,
        description: 'Transparent local prototype adapter with zero fabricated outputs and instant workflow verification.',
      },
    ],
  });
});

// Mount Vite middleware for dev or serve static files in production
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Obido Studio] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
