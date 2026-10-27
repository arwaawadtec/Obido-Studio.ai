import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Clock,
  Layers,
  FileText,
  AlertCircle,
  Check,
  Loader2,
  Sliders,
  Volume2,
} from 'lucide-react';
import { Project, Scene } from '../../types';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/apiClient';
import { AppError } from '../../types/error';
import { mapApiError } from '../../services/errorService';
import { GlobalErrorCard } from '../common/GlobalErrorCard';
import { migrateProjectToShots } from '../../services/shotMigration';

interface ScenesStageProps {
  project: Project;
  onProceedToShots: () => void;
}

export const ScenesStage: React.FC<ScenesStageProps> = ({ project, onProceedToShots }) => {
  const lang = storage.getLanguagePreference();

  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorObj, setErrorObj] = useState<AppError | null>(null);

  const scenes = project.scenes || [];
  const targetDurationSec = project.brief.targetDurationSeconds || 60;
  const totalPlannedDuration = scenes.reduce(
    (sum, s) => sum + (Number(s.totalDurationSeconds || s.estimatedDurationSeconds) || 0),
    0
  );
  const durationDiff = totalPlannedDuration - targetDurationSec;

  const handleGenerateFromScript = async () => {
    const currentScript = project.scripts.find((s) => s.id === project.currentScriptId) || project.scripts[0];
    const scriptText = currentScript?.fullText || project.brief.rawIdea;

    if (!scriptText?.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'الرجاء كتابة سيناريو أولاً لتفكيك المشاهد السردية'
          : 'Please draft or generate a script in Stage 2 before decomposing scenes'
      );
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setFeedback(null);
    setErrorObj(null);

    try {
      const res = await authenticatedFetch('/api/ai/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText,
          brief: project.brief,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const mapped = mapApiError(data, res.status, {
          stage: 'storyboard',
          fallbackWhat: 'AI Narrative Scene breakdown',
        });
        setErrorObj(mapped);
        return;
      }

      if (data.scenes && Array.isArray(data.scenes)) {
        const rawScenes: Scene[] = data.scenes.map((s: any, idx: number) => ({
          id: 'sc_' + Math.random().toString(36).substring(2, 8),
          sceneNumber: idx + 1,
          narrativePurpose: s.narrativePurpose || `Scene ${idx + 1}`,
          estimatedDurationSeconds: Number(s.estimatedDurationSeconds) || 10,
          visualDescription: s.visualDescription || '',
          narrationDialogue: s.narrationDialogue || '',
          audioCues: s.audioCues || 'Ambient background audio',
          cameraFraming: s.cameraFraming || 'Medium shot',
          status: 'ready_for_prompt',
        }));

        const migrated = migrateProjectToShots({
          ...project,
          scenes: rawScenes,
          shots: project.shots || [],
        });

        storage.updateProject(project.id, {
          scenes: migrated.scenes,
          shots: migrated.shots,
        });

        setFeedback(
          lang === 'ar'
            ? `تم تفكيك ${migrated.scenes.length} مشهداً سردياً بنجاح`
            : `Decomposed script into ${migrated.scenes.length} narrative scenes successfully`
        );
      }
    } catch (err: any) {
      console.error('[ScenesStage] Scene generation error:', err);
      setErrorMsg(
        err.message ||
          (lang === 'ar' ? 'فشل تفكيك المشاهد بالذكاء الاصطناعي' : 'Failed to decompose scenes from script')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddScene = () => {
    const nextNum = scenes.length + 1;
    storage.addScene(project.id, {
      narrativePurpose: `Scene ${nextNum}: Narrative Beat`,
      estimatedDurationSeconds: 10,
      visualDescription: '',
      narrationDialogue: '',
      audioCues: 'Ambient atmospheric tone',
      cameraFraming: 'Medium shot',
      status: 'draft',
    });
  };

  const handleUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
    storage.updateScene(project.id, sceneId, updates);
  };

  const handleDeleteScene = (sceneId: string) => {
    storage.deleteScene(project.id, sceneId);
  };

  const handleDuplicateScene = (scene: Scene) => {
    storage.addScene(project.id, {
      narrativePurpose: `${scene.narrativePurpose} (Copy)`,
      estimatedDurationSeconds: scene.totalDurationSeconds || scene.estimatedDurationSeconds,
      visualDescription: scene.visualDescription,
      narrationDialogue: scene.narrationDialogue,
      audioCues: scene.audioCues,
      cameraFraming: scene.cameraFraming,
      status: 'draft',
    });
  };

  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < scenes.length) {
      storage.reorderScenes(project.id, index, targetIndex);
    }
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'shots');
    onProceedToShots();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 3 من 10' : 'Stage 3 of 10'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'بنية المشاهد السردية' : 'Narrative Scenes Architecture'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'تقسيم القصة إلى فصول ومشاهد رئيسية وتحديد الأهداف السردية والزمن المستهدف لكل مشهد'
              : 'Structure narrative scene beats, scene intent, duration targets, and story progression'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddScene}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إضافة مشهد' : 'Add Scene'}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى قائمة اللقطات' : 'Proceed to Shot List'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Scene Breakdown Action Bar */}
      <div className="p-4 bg-[#635BFF]/5 border border-[#635BFF]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
              {lang === 'ar' ? 'تفكيك السيناريو إلى مشاهد بالذكاء الاصطناعي' : 'AI Screenplay Scene Decomposition'}
            </h3>
          </div>
          <p className="text-xs text-[#62677A]">
            {lang === 'ar'
              ? 'تحليل السيناريو الحالي واستخراج المشاهد مع مواءمة الإيقاع والمدة الزمنية'
              : 'Automatically extract narrative scenes, visual intent, and pacing from your current script.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateFromScript}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#232742] rounded-lg transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{lang === 'ar' ? 'جاري التحليل...' : 'Decomposing...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#38D9F9]" />
              <span>{lang === 'ar' ? 'تفكيك السيناريو' : 'Decompose Script'}</span>
            </>
          )}
        </button>
      </div>

      {/* Global Error Banner */}
      {errorObj && (
        <GlobalErrorCard error={errorObj} onDismiss={() => setErrorObj(null)} />
      )}

      {/* Feedback & General Error messages */}
      {feedback && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && !errorObj && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pacing Overview Banner */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#62677A]">
              {lang === 'ar' ? 'عدد المشاهد' : 'Scenes Count'}
            </span>
            <div className="text-lg font-bold text-[#11152B] font-mono">
              {scenes.length}
            </div>
          </div>

          <div className="h-8 w-px bg-[#E3E6EF]" />

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#62677A]">
              {lang === 'ar' ? 'المدة الإجمالية المخططة' : 'Total Planned Duration'}
            </span>
            <div className="text-lg font-bold text-[#11152B] font-mono flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#635BFF]" />
              <span>{totalPlannedDuration}s</span>
              <span className="text-xs font-normal text-[#62677A]">/ {targetDurationSec}s target</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {Math.abs(durationDiff) <= 3 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">
              {lang === 'ar' ? '✓ إيقاع متوازن ومثالي' : '✓ Balanced Pacing'}
            </span>
          ) : durationDiff > 3 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {lang === 'ar' ? `+${durationDiff}ث زيادة عن المستهدف` : `+${durationDiff}s over target`}
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {lang === 'ar' ? `${Math.abs(durationDiff)}ث أقل من المستهدف` : `${Math.abs(durationDiff)}s under target`}
            </span>
          )}
        </div>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.map((scene, index) => {
          const sceneDuration = scene.totalDurationSeconds || scene.estimatedDurationSeconds || 10;
          const shotCount = (scene.shotIds?.length) || (project.shots?.filter((s) => s.sceneId === scene.id).length) || 0;

          return (
            <div
              key={scene.id}
              className="bg-white border border-[#E3E6EF] rounded-xl p-5 space-y-4 shadow-xs hover:border-[#CBD1E1] transition-all"
            >
              {/* Scene Card Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E6EF]">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#11152B] text-white">
                    {lang === 'ar' ? `مشهد ${index + 1}` : `Scene ${index + 1}`}
                  </span>
                  <input
                    type="text"
                    value={scene.narrativePurpose}
                    onChange={(e) => handleUpdateScene(scene.id, { narrativePurpose: e.target.value })}
                    placeholder={lang === 'ar' ? 'الهدف السردي للمشهد...' : 'Scene narrative purpose...'}
                    className="text-sm font-bold text-[#11152B] bg-transparent border-b border-transparent hover:border-[#CBD1E1] focus:border-[#635BFF] focus:outline-none transition-colors px-1 py-0.5 max-w-sm"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <div className="flex items-center gap-1 text-xs text-[#62677A] font-mono mr-2">
                    <span className="bg-[#F6F7FB] px-2 py-0.5 rounded border border-[#E3E6EF]">
                      {shotCount} {lang === 'ar' ? 'لقطات' : 'shots'}
                    </span>
                    <span className="bg-[#F6F7FB] px-2 py-0.5 rounded border border-[#E3E6EF]">
                      {sceneDuration}s
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMoveScene(index, 'up')}
                    disabled={index === 0}
                    title={lang === 'ar' ? 'تحريك لأعلى' : 'Move Up'}
                    className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMoveScene(index, 'down')}
                    disabled={index === scenes.length - 1}
                    title={lang === 'ar' ? 'تحريك لأسفل' : 'Move Down'}
                    className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicateScene(scene)}
                    title={lang === 'ar' ? 'تكرار المشهد' : 'Duplicate Scene'}
                    className="p-1.5 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteScene(scene.id)}
                    title={lang === 'ar' ? 'حذف المشهد' : 'Delete Scene'}
                    className="p-1.5 text-[#62677A] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scene Form Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Visual Description */}
                <div className="space-y-1">
                  <label className="font-semibold text-[#11152B] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>{lang === 'ar' ? 'الوصف البصري والبيئة' : 'Visual Setting & Action'}</span>
                  </label>
                  <textarea
                    rows={3}
                    value={scene.visualDescription}
                    onChange={(e) => handleUpdateScene(scene.id, { visualDescription: e.target.value })}
                    placeholder={
                      lang === 'ar'
                        ? 'صف البيئة، الإضاءة، وحركة الشخصيات داخل هذا المشهد...'
                        : 'Describe characters, environment, lighting, and action occurring in this scene...'
                    }
                    className="w-full p-2.5 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none resize-none"
                  />
                </div>

                {/* Narration / Dialogue */}
                <div className="space-y-1">
                  <label className="font-semibold text-[#11152B] flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-[#635BFF]" />
                    <span>{lang === 'ar' ? 'التعليق الصوتي / الحوار' : 'Voiceover & Dialogue'}</span>
                  </label>
                  <textarea
                    rows={3}
                    value={scene.narrationDialogue}
                    onChange={(e) => handleUpdateScene(scene.id, { narrationDialogue: e.target.value })}
                    placeholder={
                      lang === 'ar'
                        ? 'النص المنطوق أو الحوار الصوتي المرافق للمشهد...'
                        : 'Voiceover script or spoken dialogue synchronized with this scene...'
                    }
                    className="w-full p-2.5 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none resize-none"
                  />
                </div>

                {/* Camera Framing & Audio Cue Row */}
                <div className="space-y-1">
                  <label className="font-semibold text-[#11152B]">
                    {lang === 'ar' ? 'تأطير الكاميرا الرئيسي' : 'Primary Camera Framing'}
                  </label>
                  <select
                    value={scene.cameraFraming}
                    onChange={(e) => handleUpdateScene(scene.id, { cameraFraming: e.target.value as any })}
                    className="w-full p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none text-xs"
                  >
                    <option value="Wide establishing">Wide establishing</option>
                    <option value="Medium shot">Medium shot</option>
                    <option value="Close-up">Close-up</option>
                    <option value="Over-the-shoulder">Over-the-shoulder</option>
                    <option value="POV / Macro">POV / Macro</option>
                    <option value="Dynamic tracking">Dynamic tracking</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#11152B] flex items-center justify-between">
                    <span>{lang === 'ar' ? 'مدة المشهد التقديرية' : 'Estimated Duration'}</span>
                    <span className="font-mono text-[#635BFF]">{sceneDuration}s</span>
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={60}
                    step={1}
                    value={scene.estimatedDurationSeconds || 10}
                    onChange={(e) => handleUpdateScene(scene.id, { estimatedDurationSeconds: Number(e.target.value) })}
                    className="w-full accent-[#635BFF]"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {scenes.length === 0 && (
          <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
            <Layers className="w-10 h-10 text-[#62677A]/40 mx-auto" />
            <h3 className="text-sm font-semibold text-[#11152B]">
              {lang === 'ar' ? 'لا توجد مشاهد بعد' : 'No scenes created yet'}
            </h3>
            <p className="text-xs text-[#62677A] max-w-sm mx-auto">
              {lang === 'ar'
                ? 'استخدم تفكيك السيناريو التلقائي أو أضف مشهداً يدوياً للبدء في تنظيم بنية الفيديو.'
                : 'Decompose your screenplay using AI or click "Add Scene" to start structuring your narrative.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleAddScene}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة أول مشهد' : 'Add First Scene'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="pt-4 border-t border-[#E3E6EF] flex items-center justify-between">
        <div className="text-xs text-[#62677A]">
          {lang === 'ar'
            ? `${scenes.length} مشاهد سردية محددة`
            : `${scenes.length} narrative scenes organized`}
        </div>

        <button
          type="button"
          onClick={handleProceed}
          className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <span>{lang === 'ar' ? 'المتابعة إلى قائمة اللقطات (المرحلة 4)' : 'Proceed to Shot List (Stage 4)'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
