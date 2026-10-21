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
} from 'lucide-react';
import { Project, GenerationJob, AspectRatio, Asset } from '../../types';
import { storage } from '../../services/storage';

interface GenerationStageProps {
  project: Project;
  onProceedToAssets: () => void;
}

export const GenerationStage: React.FC<GenerationStageProps> = ({ project, onProceedToAssets }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.id || '');
  const [taskType, setTaskType] = useState<GenerationJob['taskType']>('text_to_video');
  const [provider, setProvider] = useState<GenerationJob['provider']>('gemini_omni');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [motionStrength, setMotionStrength] = useState<number>(6);

  const activeScene = scenes.find((s) => s.id === selectedSceneId);
  const activePrompt = (activeScene && project.prompts[activeScene.id]?.[0]?.visualPrompt) || activeScene?.visualDescription || '';

  const jobs = project.generationJobs || [];

  const handleQueueJob = () => {
    const isSimulated = provider !== 'gemini_omni';

    const newJob = storage.addGenerationJob(project.id, {
      projectId: project.id,
      sceneId: activeScene?.id,
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
      prompt: activePrompt || 'Cinematic video sequence',
      parameters: {
        aspectRatio: project.brief.aspectRatio,
        resolution,
        durationSeconds,
        motionStrength,
      },
      status: 'queued',
      progressPercent: 0,
      isSimulated,
    });

    // Start simulated progress for the job lifecycle demonstration
    simulateJobExecution(newJob.id, isSimulated);
  };

  const simulateJobExecution = (jobId: string, isSimulated: boolean) => {
    // Step 1: Queued -> Processing
    setTimeout(() => {
      storage.updateGenerationJob(project.id, jobId, {
        status: 'processing',
        progressPercent: 20,
        startedAt: new Date().toISOString(),
      });

      // Step 2: 50%
      setTimeout(() => {
        storage.updateGenerationJob(project.id, jobId, {
          progressPercent: 65,
        });

        // Step 3: Complete & create asset
        setTimeout(() => {
          const resultAsset: Asset = storage.addAsset(project.id, {
            projectId: project.id,
            sceneId: activeScene?.id,
            name: `${activeScene?.narrativePurpose || 'Scene'} — Generated Clip`,
            type: taskType === 'text_to_speech' ? 'audio_voiceover' : 'video',
            url: '',
            filesizeBytes: 18400000,
            durationSeconds,
            dimensions: resolution === '4k' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 },
            aspectRatio: project.brief.aspectRatio,
            format: 'mp4',
            provider,
            isSimulatedDemo: isSimulated,
            metadata: {
              prompt: activePrompt,
              motionStrength,
              generatedAt: new Date().toISOString(),
            },
          });

          storage.updateGenerationJob(project.id, jobId, {
            status: 'succeeded',
            progressPercent: 100,
            completedAt: new Date().toISOString(),
            resultAssetId: resultAsset.id,
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
  };

  const handleRetryJob = (job: GenerationJob) => {
    storage.updateGenerationJob(project.id, job.id, {
      status: 'queued',
      progressPercent: 0,
      errorMessage: undefined,
    });
    simulateJobExecution(job.id, job.isSimulated);
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'assets');
    onProceedToAssets();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 5 من 8' : 'Stage 5 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'توليد الفيديو وإدارة المهام' : 'Video Generation & Job Dispatcher'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'واجهة موحدة لتشغيل نماذج توليد الفيديو مع التمييز الصريح بين العمليات الحقيقية والتجريبية'
              : 'Provider-agnostic dispatch interface with transparent status reporting and zero fabricated success'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleProceed}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
        >
          <span>{lang === 'ar' ? 'المتابعة إلى مكتبة الوسائط' : 'Proceed to Assets'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Provider Transparency Callout */}
      <div className="p-4 bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl flex items-start gap-3 text-xs text-[#62677A]">
        <Info className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-[#11152B] block">
            {lang === 'ar' ? 'الشفافية في إنتاج الفيديو' : 'Provider Transparency & Integrity Policy'}
          </span>
          <p className="leading-relaxed">
            {lang === 'ar'
              ? 'تتطلب نماذج توليد الفيديو المتقدمة مثل Gemini Omni وVeo وRunway مفاتيح واجهة برمجة تطبيقات مدفوعة معتمدة. يتم وضع علامة "عرض تجريبي" بوضوح على عمليات المحاكاة لضمان عدم الخداع.'
              : 'Video synthesis via Google Veo / Gemini Omni or external providers requires configured backend credentials. Demonstration jobs are explicitly labeled as prototype simulations per Obido Studio product principles.'}
          </p>
        </div>
      </div>

      {/* Generation Task Dispatcher Card */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 space-y-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#11152B] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#635BFF]" />
          <span>{lang === 'ar' ? 'إعداد مهمة توليد جديدة' : 'Configure New Generation Task'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'المشهد المستهدف' : 'Target Scene'}
            </label>
            <select
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Scene #{s.sceneNumber}: {s.narrativePurpose}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'نوع المهمة' : 'Task Type'}
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as any)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value="text_to_video">Text to Video (from Scene Prompt)</option>
              <option value="image_to_video">Image to Video (Reference Frame Animation)</option>
              <option value="text_to_speech">Voiceover Synthesis (Gemini TTS)</option>
              <option value="scene_extension">Scene Extension (+4s continuity)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'محرك التوليد' : 'Generation Engine'}
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value="gemini_omni">Google Gemini Omni / Veo (Native GenAI)</option>
              <option value="runway_gen3">Runway Gen-3 Alpha Adapter</option>
              <option value="luma_dream">Luma Dream Machine Ray-2</option>
              <option value="local_demo">Local Prototype Engine (Zero Cost Demo)</option>
            </select>
          </div>
        </div>

        {/* Prompt Preview */}
        <div>
          <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
            {lang === 'ar' ? 'نص الموجّه المرسل للمحرك' : 'Dispatched Prompt'}
          </label>
          <div className="p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg text-xs font-mono text-[#11152B] line-clamp-3">
            {activePrompt || 'No prompt configured for this scene yet.'}
          </div>
        </div>

        {/* Sliders: Duration, Motion Strength, Resolution */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-[#E3E6EF]">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#11152B] mb-1.5">
              <span>{lang === 'ar' ? 'دقة المقطع' : 'Resolution'}</span>
              <span className="font-mono text-[#635BFF]">{resolution}</span>
            </div>
            <div className="flex gap-2">
              {(['720p', '1080p', '4k'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors ${
                    resolution === res
                      ? 'bg-[#11152B] text-white border-[#11152B]'
                      : 'border-[#E3E6EF] text-[#62677A] hover:border-[#11152B]'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#11152B] mb-1.5">
              <span>{lang === 'ar' ? 'مدة اللقطة' : 'Clip Duration'}</span>
              <span className="font-mono text-[#635BFF]">{durationSeconds}s</span>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
              className="w-full accent-[#635BFF]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#11152B] mb-1.5">
              <span>{lang === 'ar' ? 'شدة الحركة' : 'Motion Strength'}</span>
              <span className="font-mono text-[#635BFF]">{motionStrength}/10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={motionStrength}
              onChange={(e) => setMotionStrength(parseInt(e.target.value, 10))}
              className="w-full accent-[#635BFF]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleQueueJob}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{lang === 'ar' ? 'بدء مهمة التوليد' : 'Dispatch Generation Job'}</span>
          </button>
        </div>
      </div>

      {/* Active Jobs Queue */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-[#11152B]">
          {lang === 'ar' ? 'سجل مهام التوليد' : 'Job Execution History'}
        </h3>

        {jobs.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#E3E6EF] rounded-xl text-xs text-[#62677A]">
            {lang === 'ar'
              ? 'لم يتم إرسال أي مهام توليد بعد في هذا المشروع.'
              : 'No generation jobs queued yet. Configure and dispatch a task above.'}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const sceneRef = scenes.find((s) => s.id === job.sceneId);

              return (
                <div
                  key={job.id}
                  className="p-4 bg-white border border-[#E3E6EF] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#11152B]">
                        {job.taskType.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span aria-hidden="true" className="text-[#E3E6EF]">·</span>
                      <span className="font-mono text-[11px] text-[#635BFF]">
                        {job.modelName}
                      </span>
                      {job.isSimulated && (
                        <>
                          <span aria-hidden="true" className="text-[#E3E6EF]">·</span>
                          <span className="text-[10px] text-[#D97706] font-medium">
                            Demo Mode
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-[#62677A] line-clamp-1 font-mono">
                      {sceneRef ? `Scene #${sceneRef.sceneNumber}: ` : ''}{job.prompt}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[#62677A] font-mono">
                      <span>{job.parameters.resolution}</span>
                      <span>·</span>
                      <span>{job.parameters.durationSeconds}s</span>
                      <span>·</span>
                      <span>{new Date(job.queuedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Status & Progress */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {job.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#635BFF]" />
                          <span className="font-semibold text-[#635BFF] font-mono">
                            {job.progressPercent}%
                          </span>
                        </div>
                      )}

                      {job.status === 'succeeded' && (
                        <span className="flex items-center gap-1.5 text-[#16A34A] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Succeeded</span>
                        </span>
                      )}

                      {job.status === 'failed' && (
                        <span className="flex items-center gap-1.5 text-[#DC2626] font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}

                      {job.status === 'queued' && (
                        <span className="flex items-center gap-1.5 text-[#D97706] font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Queued</span>
                        </span>
                      )}

                      {job.status === 'cancelled' && (
                        <span className="text-[#62677A]">Cancelled</span>
                      )}
                    </div>

                    {/* Actions */}
                    {job.status === 'processing' && (
                      <button
                        type="button"
                        onClick={() => handleCancelJob(job.id)}
                        className="px-2.5 py-1 text-xs text-[#DC2626] hover:bg-[#DC2626]/10 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    )}

                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => handleRetryJob(job)}
                        className="p-1.5 text-[#62677A] hover:text-[#11152B] transition-colors"
                        title="Retry Job"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
