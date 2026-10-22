import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Save,
  Check,
  History,
  AlertCircle,
  Clock,
  Loader2,
  FileEdit,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { Project, ScriptVersion } from '../../types';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/apiClient';
import { AppError } from '../../types/error';
import { mapApiError } from '../../services/errorService';
import { GlobalErrorCard } from '../common/GlobalErrorCard';

interface ScriptStageProps {
  project: Project;
  onProceedToStoryboard: () => void;
}

export const ScriptStage: React.FC<ScriptStageProps> = ({ project, onProceedToStoryboard }) => {
  const lang = storage.getLanguagePreference();

  const currentScript =
    project.scripts.find((s) => s.id === project.currentScriptId) ||
    project.scripts[0] || {
      id: 'script_new',
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      title: project.title,
      logline: '',
      hook: '',
      fullText: '',
      estimatedSpeakingWords: 0,
      estimatedDurationSeconds: project.brief.targetDurationSeconds,
      isCurrent: true,
    };

  const [title, setTitle] = useState(currentScript.title || project.title);
  const [logline, setLogline] = useState(currentScript.logline || '');
  const [hook, setHook] = useState(currentScript.hook || '');
  const [fullText, setFullText] = useState(currentScript.fullText || '');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorObj, setErrorObj] = useState<AppError | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Compute live word count & speaking duration
  const words = fullText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  // Natural speaking pace: ~140 words per minute (2.33 words/sec)
  const computedDurationSec = Math.round((words / 140) * 60);
  const targetDurationSec = project.brief.targetDurationSeconds;
  const durationDelta = computedDurationSec - targetDurationSec;

  const handleGenerateScript = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authenticatedFetch('/api/ai/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          purpose: project.brief.purpose,
          targetAudience: project.brief.targetAudience,
          language: project.brief.language,
          aspectRatio: project.brief.aspectRatio,
          targetDurationSeconds: project.brief.targetDurationSeconds,
          visualStyle: project.brief.visualStyle,
          rawIdea: project.brief.rawIdea,
          toneOfVoice: project.brief.toneOfVoice,
          callToAction: project.brief.callToAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const mapped = mapApiError(data, res.status, {
          stage: 'script',
          fallbackWhat: 'AI Screenplay generation',
        });
        setErrorObj(mapped);
        return;
      }

      if (data.script) {
        const s = data.script;
        setTitle(s.title || title);
        setLogline(s.logline || '');
        setHook(s.hook || '');
        setFullText(s.fullText || '');

        // Save as new version
        const newVersionNum = project.scripts.length + 1;
        const newScriptId = 'script_v' + newVersionNum + '_' + Date.now().toString(36);
        const newScript: ScriptVersion = {
          id: newScriptId,
          versionNumber: newVersionNum,
          createdAt: new Date().toISOString(),
          title: s.title || title,
          logline: s.logline || '',
          hook: s.hook || '',
          fullText: s.fullText || '',
          estimatedSpeakingWords: s.estimatedSpeakingWords || words,
          estimatedDurationSeconds: s.estimatedDurationSeconds || computedDurationSec,
          isCurrent: true,
        };

        const updatedScripts = project.scripts.map((sc) => ({ ...sc, isCurrent: false }));
        updatedScripts.unshift(newScript);

        storage.updateProject(project.id, {
          scripts: updatedScripts,
          currentScriptId: newScriptId,
        });

        setSuccessMsg(lang === 'ar' ? 'تم إنشاء السيناريو وحفظ الإصدار الجديد' : 'New AI script version generated & saved');
      }
    } catch (err: any) {
      console.error('AI script generation error:', err);
      setErrorMsg(
        err.message ||
          (lang === 'ar'
            ? 'فشل الاتصال بمولد السيناريو. يمكنك كتابة النص يدوياً أدناه.'
            : 'AI script generation failed. You can write or edit manually below.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCurrentVersion = () => {
    setIsSaving(true);
    const existingIndex = project.scripts.findIndex((s) => s.id === project.currentScriptId);

    let updatedScripts = [...project.scripts];
    const updatedRecord: ScriptVersion = {
      id: currentScript.id || 'script_' + Date.now().toString(36),
      versionNumber: currentScript.versionNumber || 1,
      createdAt: new Date().toISOString(),
      title,
      logline,
      hook,
      fullText,
      estimatedSpeakingWords: words,
      estimatedDurationSeconds: computedDurationSec,
      isCurrent: true,
    };

    if (existingIndex >= 0) {
      updatedScripts[existingIndex] = updatedRecord;
    } else {
      updatedScripts.unshift(updatedRecord);
    }

    storage.updateProject(project.id, {
      scripts: updatedScripts,
      currentScriptId: updatedRecord.id,
    });

    setTimeout(() => {
      setIsSaving(false);
      setSuccessMsg(lang === 'ar' ? 'تم حفظ التعديلات' : 'Saved version changes');
      setTimeout(() => setSuccessMsg(null), 2500);
    }, 200);
  };

  const handleSelectVersion = (versionId: string) => {
    const target = project.scripts.find((s) => s.id === versionId);
    if (target) {
      setTitle(target.title);
      setLogline(target.logline);
      setHook(target.hook);
      setFullText(target.fullText);

      const updated = project.scripts.map((s) => ({
        ...s,
        isCurrent: s.id === versionId,
      }));

      storage.updateProject(project.id, {
        scripts: updated,
        currentScriptId: versionId,
      });
    }
  };

  const handleProceed = () => {
    handleSaveCurrentVersion();
    storage.setWorkflowStage(project.id, 'storyboard');
    onProceedToStoryboard();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 2 من 8' : 'Stage 2 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'السيناريو والسرد الصوتي' : 'Screenplay & Narrative Script'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'صياغة بنية المشاهد، ومعدل الكلمات، والخطاف الجاذب، ونصوص التعليق الصوتي الموجهة'
              : 'Draft pacing, voiceover narrative, scene timings, and high-retention opening hooks'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveCurrentVersion}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{lang === 'ar' ? 'حفظ المسودة' : 'Save Script'}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى لوحة القصة' : 'Proceed to Storyboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Script Generation Bar */}
      <div className="p-4 bg-[#635BFF]/5 border border-[#635BFF]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-xs font-bold text-[#11152B]">
              {lang === 'ar' ? 'توليد سيناريو احترافي بالذكاء الاصطناعي' : 'Gemini 3.8 Flash Scriptwriter'}
            </h3>
          </div>
          <p className="text-xs text-[#62677A]">
            {lang === 'ar'
              ? `يبني نصاً متوافقاً مع هدف "${project.brief.purpose}" ومدته ${project.brief.targetDurationSeconds} ثانية`
              : `Synthesizes a timed screenplay calibrated for ${project.brief.targetDurationSeconds}s (${project.brief.purpose})`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateScript}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{lang === 'ar' ? 'جارٍ كتابة السيناريو...' : 'Drafting Screenplay...'}</span>
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5 text-[#38D9F9]" />
              <span>{lang === 'ar' ? 'توليد سيناريو جديد' : 'Generate AI Script'}</span>
            </>
          )}
        </button>
      </div>

      {errorObj && (
        <GlobalErrorCard
          error={errorObj}
          onRetry={handleGenerateScript}
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

      {successMsg && (
        <div className="p-3 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-lg text-xs text-[#16A34A] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Script Pacing Metrics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-[#E3E6EF] rounded-xl p-4 text-xs">
        <div>
          <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'عدد الكلمات' : 'Word Count'}</span>
          <span className="text-base font-bold text-[#11152B] font-mono tabular-nums">{words} words</span>
        </div>
        <div>
          <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'المدة التقديرية' : 'Estimated Duration'}</span>
          <span className="text-base font-bold text-[#11152B] font-mono tabular-nums">{computedDurationSec}s</span>
        </div>
        <div>
          <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'الهدف المحدد' : 'Target Target'}</span>
          <span className="text-base font-bold text-[#635BFF] font-mono tabular-nums">{targetDurationSec}s</span>
        </div>
        <div>
          <span className="text-[#62677A] text-[11px] block">{lang === 'ar' ? 'حالة التوقيت' : 'Pacing Status'}</span>
          <span
            className={`text-xs font-semibold ${
              Math.abs(durationDelta) <= 5
                ? 'text-[#16A34A]'
                : durationDelta > 5
                ? 'text-[#D97706]'
                : 'text-[#62677A]'
            }`}
          >
            {Math.abs(durationDelta) <= 5
              ? (lang === 'ar' ? 'متطابق مع الهدف' : 'Pacing On Target')
              : durationDelta > 5
              ? (lang === 'ar' ? `أطول بـ ${durationDelta} ثانية` : `+${durationDelta}s over target`)
              : (lang === 'ar' ? `أقصر بـ ${Math.abs(durationDelta)} ثانية` : `${durationDelta}s under target`)}
          </span>
        </div>
      </div>

      {/* Script Editor & Version History */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor Columns */}
        <div className="lg:col-span-3 space-y-5 bg-white border border-[#E3E6EF] rounded-xl p-6 shadow-xs">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'عنوان السيناريو' : 'Script Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm font-semibold px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الفكرة الموجزة (Logline)' : 'Narrative Logline'}
              </label>
              <textarea
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                rows={2}
                placeholder="One sentence summary of narrative arc..."
                className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
                {lang === 'ar' ? 'الخطاف الافتتاحي (First 3-5s)' : 'Opening Hook'}
              </label>
              <textarea
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                rows={2}
                placeholder="First 3-5 seconds high-retention trigger..."
                className="w-full text-xs p-2.5 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#11152B]">
                {lang === 'ar' ? 'نص السيناريو الكامل وملاحظات الإنتاج' : 'Screenplay Dialogue & Visual Timing'}
              </label>
              <span className="text-[11px] text-[#62677A] font-mono">
                {lang === 'ar' ? 'استخدم وسوم [المشهد 1] لتسهيل التفكيك' : 'Use [SCENE X - mm:ss] tags for auto-storyboarding'}
              </span>
            </div>
            <textarea
              value={fullText}
              onChange={(e) => setFullText(e.target.value)}
              rows={14}
              placeholder={`[SCENE 1 - 0:00-0:10]\nVoiceover: Your opening line here...\nVisual: Camera pans slowly across the product...\n\n[SCENE 2 - 0:10-0:25]\nVoiceover: Introduce the core challenge and breakthrough...`}
              className="w-full text-xs font-mono p-3.5 bg-[#F6F7FB]/50 border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none leading-relaxed text-[#11152B]"
            />
          </div>
        </div>

        {/* Versions Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E3E6EF] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#11152B]">
              <History className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>{lang === 'ar' ? 'سجل إصدارات السيناريو' : 'Version History'}</span>
            </div>

            {project.scripts.length === 0 ? (
              <p className="text-xs text-[#62677A] py-2">
                {lang === 'ar' ? 'لا توجد إصدارات سابقة بعد' : 'No previous versions yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {project.scripts.map((ver) => {
                  const isCurrent = ver.id === project.currentScriptId;
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => handleSelectVersion(ver.id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                        isCurrent
                          ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                          : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>v{ver.versionNumber}</span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {ver.estimatedDurationSeconds}s
                        </span>
                      </div>
                      <p className="text-[11px] truncate text-[#11152B] mt-0.5">
                        {ver.title || 'Untitled Draft'}
                      </p>
                      <span className="text-[10px] text-[#62677A] block mt-1 font-mono">
                        {new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
