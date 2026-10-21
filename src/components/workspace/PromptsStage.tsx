import React, { useState } from 'react';
import {
  Terminal,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Camera,
  Film,
  Volume2,
  Wand2,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';
import { Project, PromptVersion, Scene } from '../../types';
import { storage } from '../../services/storage';

interface PromptsStageProps {
  project: Project;
  onProceedToGeneration: () => void;
}

export const PromptsStage: React.FC<PromptsStageProps> = ({ project, onProceedToGeneration }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.id || '');
  const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  // Active prompt version for current scene
  const scenePrompts = (activeScene && project.prompts[activeScene.id]) || [];
  const currentPrompt: PromptVersion = scenePrompts[0] || {
    id: 'p_init_' + (activeScene?.id || 'none'),
    sceneId: activeScene?.id || '',
    versionNumber: 1,
    createdAt: new Date().toISOString(),
    visualPrompt: activeScene?.visualDescription || '',
    motionInstructions: 'Smooth cinematic camera movement, realistic physics',
    cameraDirection: activeScene?.cameraFraming || 'Medium shot',
    negativePrompt: 'blurry, flickering, low-res, text artifacts, watermarks, floating limbs, cartoon',
    audioInstructions: activeScene?.audioCues || 'Ambient background tone',
    targetProvider: 'gemini_omni',
    targetModel: 'gemini-omni-1.1-flash',
  };

  const [visualPrompt, setVisualPrompt] = useState(currentPrompt.visualPrompt);
  const [motionInstructions, setMotionInstructions] = useState(currentPrompt.motionInstructions);
  const [cameraDirection, setCameraDirection] = useState(currentPrompt.cameraDirection);
  const [negativePrompt, setNegativePrompt] = useState(currentPrompt.negativePrompt);
  const [audioInstructions, setAudioInstructions] = useState(currentPrompt.audioInstructions);
  const [targetProvider, setTargetProvider] = useState(currentPrompt.targetProvider);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync state when active scene changes
  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const scenePrompts = project.prompts[sceneId] || [];
    const targetScene = scenes.find((s) => s.id === sceneId);
    const activeP = scenePrompts[0] || {
      id: 'p_' + sceneId,
      sceneId: sceneId,
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      visualPrompt: targetScene?.visualDescription || '',
      motionInstructions: 'Smooth cinematic camera movement, realistic physics',
      cameraDirection: targetScene?.cameraFraming || 'Medium shot',
      negativePrompt: 'blurry, flickering, low-res, text artifacts, watermarks, floating limbs, cartoon',
      audioInstructions: targetScene?.audioCues || 'Ambient background tone',
      targetProvider: 'gemini_omni',
      targetModel: 'gemini-omni-1.1-flash',
    };

    setVisualPrompt(activeP.visualPrompt);
    setMotionInstructions(activeP.motionInstructions);
    setCameraDirection(activeP.cameraDirection);
    setNegativePrompt(activeP.negativePrompt);
    setAudioInstructions(activeP.audioInstructions);
    setTargetProvider(activeP.targetProvider);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleEnhanceWithAI = async () => {
    if (!activeScene) return;

    setIsEnhancing(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/ai/prompt-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualDescription: activeScene.visualDescription || visualPrompt,
          cameraFraming: cameraDirection || activeScene.cameraFraming,
          visualStyle: project.brief.visualStyle,
          targetProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enhance prompt');

      if (data.prompt) {
        const p = data.prompt;
        setVisualPrompt(p.visualPrompt || visualPrompt);
        setMotionInstructions(p.motionInstructions || motionInstructions);
        setCameraDirection(p.cameraDirection || cameraDirection);
        setNegativePrompt(p.negativePrompt || negativePrompt);
        setAudioInstructions(p.audioInstructions || audioInstructions);

        // Save as version
        const existingVersions = project.prompts[activeScene.id] || [];
        const newVersion: PromptVersion = {
          id: 'p_v' + (existingVersions.length + 1) + '_' + Date.now().toString(36),
          sceneId: activeScene.id,
          versionNumber: existingVersions.length + 1,
          createdAt: new Date().toISOString(),
          visualPrompt: p.visualPrompt || visualPrompt,
          motionInstructions: p.motionInstructions || motionInstructions,
          cameraDirection: p.cameraDirection || cameraDirection,
          negativePrompt: p.negativePrompt || negativePrompt,
          audioInstructions: p.audioInstructions || audioInstructions,
          targetProvider,
          targetModel: targetProvider === 'gemini_omni' ? 'gemini-omni-1.1-flash' : 'external-v1',
        };

        const updatedPrompts = {
          ...project.prompts,
          [activeScene.id]: [newVersion, ...existingVersions],
        };

        storage.updateProject(project.id, { prompts: updatedPrompts });
        setFeedback(lang === 'ar' ? 'تم تنقيح وتوسيع الموجهات بالذكاء الاصطناعي' : 'Prompts enhanced with cinematography syntax');
      }
    } catch (err: any) {
      console.warn('AI prompt enhancement error', err);
      // Client fallback enhancement
      const enhancedVisual = `${visualPrompt || activeScene.visualDescription}, shot on 35mm anamorphic lens, volumetric rim lighting, ${project.brief.visualStyle.replace('_', ' ')} aesthetic, 8k resolution, crisp details`;
      setVisualPrompt(enhancedVisual);
      setFeedback(lang === 'ar' ? 'تم تطبيق المعايير السينمائية محلياً' : 'Applied local cinematography prompt template');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSaveCurrentPrompt = () => {
    if (!activeScene) return;

    const existingVersions = project.prompts[activeScene.id] || [];
    const newVersion: PromptVersion = {
      id: 'p_v' + (existingVersions.length + 1) + '_' + Date.now().toString(36),
      sceneId: activeScene.id,
      versionNumber: existingVersions.length + 1,
      createdAt: new Date().toISOString(),
      visualPrompt,
      motionInstructions,
      cameraDirection,
      negativePrompt,
      audioInstructions,
      targetProvider,
      targetModel: targetProvider === 'gemini_omni' ? 'gemini-omni-1.1-flash' : 'external-v1',
    };

    const updatedPrompts = {
      ...project.prompts,
      [activeScene.id]: [newVersion, ...existingVersions],
    };

    storage.updateProject(project.id, { prompts: updatedPrompts });
    setFeedback(lang === 'ar' ? 'تم حفظ الموجهات' : 'Prompts saved successfully');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleProceed = () => {
    handleSaveCurrentPrompt();
    storage.setWorkflowStage(project.id, 'generation');
    onProceedToGeneration();
  };

  if (scenes.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
        <Terminal className="w-10 h-10 text-[#62677A]/40 mx-auto" />
        <h3 className="text-sm font-semibold text-[#11152B]">
          {lang === 'ar' ? 'لا توجد مشاهد لصياغة الموجهات لها' : 'No scenes available for prompts'}
        </h3>
        <p className="text-xs text-[#62677A] max-w-sm mx-auto">
          {lang === 'ar'
            ? 'يجب إعداد المشاهد أولاً في مرحلة لوحة القصة قبل هندسة الموجهات'
            : 'Please construct scenes in Stage 3 (Storyboard) before composing technical prompts.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 4 من 8' : 'Stage 4 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'مساحة هندسة الموجهات' : 'Prompt Engineering Studio'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'صياغة الموجهات البصرية، وحركات الكاميرا، والموجهات السلبية الخاصة بنماذج الفيديو'
              : 'Compose visual prompts, motion vectors, camera lenses, and negative prompts per scene'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveCurrentPrompt}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'حفظ الموجهات' : 'Save Prompts'}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى التوليد' : 'Proceed to Generation'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scene Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {scenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;
          const hasCustomPrompts = (project.prompts[scene.id] || []).length > 0;
          return (
            <button
              key={scene.id}
              onClick={() => handleSelectScene(scene.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                isSelected
                  ? 'border-[#635BFF] bg-[#635BFF]/10 text-[#635BFF]'
                  : 'border-[#E3E6EF] bg-white hover:border-[#D1D5E5] text-[#62677A]'
              }`}
            >
              <span className="font-mono font-bold">#{scene.sceneNumber}</span>
              <span className="truncate max-w-[120px]">{scene.narrativePurpose}</span>
              {hasCustomPrompts && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Scene Prompt Builder */}
      {activeScene && (
        <div className="space-y-6">
          {/* Quick Scene Reference Card */}
          <div className="p-4 bg-white border border-[#E3E6EF] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#62677A]">
                <span className="font-bold text-[#11152B]">Scene #{activeScene.sceneNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{activeScene.cameraFraming}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{activeScene.estimatedDurationSeconds}s</span>
              </div>
              <p className="text-xs text-[#62677A] line-clamp-1">
                {activeScene.visualDescription || 'No visual description yet'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Provider Selector */}
              <select
                value={targetProvider}
                onChange={(e) => setTargetProvider(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg text-[#11152B] font-medium"
              >
                <option value="gemini_omni">Google Veo / Gemini Omni</option>
                <option value="runway_gen3">Runway Gen-3 Alpha</option>
                <option value="luma_dream">Luma Dream Machine</option>
                <option value="local_demo">Local Prototype Adapter</option>
              </select>

              <button
                type="button"
                onClick={handleEnhanceWithAI}
                disabled={isEnhancing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{lang === 'ar' ? 'جارٍ التحسين...' : 'Synthesizing...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[#38D9F9]" />
                    <span>{lang === 'ar' ? 'تحسين بالذكاء الاصطناعي' : 'AI Prompt Enhancer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {feedback && (
            <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-lg text-xs text-[#16A34A] flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Form Fields: Visual, Motion, Camera, Negative */}
          <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 space-y-5 shadow-xs">
            {/* Visual Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>{lang === 'ar' ? 'الموجّه البصري الرئيسي (Visual Prompt)' : 'Primary Visual Prompt'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(visualPrompt, 'visual')}
                  className="flex items-center gap-1 text-[11px] text-[#62677A] hover:text-[#11152B]"
                >
                  {copiedKey === 'visual' ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'visual' ? (lang === 'ar' ? 'تم النسخ' : 'Copied') : (lang === 'ar' ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>
              <textarea
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                rows={4}
                placeholder="Subject details, environmental textures, volumetric lighting, photographic lens specification..."
                className="w-full text-xs font-mono p-3 bg-[#F6F7FB]/50 border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none leading-relaxed text-[#11152B]"
              />
            </div>

            {/* Motion & Camera Direction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#38D9F9]" />
                    <span>{lang === 'ar' ? 'توجيهات الحركة (Motion Vectors)' : 'Motion Instructions'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(motionInstructions, 'motion')}
                    className="text-[11px] text-[#62677A] hover:text-[#11152B]"
                  >
                    {copiedKey === 'motion' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={motionInstructions}
                  onChange={(e) => setMotionInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. Slow smooth dolly-in, 45 degree gentle camera pan, fluid organic particle drift..."
                  className="w-full text-xs font-mono p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#9B8CFF]" />
                    <span>{lang === 'ar' ? 'زوايا الكاميرا والعدسة' : 'Camera Direction & Framing'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(cameraDirection, 'camera')}
                    className="text-[11px] text-[#62677A] hover:text-[#11152B]"
                  >
                    {copiedKey === 'camera' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={cameraDirection}
                  onChange={(e) => setCameraDirection(e.target.value)}
                  rows={3}
                  placeholder="e.g. 50mm f/1.8 lens, shallow depth of field with creamy bokeh, low angle shot looking upwards..."
                  className="w-full text-xs font-mono p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                />
              </div>
            </div>

            {/* Negative Prompt & Audio Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#11152B]">
                    {lang === 'ar' ? 'الموجّه السلبي (Negative Prompt)' : 'Negative Prompt (Avoid Artifacts)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(negativePrompt, 'negative')}
                    className="text-[11px] text-[#62677A] hover:text-[#11152B]"
                  >
                    {copiedKey === 'negative' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  placeholder="Artifacts to avoid: blurry, flickering, morphing, low-res, text watermarks, 3d game graphics..."
                  className="w-full text-xs font-mono p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>{lang === 'ar' ? 'توجيهات الصوت والموسيقى' : 'Audio & SFX Direction'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(audioInstructions, 'audio')}
                    className="text-[11px] text-[#62677A] hover:text-[#11152B]"
                  >
                    {copiedKey === 'audio' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={audioInstructions}
                  onChange={(e) => setAudioInstructions(e.target.value)}
                  rows={2}
                  placeholder="Ambient room tone, sound effects, voice cadence, musical swell..."
                  className="w-full text-xs font-mono p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
