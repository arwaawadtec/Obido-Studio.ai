import React, { useState, useEffect } from 'react';
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
  Video,
  Clock,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Project, PromptVersion, Scene, Shot } from '../../types';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/apiClient';
import {
  getShotsForScene,
  getPromptsForShot,
  getActivePromptForShot,
} from '../../services/shotMigration';

interface PromptsStageProps {
  project: Project;
  onProceedToGeneration: () => void;
}

export const PromptsStage: React.FC<PromptsStageProps> = ({ project, onProceedToGeneration }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const shots = project.shots || [];

  // Active scene and shot selection state
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.id || '');
  const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  const sceneShots = activeScene ? getShotsForScene(project, activeScene.id) : [];
  const [selectedShotId, setSelectedShotId] = useState<string>(sceneShots[0]?.id || shots[0]?.id || '');
  const activeShot = (project.shots || []).find((s) => s.id === selectedShotId) || sceneShots[0];

  // Prompt form fields for the currently active shot
  const [visualPrompt, setVisualPrompt] = useState<string>('');
  const [motionInstructions, setMotionInstructions] = useState<string>('');
  const [cameraDirection, setCameraDirection] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [audioInstructions, setAudioInstructions] = useState<string>('');
  const [targetProvider, setTargetProvider] = useState<string>('gemini_omni');

  // UI state
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Sync state whenever the selected shot changes
  useEffect(() => {
    if (!activeShot) return;

    const activeP = getActivePromptForShot(project, activeShot.id, activeShot.sceneId);
    if (activeP) {
      setVisualPrompt(activeP.visualPrompt || '');
      setMotionInstructions(activeP.motionInstructions || '');
      setCameraDirection(activeP.cameraDirection || activeShot.framing || 'medium');
      setNegativePrompt(
        activeP.negativePrompt ||
          'blurry, flickering, low-res, text artifacts, watermarks, floating limbs, cartoon'
      );
      setAudioInstructions(activeP.audioInstructions || activeShot.dialogueSnippet || '');
      setTargetProvider(activeP.targetProvider || 'gemini_omni');
    } else {
      // Default initial prompt derived strictly from shot's visual intent
      setVisualPrompt(activeShot.visualIntent || activeScene?.visualDescription || '');
      setMotionInstructions(
        activeShot.cameraMovement
          ? `Camera ${activeShot.cameraMovement.replace('_', ' ')}, realistic physics and cinematic momentum`
          : 'Smooth cinematic camera movement, realistic physics'
      );
      setCameraDirection(activeShot.framing || 'medium');
      setNegativePrompt('blurry, flickering, low-res, text artifacts, watermarks, floating limbs, cartoon');
      setAudioInstructions(activeShot.dialogueSnippet || activeScene?.audioCues || '');
      setTargetProvider('gemini_omni');
    }

    setValidationError(null);
  }, [activeShot?.id, project.id]);

  // Handle switching scenes: automatically select first shot of that scene
  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const sceneShots = getShotsForScene(project, sceneId);
    if (sceneShots.length > 0) {
      setSelectedShotId(sceneShots[0].id);
    }
  };

  // Handle selecting a specific shot
  const handleSelectShot = (shotId: string) => {
    setSelectedShotId(shotId);
    const targetShot = (project.shots || []).find((s) => s.id === shotId);
    if (targetShot && targetShot.sceneId !== selectedSceneId) {
      setSelectedSceneId(targetShot.sceneId);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // AI Prompt Enhancement for the specific shot
  const handleEnhanceWithAI = async () => {
    if (!activeShot) return;

    setIsEnhancing(true);
    setFeedback(null);
    setValidationError(null);

    const framingHint = cameraDirection || activeShot.framing || 'medium';
    const movementHint = activeShot.cameraMovement || 'static';

    try {
      const res = await authenticatedFetch('/api/ai/prompt-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualDescription: visualPrompt || activeShot.visualIntent || activeScene?.visualDescription || '',
          cameraFraming: `${framingHint}, ${movementHint}`,
          visualStyle: project.brief.visualStyle,
          targetProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enhance prompt');

      if (data.prompt) {
        const p = data.prompt;
        const newVisual = p.visualPrompt || visualPrompt;
        const newMotion = p.motionInstructions || motionInstructions;
        const newCamera = p.cameraDirection || cameraDirection;
        const newNegative = p.negativePrompt || negativePrompt;
        const newAudio = p.audioInstructions || audioInstructions;

        setVisualPrompt(newVisual);
        setMotionInstructions(newMotion);
        setCameraDirection(newCamera);
        setNegativePrompt(newNegative);
        setAudioInstructions(newAudio);

        // Save as new version for this specific shot
        storage.saveShotPrompt(project.id, activeShot.id, {
          visualPrompt: newVisual,
          motionInstructions: newMotion,
          cameraDirection: newCamera,
          negativePrompt: newNegative,
          audioInstructions: newAudio,
          targetProvider,
        });

        setFeedback(
          lang === 'ar'
            ? 'تم تحسين وتوسيع موجهات اللقطة بالذكاء الاصطناعي'
            : `Prompt enhanced with cinematography syntax for ${activeShot.name}`
        );
      }
    } catch (err: any) {
      console.warn('AI prompt enhancement fallback:', err);
      // Local deterministic cinematography prompt enhancement
      const enhancedVisual = `${visualPrompt || activeShot.visualIntent}, captured on 35mm anamorphic prime lens, ${framingHint.replace('_', ' ')} framing, volumetric rim lighting, ${project.brief.visualStyle.replace('_', ' ')} aesthetic, 8k resolution, crisp photorealistic textures`;
      setVisualPrompt(enhancedVisual);

      storage.saveShotPrompt(project.id, activeShot.id, {
        visualPrompt: enhancedVisual,
        motionInstructions,
        cameraDirection,
        negativePrompt,
        audioInstructions,
        targetProvider,
      });

      setFeedback(
        lang === 'ar'
          ? 'تم تطبيق المعايير السينمائية للقطة محلياً'
          : `Applied cinematography enhancement template for ${activeShot.name}`
      );
    } finally {
      setIsEnhancing(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Save current prompt form as a new version
  const handleSaveCurrentPrompt = (): boolean => {
    if (!activeShot) return false;

    if (!visualPrompt.trim()) {
      setValidationError(
        lang === 'ar'
          ? 'يرجى إدخال وصف الموجه البصري للقطة'
          : 'Visual prompt description cannot be empty.'
      );
      return false;
    }

    setIsSaving(true);
    setValidationError(null);

    storage.saveShotPrompt(project.id, activeShot.id, {
      visualPrompt: visualPrompt.trim(),
      motionInstructions: motionInstructions.trim(),
      cameraDirection: cameraDirection.trim(),
      negativePrompt: negativePrompt.trim(),
      audioInstructions: audioInstructions.trim(),
      targetProvider,
    });

    setIsSaving(false);
    setFeedback(
      lang === 'ar'
        ? `تم حفظ موجهات اللقطة #${activeShot.shotNumber}`
        : `Saved prompt version for Shot ${activeShot.shotNumber}`
    );
    setTimeout(() => setFeedback(null), 2500);
    return true;
  };

  // Restore a previous version for this shot
  const handleRestoreVersion = (version: PromptVersion) => {
    setVisualPrompt(version.visualPrompt || '');
    setMotionInstructions(version.motionInstructions || '');
    setCameraDirection(version.cameraDirection || '');
    setNegativePrompt(version.negativePrompt || '');
    setAudioInstructions(version.audioInstructions || '');
    setTargetProvider(version.targetProvider || 'gemini_omni');

    if (activeShot) {
      storage.setActiveShotPromptVersion(project.id, activeShot.id, version.id);
    }

    setFeedback(
      lang === 'ar'
        ? `تمت استعادة الإصدار #${version.versionNumber}`
        : `Restored Version ${version.versionNumber}`
    );
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleProceed = () => {
    if (visualPrompt.trim() && activeShot) {
      handleSaveCurrentPrompt();
    }
    storage.setWorkflowStage(project.id, 'generation');
    onProceedToGeneration();
  };

  if (scenes.length === 0 || shots.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
        <Terminal className="w-10 h-10 text-[#62677A]/40 mx-auto" />
        <h3 className="text-sm font-semibold text-[#11152B]">
          {lang === 'ar' ? 'لا توجد لقطات متاحة لصياغة الموجهات' : 'No shots available for prompt engineering'}
        </h3>
        <p className="text-xs text-[#62677A] max-w-sm mx-auto">
          {lang === 'ar'
            ? 'يجب إعداد المشاهد واللقطات أولاً في مرحلة لوحة القصة قبل هندسة الموجهات'
            : 'Please construct scenes and shot takes in Stage 3 (Storyboard) before composing technical prompts.'}
        </p>
      </div>
    );
  }

  const shotVersions = activeShot ? getPromptsForShot(project, activeShot.id, activeShot.sceneId) : [];
  const activePromptVersionId =
    project.activePromptVersion?.[activeShot?.id || ''] ||
    project.activePromptVersion?.[activeShot?.sceneId || ''] ||
    shotVersions[0]?.id;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 4 من 8' : 'Stage 4 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display flex items-center gap-2">
            <span>{lang === 'ar' ? 'مساحة هندسة موجهات اللقطات' : 'Shot Prompt Engineering Studio'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-[#635BFF]/10 text-[#635BFF]">
              Shot-Level
            </span>
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'صياغة الموجهات البصرية، وحركات الكاميرا، والموجهات السلبية لكل لقطة بشكل مستقل'
              : 'Compose visual prompts, motion vectors, camera lenses, and negative prompts for individual shot takes'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveCurrentPrompt}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors shadow-xs"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>{lang === 'ar' ? 'حفظ الموجهات' : 'Save Version'}</span>
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

      {/* Feedback & Error banners */}
      {feedback && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {validationError && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Layout: Scene & Shot Navigator (Left) + Prompt Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Hierarchical Scene & Shot Picker */}
        <div className="lg:col-span-4 bg-white border border-[#E3E6EF] rounded-xl p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
            <div className="text-xs font-bold text-[#11152B] flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Film className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>{lang === 'ar' ? 'المشاهد واللقطات' : 'Scenes & Shot Takes'}</span>
            </div>
            <span className="text-[11px] font-mono text-[#62677A] bg-[#F6F7FB] px-2 py-0.5 rounded">
              {shots.length} {lang === 'ar' ? 'لقطات' : 'shots'}
            </span>
          </div>

          <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
            {scenes.map((scene) => {
              const currentShots = getShotsForScene(project, scene.id);
              const isCurrentScene = scene.id === selectedSceneId;

              return (
                <div
                  key={scene.id}
                  className={`rounded-lg border transition-all ${
                    isCurrentScene
                      ? 'border-[#635BFF]/40 bg-[#F6F7FB]/50'
                      : 'border-[#E3E6EF] bg-white hover:border-[#CBD1E1]'
                  }`}
                >
                  {/* Scene header row */}
                  <button
                    type="button"
                    onClick={() => handleSelectScene(scene.id)}
                    className="w-full text-left p-2.5 flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#11152B] text-white">
                          S{scene.sceneNumber}
                        </span>
                        <span className="text-xs font-semibold text-[#11152B] line-clamp-1">
                          {scene.narrativePurpose || `Scene ${scene.sceneNumber}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#62677A] mt-0.5 flex items-center gap-2">
                        <span>{scene.estimatedDurationSeconds || 5}s total</span>
                        <span>•</span>
                        <span>{currentShots.length} {currentShots.length === 1 ? 'take' : 'takes'}</span>
                      </div>
                    </div>
                  </button>

                  {/* Child Shots inside this scene */}
                  <div className="px-2 pb-2 space-y-1.5 border-t border-[#E3E6EF]/60 pt-2">
                    {currentShots.map((shot) => {
                      const isSelectedShot = shot.id === selectedShotId;
                      const shotPrompts = getPromptsForShot(project, shot.id, shot.sceneId);
                      const hasPrompt = shotPrompts.length > 0;

                      return (
                        <button
                          key={shot.id}
                          type="button"
                          onClick={() => handleSelectShot(shot.id)}
                          className={`w-full text-left p-2 rounded-md flex items-center justify-between gap-2 text-xs transition-all cursor-pointer ${
                            isSelectedShot
                              ? 'bg-[#635BFF] text-white font-medium shadow-xs'
                              : 'bg-white hover:bg-[#F6F7FB] text-[#11152B] border border-[#E3E6EF]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                isSelectedShot
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#F0F2F7] text-[#11152B]'
                              }`}
                            >
                              Take {shot.shotNumber}
                            </span>
                            <span className="truncate">{shot.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-mono ${
                                isSelectedShot ? 'text-white/80' : 'text-[#62677A]'
                              }`}
                            >
                              {shot.durationSeconds}s
                            </span>
                            {hasPrompt ? (
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSelectedShot ? 'bg-emerald-300' : 'bg-emerald-500'
                                }`}
                                title="Prompted"
                              />
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSelectedShot ? 'bg-amber-300' : 'bg-amber-400'
                                }`}
                                title="Draft"
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Main Column: Active Shot Details & Prompt Editor */}
        <div className="lg:col-span-8 space-y-6">
          {activeShot ? (
            <>
              {/* Active Shot Context Summary Banner */}
              <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E3E6EF]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-[#635BFF] text-white">
                      Shot {activeShot.shotNumber}
                    </span>
                    <h3 className="text-base font-bold text-[#11152B]">{activeShot.name}</h3>
                    <span className="text-xs text-[#62677A] font-mono">
                      ({activeShot.durationSeconds} seconds)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
                      {activeShot.framing}
                    </span>
                    <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
                      {activeShot.cameraMovement.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                        showHistory
                          ? 'bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]'
                          : 'bg-white text-[#62677A] border-[#E3E6EF] hover:bg-[#F6F7FB]'
                      }`}
                    >
                      <History className="w-3 h-3" />
                      <span>{shotVersions.length} {shotVersions.length === 1 ? 'version' : 'versions'}</span>
                    </button>
                  </div>
                </div>

                {/* Shot narrative visual intent reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#F6F7FB] rounded-lg space-y-1">
                    <div className="font-semibold text-[#62677A] uppercase tracking-wider text-[10px] font-mono">
                      {lang === 'ar' ? 'الهدف البصري (من القصة)' : 'Storyboard Visual Intent'}
                    </div>
                    <p className="text-[#11152B] leading-relaxed">
                      {activeShot.visualIntent || activeScene?.visualDescription || 'No storyboard visual description set.'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#F6F7FB] rounded-lg space-y-1">
                    <div className="font-semibold text-[#62677A] uppercase tracking-wider text-[10px] font-mono">
                      {lang === 'ar' ? 'الحوار / التعليق الصوتي' : 'Dialogue / Voiceover'}
                    </div>
                    <p className="text-[#11152B] leading-relaxed italic">
                      {activeShot.dialogueSnippet || activeShot.voiceoverSnippet || activeScene?.narrationDialogue || 'No voiceover line.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Version History Drawer (if opened) */}
              {showHistory && (
                <div className="bg-[#FBFBFE] border border-[#635BFF]/30 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>{lang === 'ar' ? 'تاريخ إصدارات الموجه للقطة' : `Version History — Shot ${activeShot.shotNumber}`}</span>
                    </h4>
                    <span className="text-[11px] text-[#62677A]">
                      {shotVersions.length} recorded revisions
                    </span>
                  </div>

                  {shotVersions.length === 0 ? (
                    <p className="text-xs text-[#62677A] py-2">No previous versions saved for this shot yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {shotVersions.map((v) => {
                        const isActive = v.id === activePromptVersionId;
                        return (
                          <div
                            key={v.id}
                            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                              isActive
                                ? 'bg-white border-[#635BFF] shadow-xs ring-1 ring-[#635BFF]/20'
                                : 'bg-white border-[#E3E6EF] hover:border-[#CBD1E1]'
                            }`}
                          >
                            <div className="space-y-1 max-w-xl">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#635BFF]">
                                  v{v.versionNumber}
                                </span>
                                <span className="text-[11px] text-[#62677A]">
                                  {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F0F2F7] text-[#11152B]">
                                  {v.targetModel}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[#11152B] line-clamp-2 leading-relaxed">
                                {v.visualPrompt}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopy(v.visualPrompt, v.id)}
                                className="px-2.5 py-1 text-[11px] font-medium border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded transition-colors flex items-center gap-1"
                              >
                                {copiedKey === v.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedKey === v.id ? 'Copied' : 'Copy'}</span>
                              </button>
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreVersion(v)}
                                  className="px-2.5 py-1 text-[11px] font-medium bg-[#635BFF] text-white hover:bg-[#5249ea] rounded transition-colors flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Technical Prompt Form */}
              <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 space-y-6 shadow-xs">
                {/* Form Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E6EF]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#635BFF]" />
                    <h4 className="text-sm font-bold text-[#11152B]">
                      {lang === 'ar' ? 'محرر الموجه التقني' : 'Technical Cinematography Prompt'}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEnhanceWithAI}
                      disabled={isEnhancing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#635BFF] bg-[#635BFF]/10 hover:bg-[#635BFF]/20 rounded-lg transition-colors cursor-pointer"
                    >
                      {isEnhancing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      <span>{lang === 'ar' ? 'تحسين بالذكاء الاصطناعي' : 'Enhance with AI'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(visualPrompt, 'main_prompt')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#62677A] hover:text-[#11152B] border border-[#E3E6EF] rounded-lg hover:bg-[#F6F7FB] transition-colors"
                    >
                      {copiedKey === 'main_prompt' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'main_prompt' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* 1. Primary Visual Prompt */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#11152B] flex items-center gap-1.5">
                      <span>{lang === 'ar' ? 'الموجه البصري الأساسي' : 'Primary Visual Prompt'}</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-[#62677A]">
                      {visualPrompt.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={visualPrompt}
                    onChange={(e) => setVisualPrompt(e.target.value)}
                    placeholder="Describe lighting, subject placement, atmosphere, and cinematic texture..."
                    className="w-full text-xs font-mono p-3 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] outline-hidden leading-relaxed resize-y bg-[#FCFCFD]"
                  />
                  <p className="text-[11px] text-[#62677A]">
                    {lang === 'ar'
                      ? 'حدد عناصر الإضاءة، والعدسة، والمواد، والتركيب السينمائي للقطة'
                      : 'Specify camera lens, focal depth, key lighting, volumetric atmosphere, and precise physical elements.'}
                  </p>
                </div>

                {/* 2. Motion Instructions & Camera Direction Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>{lang === 'ar' ? 'حركة الكاميرا وتوجيه الإطار' : 'Camera Direction & Framing'}</span>
                    </label>
                    <input
                      type="text"
                      value={cameraDirection}
                      onChange={(e) => setCameraDirection(e.target.value)}
                      placeholder="e.g. 50mm anamorphic, low angle tilt up, eye-level"
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-[#FCFCFD]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>{lang === 'ar' ? 'ديناميكية الحركة والفيزياء' : 'Motion Vector & Physics'}</span>
                    </label>
                    <input
                      type="text"
                      value={motionInstructions}
                      onChange={(e) => setMotionInstructions(e.target.value)}
                      placeholder="e.g. Slow gentle drift, realistic fluid turbulence, zero jitter"
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-[#FCFCFD]"
                    />
                  </div>
                </div>

                {/* 3. Negative Prompt & Target Model Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lang === 'ar' ? 'الموجه السلبي (المستبعدات)' : 'Negative Prompt'}</span>
                    </label>
                    <input
                      type="text"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="Artifacts, distortion, blurry, low frame rate, watermarks"
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-[#FCFCFD]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>{lang === 'ar' ? 'نموذج التوليد المستهدف' : 'Target AI Model / Provider'}</span>
                    </label>
                    <select
                      value={targetProvider}
                      onChange={(e) => setTargetProvider(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-white"
                    >
                      <option value="gemini_omni">Gemini Omni (gemini-omni-1.1-flash)</option>
                      <option value="runway_gen3">Runway Gen-3 Alpha (Demo / External)</option>
                      <option value="luma_dream">Luma Dream Machine Ray 2 (Demo)</option>
                      <option value="local_demo">Local Prototype Engine</option>
                    </select>
                  </div>
                </div>

                {/* 4. Audio & Voiceover Cues */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#11152B] flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>{lang === 'ar' ? 'تعليمات الصوت والمؤثرات المتزامنة' : 'Audio & Sound Design Synchronization'}</span>
                  </label>
                  <input
                    type="text"
                    value={audioInstructions}
                    onChange={(e) => setAudioInstructions(e.target.value)}
                    placeholder="Ambient room tone, subtle cinematic drone, crisp dialogue cue"
                    className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-[#FCFCFD]"
                  />
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-[#E3E6EF] flex items-center justify-between">
                  <div className="text-xs text-[#62677A] font-mono">
                    Target: <span className="text-[#11152B] font-semibold">Shot {activeShot.shotNumber}</span> ({activeShot.durationSeconds}s)
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentPrompt}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#11152B] hover:bg-black rounded-lg transition-colors cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{lang === 'ar' ? 'حفظ الإصدار للقطة' : 'Save Shot Version'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl text-[#62677A] text-xs">
              Select a shot from the left sidebar to compose prompts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
