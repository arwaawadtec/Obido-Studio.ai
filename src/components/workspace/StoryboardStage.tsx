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
  Camera,
  Volume2,
  FileText,
  AlertCircle,
  Check,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Project, Scene } from '../../types';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/apiClient';
import { AppError } from '../../types/error';
import { mapApiError } from '../../services/errorService';
import { GlobalErrorCard } from '../common/GlobalErrorCard';

interface StoryboardStageProps {
  project: Project;
  onProceedToPrompts: () => void;
}

export const StoryboardStage: React.FC<StoryboardStageProps> = ({ project, onProceedToPrompts }) => {
  const lang = storage.getLanguagePreference();

  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorObj, setErrorObj] = useState<AppError | null>(null);

  const scenes = project.scenes || [];
  const targetDurationSec = project.brief.targetDurationSeconds;
  const totalPlannedDuration = scenes.reduce((sum, s) => sum + (s.estimatedDurationSeconds || 0), 0);
  const durationDiff = totalPlannedDuration - targetDurationSec;

  const handleGenerateFromScript = async () => {
    const currentScript = project.scripts.find((s) => s.id === project.currentScriptId) || project.scripts[0];
    const scriptText = currentScript?.fullText || project.brief.rawIdea;

    if (!scriptText?.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'الرجاء كتابة سيناريو أولاً لتوليد لوحة القصة'
          : 'Please draft or generate a script in Stage 2 first'
      );
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setFeedback(null);

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
          fallbackWhat: 'AI Storyboard decomposition',
        });
        setErrorObj(mapped);
        return;
      }

      if (data.scenes && Array.isArray(data.scenes)) {
        const newScenes: Scene[] = data.scenes.map((s: any, idx: number) => ({
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

        storage.updateProject(project.id, { scenes: newScenes });
        setFeedback(
          lang === 'ar'
            ? `تم توليد ${newScenes.length} مشاهد متتالية بنجاح`
            : `Generated ${newScenes.length} storyboard scenes successfully`
        );
      }
    } catch (err: any) {
      console.error('Storyboard generation error:', err);
      setErrorMsg(
        err.message ||
          (lang === 'ar' ? 'فشل توليد لوحة القصة بالذكاء الاصطناعي' : 'Failed to generate storyboard from script')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddScene = () => {
    const nextNum = scenes.length + 1;
    storage.addScene(project.id, {
      narrativePurpose: `Scene ${nextNum} narrative progression`,
      estimatedDurationSeconds: 10,
      visualDescription: '',
      narrationDialogue: '',
      audioCues: 'Ambient tone and sound design',
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
      estimatedDurationSeconds: scene.estimatedDurationSeconds,
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
    storage.setWorkflowStage(project.id, 'prompts');
    onProceedToPrompts();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 3 من 8' : 'Stage 3 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'لوحة القصة وتسلسل المشاهد' : 'Storyboard & Scene Architecture'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'تقسيم الفيديو إلى لقطات متتالية محددة بالزمن، وتكوين الكاميرا، والوصف البصري'
              : 'Structure consecutive scenes with exact duration allocation, framing, dialogue, and camera descriptions'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddScene}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إضافة مشهد' : 'Add Scene'}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى الموجهات' : 'Proceed to Prompts'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Storyboard Decomposition Bar */}
      <div className="p-4 bg-[#635BFF]/5 border border-[#635BFF]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-xs font-bold text-[#11152B]">
              {lang === 'ar' ? 'توليد لوحة القصة آلياً من السيناريو' : 'Decompose Script into Storyboard'}
            </h3>
          </div>
          <p className="text-xs text-[#62677A]">
            {lang === 'ar'
              ? 'يستخدم Gemini لتحليل السيناريو وتوزيعه على لقطات مع ضبط زوايا الكاميرا وتوقيت الثواني'
              : 'Uses Gemini to dissect your script into ordered scenes, duration weights, and cinematography cues'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateFromScript}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{lang === 'ar' ? 'جارٍ تحليل المشاهد...' : 'Decomposing Script...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#38D9F9]" />
              <span>{lang === 'ar' ? 'توليد لوحة القصة بالذكاء الاصطناعي' : 'Generate from Script'}</span>
            </>
          )}
        </button>
      </div>

      {errorObj && (
        <GlobalErrorCard
          error={errorObj}
          onRetry={handleGenerateFromScript}
          onDismiss={() => setErrorObj(null)}
          lang={lang}
        />
      )}

      {errorMsg && !errorObj && (
        <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-xs text-[#DC2626] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-lg text-xs text-[#16A34A] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Duration Validation Bar */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'إجمالي المشاهد' : 'Total Scenes'}</span>
            <span className="text-sm font-bold text-[#11152B] font-mono tabular-nums">{scenes.length}</span>
          </div>
          <div>
            <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'المدة المخططة' : 'Planned Duration'}</span>
            <span className="text-sm font-bold text-[#11152B] font-mono tabular-nums">{totalPlannedDuration}s</span>
          </div>
          <div>
            <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'الهدف المطلوب' : 'Target Duration'}</span>
            <span className="text-sm font-bold text-[#635BFF] font-mono tabular-nums">{targetDurationSec}s</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`font-semibold ${
              durationDiff === 0
                ? 'text-[#16A34A]'
                : Math.abs(durationDiff) <= 3
                ? 'text-[#16A34A]'
                : 'text-[#D97706]'
            }`}
          >
            {durationDiff === 0
              ? (lang === 'ar' ? '✓ التوقيت مطابق تماماً' : '✓ Exact duration match')
              : durationDiff > 0
              ? (lang === 'ar' ? `+${durationDiff} ثانية عن الهدف` : `+${durationDiff}s over target duration`)
              : (lang === 'ar' ? `${durationDiff} ثانية عن الهدف` : `${durationDiff}s under target duration`)}
          </span>
        </div>
      </div>

      {/* Scenes List */}
      {scenes.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
          <Camera className="w-10 h-10 text-[#62677A]/40 mx-auto" />
          <h3 className="text-sm font-semibold text-[#11152B]">
            {lang === 'ar' ? 'لا توجد مشاهد بعد' : 'No scenes created yet'}
          </h3>
          <p className="text-xs text-[#62677A] max-w-sm mx-auto">
            {lang === 'ar'
              ? 'اضغط على "توليد لوحة القصة بالذكاء الاصطناعي" لتحويل السيناريو تلقائياً، أو أضف مشاهد يدوياً.'
              : 'Generate scenes from your script using Gemini, or add scenes manually to begin storyboard planning.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleGenerateFromScript}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg transition-colors"
            >
              {lang === 'ar' ? 'توليد بالذكاء الاصطناعي' : 'Generate with AI'}
            </button>
            <button
              onClick={handleAddScene}
              className="px-4 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
            >
              {lang === 'ar' ? 'إضافة مشهد يدوياً' : 'Add Scene Manually'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene, index) => {
            return (
              <div
                key={scene.id}
                className="bg-white border border-[#E3E6EF] hover:border-[#D1D5E5] rounded-xl p-5 space-y-4 transition-all shadow-xs"
              >
                {/* Scene Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E6EF]/70">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-md bg-[#11152B] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      #{scene.sceneNumber}
                    </span>

                    <input
                      type="text"
                      value={scene.narrativePurpose}
                      onChange={(e) => handleUpdateScene(scene.id, { narrativePurpose: e.target.value })}
                      placeholder="Narrative purpose of this scene..."
                      className="text-sm font-bold text-[#11152B] bg-transparent border-b border-transparent hover:border-[#E3E6EF] focus:border-[#635BFF] focus:outline-none transition-colors w-full sm:w-80"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Camera Framing Selector */}
                    <select
                      value={scene.cameraFraming}
                      onChange={(e) => handleUpdateScene(scene.id, { cameraFraming: e.target.value as any })}
                      className="text-xs px-2.5 py-1 bg-[#F6F7FB] border border-[#E3E6EF] rounded-md text-[#11152B] font-medium"
                    >
                      <option value="Wide establishing">Wide establishing</option>
                      <option value="Medium shot">Medium shot</option>
                      <option value="Close-up">Close-up</option>
                      <option value="Over-the-shoulder">Over-the-shoulder</option>
                      <option value="POV / Macro">POV / Macro</option>
                      <option value="Dynamic tracking">Dynamic tracking</option>
                    </select>

                    {/* Duration input */}
                    <div className="flex items-center gap-1 bg-[#F6F7FB] border border-[#E3E6EF] px-2 py-1 rounded-md text-xs font-mono">
                      <Clock className="w-3 h-3 text-[#62677A]" />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={scene.estimatedDurationSeconds}
                        onChange={(e) =>
                          handleUpdateScene(scene.id, { estimatedDurationSeconds: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-10 bg-transparent text-center font-semibold text-[#11152B] focus:outline-none"
                      />
                      <span className="text-[#62677A]">s</span>
                    </div>

                    {/* Reordering */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveScene(index, 'up')}
                      className="p-1 text-[#62677A] hover:text-[#11152B] disabled:opacity-30 transition-colors"
                      title="Move Scene Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === scenes.length - 1}
                      onClick={() => handleMoveScene(index, 'down')}
                      className="p-1 text-[#62677A] hover:text-[#11152B] disabled:opacity-30 transition-colors"
                      title="Move Scene Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Duplicate & Delete */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateScene(scene)}
                      className="p-1 text-[#62677A] hover:text-[#11152B] transition-colors"
                      title="Duplicate Scene"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(scene.id)}
                      className="p-1 text-[#62677A] hover:text-[#DC2626] transition-colors"
                      title="Delete Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scene Content Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Visual Description & Reference Frame */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#11152B] mb-1">
                        {lang === 'ar' ? 'الوصف البصري وحركة المشهد' : 'Visual Description & Action'}
                      </label>
                      <textarea
                        value={scene.visualDescription}
                        onChange={(e) => handleUpdateScene(scene.id, { visualDescription: e.target.value })}
                        rows={3}
                        placeholder="Detailed visual action, camera motion, characters, environment..."
                        className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#11152B] mb-1">
                          {lang === 'ar' ? 'التعليق الصوتي / الحوار' : 'Narration / Dialogue'}
                        </label>
                        <textarea
                          value={scene.narrationDialogue}
                          onChange={(e) => handleUpdateScene(scene.id, { narrationDialogue: e.target.value })}
                          rows={2}
                          placeholder="Exact spoken words for voiceover or characters..."
                          className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#11152B] mb-1">
                          {lang === 'ar' ? 'الإشارات والمؤثرات الصوتية' : 'Audio & SFX Cues'}
                        </label>
                        <textarea
                          value={scene.audioCues}
                          onChange={(e) => handleUpdateScene(scene.id, { audioCues: e.target.value })}
                          rows={2}
                          placeholder="Ambient sounds, musical cues, Foley..."
                          className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reference Frame Preview Box (Honest placeholder per rule) */}
                  <div className="p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#11152B]">
                          {lang === 'ar' ? 'إطار المرجع البصري' : 'Scene Reference Frame'}
                        </span>
                        <span className="text-[10px] text-[#62677A] font-mono">
                          {project.brief.aspectRatio}
                        </span>
                      </div>

                      {/* Reference Frame Container with stylized artwork */}
                      <div className="aspect-video w-full rounded-md bg-[#11152B] border border-[#E3E6EF] flex flex-col items-center justify-center p-3 text-center text-white relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#635BFF]/30 via-transparent to-[#38D9F9]/20" />
                        <div className="relative z-10 flex flex-col items-center">
                          <Camera className="w-6 h-6 text-[#38D9F9] mb-1" />
                          <span className="text-[11px] font-semibold text-white">
                            {scene.cameraFraming}
                          </span>
                          <span className="text-[9px] text-[#E3E6EF]/70 font-mono mt-0.5">
                            {scene.estimatedDurationSeconds}s · Scene #{scene.sceneNumber}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-[#62677A] text-center">
                      <span>{lang === 'ar' ? 'عنصر نائب للمرجع البصري (غير مولّد بعد)' : 'Visual Reference Placeholder (Unrendered)'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
