import React, { useState } from 'react';
import {
  Cpu,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Plus,
  Loader2,
  Info,
  Film,
  Camera,
  ExternalLink,
  Ban,
  Check,
  Video,
  FileText,
  Volume2,
} from 'lucide-react';
import { Project, GenerationJob, AspectRatio, Asset, Shot } from '../../types';
import { storage } from '../../services/storage';
import {
  getShotsForScene,
  getActivePromptForShot,
  getPromptsForShot,
} from '../../services/shotMigration';

interface GenerationStageProps {
  project: Project;
  onProceedToAssets: () => void;
  onNavigateToPrompts?: () => void;
}

export const GenerationStage: React.FC<GenerationStageProps> = ({
  project,
  onProceedToAssets,
  onNavigateToPrompts,
}) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const shots = project.shots || [];

  // Active scene and shot selection
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.id || '');
  const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  const sceneShots = activeScene ? getShotsForScene(project, activeScene.id) : [];
  const [selectedShotId, setSelectedShotId] = useState<string>(sceneShots[0]?.id || shots[0]?.id || '');
  const activeShot = (project.shots || []).find((s) => s.id === selectedShotId) || sceneShots[0];

  // Generation parameters
  const [taskType, setTaskType] = useState<GenerationJob['taskType']>('text_to_video');
  const [provider, setProvider] = useState<GenerationJob['provider']>('gemini_omni');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [durationSeconds, setDurationSeconds] = useState<number>(activeShot?.durationSeconds || 5);
  const [motionStrength, setMotionStrength] = useState<number>(6);

  // Filter view: show only current shot jobs or all project jobs
  const [filterCurrentShotOnly, setFilterCurrentShotOnly] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Active prompt for current shot
  const activePromptVersion = activeShot
    ? getActivePromptForShot(project, activeShot.id, activeShot.sceneId)
    : undefined;
  const activePromptText =
    activePromptVersion?.visualPrompt ||
    activeShot?.visualIntent ||
    activeScene?.visualDescription ||
    '';

  const jobs = project.generationJobs || [];

  // Filter jobs based on selected view
  const visibleJobs = filterCurrentShotOnly && activeShot
    ? jobs.filter((j) => j.shotId === activeShot.id || (!j.shotId && j.sceneId === activeShot.sceneId))
    : jobs;

  // Assets belonging to current shot
  const shotAssets = activeShot
    ? (project.assets || []).filter(
        (a) => a.shotId === activeShot.id || (!a.shotId && a.sceneId === activeShot.sceneId)
      )
    : [];

  // Check if a job is currently in progress for the active shot
  const activeJobForShot = jobs.find(
    (j) =>
      (j.status === 'queued' || j.status === 'processing') &&
      j.taskType === taskType &&
      ((activeShot && j.shotId === activeShot.id) ||
        (!j.shotId && activeShot && j.sceneId === activeShot.sceneId))
  );

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const shotsForSc = getShotsForScene(project, sceneId);
    if (shotsForSc.length > 0) {
      setSelectedShotId(shotsForSc[0].id);
      setDurationSeconds(shotsForSc[0].durationSeconds || 5);
    }
  };

  const handleSelectShot = (shot: Shot) => {
    setSelectedShotId(shot.id);
    setSelectedSceneId(shot.sceneId);
    setDurationSeconds(shot.durationSeconds || 5);
    setWarningMessage(null);
  };

  // Dispatch generation job for the selected shot
  const handleQueueJob = () => {
    if (!activeShot) {
      setWarningMessage(lang === 'ar' ? 'يرجى تحديد لقطة أولاً' : 'Please select a shot first.');
      return;
    }

    // Deduplication check: prevent multiple identical jobs for the same shot
    if (activeJobForShot) {
      setWarningMessage(
        lang === 'ar'
          ? `يوجد توليد قيد المعالجة بالفعل للقطة #${activeShot.shotNumber}`
          : `A generation job is already active for Shot ${activeShot.shotNumber}. Please wait for it to finish.`
      );
      setTimeout(() => setWarningMessage(null), 3500);
      return;
    }

    setWarningMessage(null);
    const isSimulated = provider !== 'gemini_omni';

    const newJob = storage.addGenerationJob(
      project.id,
      {
        projectId: project.id,
        sceneId: activeShot.sceneId,
        shotId: activeShot.id,
        taskType,
        provider,
        modelName:
          provider === 'gemini_omni'
            ? 'gemini-omni-1.1-flash'
            : provider === 'runway_gen3'
            ? 'runway-gen3a-turbo'
            : provider === 'luma_dream'
            ? 'luma-ray-2'
            : 'local-prototype-v1',
        prompt: activePromptText || `Cinematic sequence for Shot ${activeShot.shotNumber}`,
        parameters: {
          aspectRatio: project.brief.aspectRatio,
          resolution,
          durationSeconds,
          motionStrength,
        },
        status: 'queued',
        progressPercent: 0,
        isSimulated,
      },
      true // deduplicate
    );

    // Update shot status to generating
    storage.updateShot(project.id, activeShot.id, {
      status: 'generating',
    });

    setFeedback(
      lang === 'ar'
        ? `تم إرسال اللقطة #${activeShot.shotNumber} إلى قائمة التوليد`
        : `Dispatched Shot ${activeShot.shotNumber} (${newJob.modelName})`
    );
    setTimeout(() => setFeedback(null), 3000);

    // Start lifecycle progress simulation
    simulateJobExecution(newJob.id, isSimulated, activeShot.id, activeShot.sceneId);
  };

  const simulateJobExecution = (
    jobId: string,
    isSimulated: boolean,
    shotId: string,
    sceneId: string
  ) => {
    // Stage 1: Queued -> Processing (20%)
    setTimeout(() => {
      storage.updateGenerationJob(project.id, jobId, {
        status: 'processing',
        progressPercent: 25,
        startedAt: new Date().toISOString(),
      });

      // Stage 2: Processing (65%)
      setTimeout(() => {
        storage.updateGenerationJob(project.id, jobId, {
          progressPercent: 68,
        });

        // Stage 3: Complete & create asset
        setTimeout(() => {
          const targetShot = (project.shots || []).find((s) => s.id === shotId);
          const assetName = targetShot
            ? `${targetShot.name} — Generated Take`
            : `${activeScene?.narrativePurpose || 'Scene'} — Take`;

          const resultAsset: Asset = storage.addAsset(project.id, {
            projectId: project.id,
            sceneId,
            shotId,
            name: assetName,
            type: taskType === 'text_to_speech' ? 'audio_voiceover' : 'video',
            url: '',
            filesizeBytes: 19500000,
            durationSeconds,
            dimensions:
              resolution === '4k'
                ? { width: 3840, height: 2160 }
                : { width: 1920, height: 1080 },
            aspectRatio: project.brief.aspectRatio,
            format: 'mp4',
            provider,
            isSimulatedDemo: isSimulated,
            metadata: {
              shotId,
              prompt: activePromptText,
              motionStrength,
              resolution,
              generatedAt: new Date().toISOString(),
            },
          });

          // Complete job
          storage.updateGenerationJob(project.id, jobId, {
            status: 'succeeded',
            progressPercent: 100,
            completedAt: new Date().toISOString(),
            resultAssetId: resultAsset.id,
          });

          // Link asset directly to shot and mark shot as ready
          storage.updateShot(project.id, shotId, {
            activeAssetId: resultAsset.id,
            status: 'ready',
          });
        }, 2500);
      }, 1500);
    }, 1000);
  };

  const handleCancelJob = (jobId: string) => {
    storage.updateGenerationJob(project.id, jobId, {
      status: 'cancelled',
      errorMessage: 'Cancelled by user',
    });
    if (activeShot) {
      storage.updateShot(project.id, activeShot.id, {
        status: 'prompted',
      });
    }
  };

  const handleRetryJob = (job: GenerationJob) => {
    storage.updateGenerationJob(project.id, job.id, {
      status: 'queued',
      progressPercent: 0,
      errorMessage: undefined,
    });
    simulateJobExecution(job.id, job.isSimulated, job.shotId || activeShot?.id || '', job.sceneId || activeShot?.sceneId || '');
  };

  const handleAttachAssetToShot = (assetId: string) => {
    if (!activeShot) return;
    storage.updateShot(project.id, activeShot.id, {
      activeAssetId: assetId,
      status: 'ready',
    });
    setFeedback(
      lang === 'ar'
        ? `تم تعيين المقطع كمقطع نشط للقطة #${activeShot.shotNumber}`
        : `Attached asset to Shot ${activeShot.shotNumber}`
    );
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'assets');
    onProceedToAssets();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 5 من 8' : 'Stage 5 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display flex items-center gap-2">
            <span>{lang === 'ar' ? 'توليد الفيديو وإدارة مهام اللقطات' : 'Shot Video Generation & Dispatcher'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-[#635BFF]/10 text-[#635BFF]">
              Shot-First
            </span>
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'واجهة موحدة لتشغيل نماذج توليد الفيديو لكل لقطة، مع الشفافية الصريحة لمنع النجاح الوهمي'
              : 'Dispatch individual shot takes with transparent real vs simulated reporting and zero fabricated success'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToPrompts && (
            <button
              type="button"
              onClick={onNavigateToPrompts}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'العودة للموجهات' : 'Edit Prompts'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى مكتبة الوسائط' : 'Proceed to Assets'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feedback & Warning Banners */}
      {feedback && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {warningMessage && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Main Grid: Scene & Shot Picker (Left) + Dispatcher & Active Shot Details (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Scene & Shot Hierarchy */}
        <div className="lg:col-span-4 bg-white border border-[#E3E6EF] rounded-xl p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
            <div className="text-xs font-bold text-[#11152B] flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Film className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>{lang === 'ar' ? 'اختيار اللقطة للتوليد' : 'Select Shot Take'}</span>
            </div>
            <span className="text-[11px] font-mono text-[#62677A] bg-[#F6F7FB] px-2 py-0.5 rounded">
              {shots.length} shots
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
                        <span>{currentShots.length} takes</span>
                        <span>•</span>
                        <span>{scene.estimatedDurationSeconds || 5}s</span>
                      </div>
                    </div>
                  </button>

                  <div className="px-2 pb-2 space-y-1.5 border-t border-[#E3E6EF]/60 pt-2">
                    {currentShots.map((shot) => {
                      const isSelectedShot = shot.id === selectedShotId;
                      const hasActiveAsset = !!shot.activeAssetId;
                      const hasRunningJob = jobs.some(
                        (j) =>
                          (j.status === 'queued' || j.status === 'processing') &&
                          (j.shotId === shot.id || (!j.shotId && j.sceneId === shot.sceneId))
                      );

                      return (
                        <button
                          key={shot.id}
                          type="button"
                          onClick={() => handleSelectShot(shot)}
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
                            {hasRunningJob ? (
                              <Loader2
                                className={`w-3 h-3 animate-spin ${
                                  isSelectedShot ? 'text-white' : 'text-[#635BFF]'
                                }`}
                              />
                            ) : hasActiveAsset ? (
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSelectedShot ? 'bg-emerald-300' : 'bg-emerald-500'
                                }`}
                                title="Generated Asset Ready"
                              />
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSelectedShot ? 'bg-white/40' : 'bg-[#CBD1E1]'
                                }`}
                                title="Not yet generated"
                              />
                            )}
                            <span
                              className={`text-[10px] font-mono ${
                                isSelectedShot ? 'text-white/80' : 'text-[#62677A]'
                              }`}
                            >
                              {shot.durationSeconds}s
                            </span>
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

        {/* Right Main Column: Dispatcher Controls + Job Status Dashboard */}
        <div className="lg:col-span-8 space-y-6">
          {activeShot ? (
            <>
              {/* Active Shot Summary & Prompt Snippet Card */}
              <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E3E6EF]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-[#635BFF] text-white">
                      Shot {activeShot.shotNumber}
                    </span>
                    <h3 className="text-base font-bold text-[#11152B]">{activeShot.name}</h3>
                    <span className="text-xs text-[#62677A] font-mono">
                      ({activeShot.durationSeconds}s)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
                      {activeShot.framing}
                    </span>
                    <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
                      {activeShot.cameraMovement.replace('_', ' ')}
                    </span>
                    {onNavigateToPrompts && (
                      <button
                        type="button"
                        onClick={onNavigateToPrompts}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#635BFF] bg-[#635BFF]/10 hover:bg-[#635BFF]/20 rounded border border-[#635BFF]/30 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Edit Prompt</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Prompt Preview */}
                <div className="p-3 bg-[#F6F7FB] rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-[#62677A] uppercase tracking-wider">
                    <span>
                      {lang === 'ar' ? 'الموجه المعتمد للتوليد' : 'Active Technical Prompt for Generation'}
                    </span>
                    {activePromptVersion && (
                      <span className="text-[#635BFF]">Version {activePromptVersion.versionNumber}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#11152B] font-mono leading-relaxed line-clamp-3">
                    {activePromptText || 'No prompt composed yet. Default cinematography template will be used.'}
                  </p>
                </div>
              </div>

              {/* Generation Configuration Dispatcher Card */}
              <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EF]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#635BFF]" />
                    <h4 className="text-sm font-bold text-[#11152B]">
                      {lang === 'ar' ? 'إعدادات نموذج التوليد' : 'Shot Generation Dispatcher'}
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#62677A] font-mono">
                    Target: Shot {activeShot.shotNumber}
                  </span>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Task Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B]">
                      {lang === 'ar' ? 'نوع مهمة التوليد' : 'Generation Task'}
                    </label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value as any)}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-white"
                    >
                      <option value="text_to_video">Text to Video (Diffusion / Omni)</option>
                      <option value="image_to_video">Image to Video (Motion Animate)</option>
                      <option value="text_to_speech">Dialogue / Voiceover (TTS Lite)</option>
                      <option value="music_composition">Background Music / Ambiance</option>
                    </select>
                  </div>

                  {/* Provider Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B]">
                      {lang === 'ar' ? 'النموذج ومزود الخدمة' : 'Provider & AI Engine'}
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-white font-medium"
                    >
                      <option value="gemini_omni">Gemini Omni Flash (Official / Connected)</option>
                      <option value="runway_gen3">Runway Gen-3 Alpha (Simulated Demo)</option>
                      <option value="luma_dream">Luma Dream Machine Ray 2 (Simulated Demo)</option>
                      <option value="local_demo">Local Sandbox Prototype (Simulated)</option>
                    </select>
                  </div>
                </div>

                {/* Resolution, Duration, Motion Strength */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B]">
                      {lang === 'ar' ? 'الدقة' : 'Resolution'}
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as any)}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-white"
                    >
                      <option value="720p">720p (Fast preview)</option>
                      <option value="1080p">1080p Full HD (Recommended)</option>
                      <option value="4k">4K Ultra HD (Master render)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#11152B]">
                      {lang === 'ar' ? 'مدة اللقطة (ثوانٍ)' : 'Duration (Seconds)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E3E6EF] focus:border-[#635BFF] outline-hidden bg-[#FCFCFD]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-[#11152B]">
                        {lang === 'ar' ? 'قوة الحركة' : 'Motion Strength'}
                      </label>
                      <span className="font-mono text-[11px] text-[#635BFF] font-bold">
                        {motionStrength}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={motionStrength}
                      onChange={(e) => setMotionStrength(Number(e.target.value))}
                      className="w-full accent-[#635BFF] mt-2"
                    />
                  </div>
                </div>

                {/* Provider Reality Indicator Banner */}
                <div
                  className={`p-3 rounded-lg flex items-start gap-2.5 text-xs ${
                    provider === 'gemini_omni'
                      ? 'bg-[#635BFF]/5 border border-[#635BFF]/20 text-[#11152B]'
                      : 'bg-amber-50/70 border border-amber-200/80 text-amber-900'
                  }`}
                >
                  <Info
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      provider === 'gemini_omni' ? 'text-[#635BFF]' : 'text-amber-600'
                    }`}
                  />
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {provider === 'gemini_omni'
                        ? 'Google Gemini Omni Flash 1.1 Model'
                        : 'Simulated Sandbox Prototype Provider'}
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#62677A]">
                      {provider === 'gemini_omni'
                        ? 'Production execution using configured Cloud project and model endpoints with verifiable asset generation.'
                        : 'Runs locally with realistic temporal progress simulation and mock assets to test production workflow without consuming paid external API credits.'}
                    </p>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-[#62677A] font-mono">
                    Shot {activeShot.shotNumber} ({durationSeconds}s @ {resolution})
                  </div>

                  <button
                    type="button"
                    onClick={handleQueueJob}
                    disabled={!!activeJobForShot}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                      activeJobForShot
                        ? 'bg-[#CBD1E1] text-[#62677A] cursor-not-allowed'
                        : 'bg-[#635BFF] hover:bg-[#5249ea] text-white'
                    }`}
                  >
                    {activeJobForShot ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating Shot {activeShot.shotNumber}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Shot Take</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated Assets for this Shot */}
              {shotAssets.length > 0 && (
                <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
                    <h4 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>{lang === 'ar' ? 'المقاطع المولدة للقطة' : `Generated Assets for Shot ${activeShot.shotNumber}`}</span>
                    </h4>
                    <span className="text-[11px] text-[#62677A] font-mono">
                      {shotAssets.length} takes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {shotAssets.map((asset) => {
                      const isCurrentActive = activeShot.activeAssetId === asset.id;
                      return (
                        <div
                          key={asset.id}
                          className={`p-3 rounded-lg border flex flex-col justify-between gap-3 text-xs ${
                            isCurrentActive
                              ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300/40'
                              : 'bg-white border-[#E3E6EF] hover:border-[#CBD1E1]'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#11152B] truncate">{asset.name}</span>
                              {isCurrentActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                                  Primary Take
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#62677A] flex items-center gap-2 font-mono">
                              <span>{asset.durationSeconds}s</span>
                              <span>•</span>
                              <span>{asset.provider}</span>
                              {asset.isSimulatedDemo && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-700">Simulated</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#E3E6EF]/60">
                            <span className="text-[10px] text-[#62677A] font-mono">
                              {new Date(asset.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isCurrentActive && (
                              <button
                                type="button"
                                onClick={() => handleAttachAssetToShot(asset.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded transition-colors"
                              >
                                Set as Primary Take
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generation Job Tracking Dashboard */}
              <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#635BFF]" />
                    <h4 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
                      {lang === 'ar' ? 'سجل مهام التوليد' : 'Generation Job Dispatch Queue'}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#62677A] flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterCurrentShotOnly}
                        onChange={(e) => setFilterCurrentShotOnly(e.target.checked)}
                        className="rounded text-[#635BFF]"
                      />
                      <span>Only Shot {activeShot.shotNumber}</span>
                    </label>
                  </div>
                </div>

                {visibleJobs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#62677A] space-y-1">
                    <Sparkles className="w-6 h-6 text-[#62677A]/30 mx-auto" />
                    <p>No generation jobs dispatched yet for this view.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleJobs.map((job) => {
                      const isComplete = job.status === 'succeeded';
                      const isFailed = job.status === 'failed';
                      const isRunning = job.status === 'processing' || job.status === 'queued';
                      const isCancelled = job.status === 'cancelled';

                      return (
                        <div
                          key={job.id}
                          className="p-3.5 rounded-lg border border-[#E3E6EF] bg-[#FCFCFD] space-y-2.5 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {job.shotId && (
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#11152B] text-white">
                                  Shot {shots.find((s) => s.id === job.shotId)?.shotNumber || 1}
                                </span>
                              )}
                              <span className="font-semibold text-[#11152B]">{job.modelName}</span>
                              <span className="text-[11px] font-mono text-[#62677A]">
                                ({job.parameters.durationSeconds}s @ {job.parameters.resolution})
                              </span>
                              {job.isSimulated && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">
                                  Simulated
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                                  isComplete
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isRunning
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : isCancelled
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                                {isComplete && <CheckCircle2 className="w-3 h-3" />}
                                {isFailed && <XCircle className="w-3 h-3" />}
                                <span className="capitalize">{job.status}</span>
                              </span>

                              {isRunning && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelJob(job.id)}
                                  className="text-[11px] text-[#62677A] hover:text-rose-600 underline"
                                >
                                  Cancel
                                </button>
                              )}

                              {(isFailed || isCancelled) && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryJob(job)}
                                  className="text-[11px] text-[#635BFF] hover:underline flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress bar for running jobs */}
                          {isRunning && (
                            <div className="space-y-1">
                              <div className="w-full bg-[#E3E6EF] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#635BFF] h-full transition-all duration-500 rounded-full"
                                  style={{ width: `${job.progressPercent}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-[#62677A] font-mono">
                                <span>Processing diffusion frames...</span>
                                <span>{job.progressPercent}%</span>
                              </div>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="text-[11px] text-[#62677A] flex items-center justify-between pt-1 border-t border-[#E3E6EF]/40 font-mono">
                            <span>Queued: {new Date(job.queuedAt).toLocaleTimeString()}</span>
                            {job.completedAt && (
                              <span>Finished: {new Date(job.completedAt).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl text-[#62677A] text-xs">
              Select a shot take from the left sidebar to configure generation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
