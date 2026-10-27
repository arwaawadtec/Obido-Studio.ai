import React, { useState } from 'react';
import { Sparkles, Wand2, ArrowRight, Save, Check, Loader2, Monitor, Smartphone, Square } from 'lucide-react';
import { Project, AspectRatio, VideoPurpose, VisualStyle } from '../../types';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/apiClient';

interface BriefStageProps {
  project: Project;
  onProceedToScript: () => void;
}

export const BriefStage: React.FC<BriefStageProps> = ({ project, onProceedToScript }) => {
  const lang = storage.getLanguagePreference();

  const [title, setTitle] = useState(project.title);
  const [purpose, setPurpose] = useState<VideoPurpose>(project.brief.purpose);
  const [targetAudience, setTargetAudience] = useState(project.brief.targetAudience);
  const [language, setLanguage] = useState(project.brief.language);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(project.brief.aspectRatio);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(project.brief.targetDurationSeconds);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(project.brief.visualStyle);
  const [rawIdea, setRawIdea] = useState(project.brief.rawIdea);
  const [keyTakeaway, setKeyTakeaway] = useState(project.brief.keyTakeaway);
  const [toneOfVoice, setToneOfVoice] = useState(project.brief.toneOfVoice);
  const [callToAction, setCallToAction] = useState(project.brief.callToAction);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState<string | null>(null);

  const handleSave = () => {
    setIsSaving(true);
    storage.updateProject(project.id, {
      title,
      brief: {
        ...project.brief,
        title,
        purpose,
        targetAudience,
        language,
        aspectRatio,
        targetDurationSeconds,
        visualStyle,
        rawIdea,
        keyTakeaway,
        toneOfVoice,
        callToAction,
        lastUpdated: new Date().toISOString(),
      },
      timeline: {
        ...project.timeline,
        aspectRatio,
        totalDurationSeconds: targetDurationSeconds,
      },
    });

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 200);
  };

  const handleAiRefine = async () => {
    if (!rawIdea.trim()) {
      setRefineFeedback(lang === 'ar' ? 'الرجاء إدخال فكرة أولية لتنقيحها' : 'Please provide an initial idea first');
      return;
    }
    setIsRefining(true);
    setRefineFeedback(null);

    try {
      const res = await authenticatedFetch('/api/ai/refine-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea,
          purpose,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refine request failed');

      if (data.brief) {
        const b = data.brief;
        if (b.refinedTitle) setTitle(b.refinedTitle);
        if (b.targetAudience) setTargetAudience(b.targetAudience);
        if (b.keyTakeaway) setKeyTakeaway(b.keyTakeaway);
        if (b.toneOfVoice) setToneOfVoice(b.toneOfVoice);
        if (b.suggestedDurationSeconds) setTargetDurationSeconds(b.suggestedDurationSeconds);
        if (b.suggestedVisualStyle) setVisualStyle(b.suggestedVisualStyle as VisualStyle);
        if (b.callToAction) setCallToAction(b.callToAction);
        setRefineFeedback(lang === 'ar' ? 'تم تنقيح الملخص بنجاح بواسطة الذكاء الاصطناعي' : 'Brief refined successfully with Gemini');
      }
    } catch (err: any) {
      console.warn('AI refine fallback', err);
      setRefineFeedback(lang === 'ar' ? 'تعذر الاتصال بالخادم، تم حفظ التعديلات' : 'Server AI unavailable. You can edit brief manually.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleProceed = () => {
    handleSave();
    storage.setWorkflowStage(project.id, 'script');
    onProceedToScript();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 1 من 10' : 'Stage 1 of 10'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'ملخص المشروع والأهداف' : 'Project Brief & Production Goals'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'حدد الجمهور المستهدف، والرسالة الرئيسية، والمعايير الفنية التي ستبنى عليها كل المشاهد'
              : 'Define the strategic audience, core narrative message, and technical constraints for downstream generation'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? (lang === 'ar' ? 'تم الحفظ' : 'Saved') : (lang === 'ar' ? 'حفظ' : 'Save')}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى السيناريو' : 'Proceed to Script'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Brief Polisher Banner */}
      <div className="p-4 bg-[#635BFF]/5 border border-[#635BFF]/20 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-xs font-bold text-[#11152B]">
              {lang === 'ar' ? 'مساعد تنقيح الملخص الذكي' : 'Gemini Production Brief Refiner'}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleAiRefine}
            disabled={isRefining || !rawIdea.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#635BFF] bg-white border border-[#635BFF]/30 hover:bg-[#635BFF] hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isRefining ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{lang === 'ar' ? 'جارٍ التحليل...' : 'Refining...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-[#38D9F9]" />
                <span>{lang === 'ar' ? 'تنقيح وتوسيع الملخص' : 'Refine with AI'}</span>
              </>
            )}
          </button>
        </div>

        <textarea
          value={rawIdea}
          onChange={(e) => setRawIdea(e.target.value)}
          rows={3}
          placeholder="Describe your core concept, problem, product, or narrative arc..."
          className="w-full text-xs p-3 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none text-[#171A2B]"
        />

        {refineFeedback && (
          <p className="text-xs text-[#635BFF] font-medium">{refineFeedback}</p>
        )}
      </div>

      {/* Form Fields */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 space-y-6 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
            {lang === 'ar' ? 'عنوان المشروع' : 'Project Title'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm font-medium px-3.5 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'الغرض والنوع' : 'Video Purpose'}
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as VideoPurpose)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value="explainer">Explainer & Technical Breakdown</option>
              <option value="marketing">Marketing & Acquisition</option>
              <option value="social_ad">High-Retention Social Ad / Hook</option>
              <option value="product_launch">Keynote & Feature Reveal</option>
              <option value="brand_story">Brand Story & Philosophy</option>
              <option value="tutorial">Educational Tutorial</option>
              <option value="documentary">Short Documentary</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'لغة التعليق الصوتي والترجمة' : 'Language / Voiceover'}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Arabic">العربية (Arabic)</option>
              <option value="French">Français</option>
              <option value="German">Deutsch</option>
              <option value="Spanish">Español</option>
              <option value="Japanese">日本語</option>
            </select>
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#11152B] mb-2">
            {lang === 'ar' ? 'نسبة الأبعاد ومسرح العرض' : 'Canvas Aspect Ratio'}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: '16:9' as AspectRatio, label: '16:9 Landscape', desc: 'YouTube, Desktop 1920x1080', icon: Monitor },
              { id: '9:16' as AspectRatio, label: '9:16 Vertical', desc: 'TikTok, Reels 1080x1920', icon: Smartphone },
              { id: '1:1' as AspectRatio, label: '1:1 Square', desc: 'Instagram, Feed 1080x1080', icon: Square },
            ].map((ratio) => {
              const Icon = ratio.icon;
              const isSelected = aspectRatio === ratio.id;
              return (
                <button
                  type="button"
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`flex flex-col items-center p-3 text-center rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                      : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-[#635BFF]' : 'text-[#62677A]'}`} />
                  <span className="text-xs font-semibold text-[#11152B]">{ratio.label}</span>
                  <span className="text-[10px] text-[#62677A] mt-0.5">{ratio.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration & Visual Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#11152B]">
                {lang === 'ar' ? 'المدة المستهدفة' : 'Target Duration'}
              </label>
              <span className="text-xs font-mono font-semibold text-[#635BFF] tabular-nums">
                {targetDurationSeconds}s (~{Math.round((targetDurationSeconds / 60) * 140)} words)
              </span>
            </div>
            <div className="flex gap-2">
              {[15, 30, 45, 60, 90, 120].map((dur) => (
                <button
                  type="button"
                  key={dur}
                  onClick={() => setTargetDurationSeconds(dur)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    targetDurationSeconds === dur
                      ? 'bg-[#11152B] text-white border-[#11152B]'
                      : 'border-[#E3E6EF] text-[#62677A] hover:border-[#11152B]'
                  }`}
                >
                  {dur}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'النمط البصري العام' : 'Visual Style Aesthetic'}
            </label>
            <select
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value="cinematic_photorealistic">Cinematic Photorealistic (35mm Film)</option>
              <option value="minimal_3d">Minimal 3D & Isometric</option>
              <option value="high_tech_holographic">High-Tech Holographic & Dark Studio</option>
              <option value="editorial_film">Editorial Film & Warm Natural Light</option>
              <option value="documentary_realism">Documentary Realism & Handheld</option>
              <option value="anime_vector">Stylized Anime / Vector Art</option>
            </select>
          </div>
        </div>

        {/* Audience & Messaging */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'الجمهور المستهدف' : 'Target Audience Profile'}
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'الرسالة الجوهرية' : 'Core Takeaway / Value Proposition'}
            </label>
            <input
              type="text"
              value={keyTakeaway}
              onChange={(e) => setKeyTakeaway(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'نبرة الصوت' : 'Tone of Voice'}
            </label>
            <input
              type="text"
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'الدعوة لاتخاذ إجراء' : 'Call to Action (CTA)'}
            </label>
            <input
              type="text"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
