import React, { useState } from 'react';
import {
  Video,
  ArrowRight,
  Sparkles,
  Check,
  Globe,
  Briefcase,
  GraduationCap,
  Megaphone,
  Clapperboard,
  Layers,
  Wand2,
  ChevronRight,
} from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage } from '../../services/storage';
import { UserPreferences } from '../../types';

export const OnboardingPage: React.FC = () => {
  const lang = storage.getLanguagePreference();
  const currentUser = auth.getCurrentUser();

  const [useCase, setUseCase] = useState<UserPreferences['useCase']>('content_creation');
  const [experienceLevel, setExperienceLevel] = useState<UserPreferences['experienceLevel']>('intermediate');
  const [selectedLang, setSelectedLang] = useState<'en' | 'ar'>(lang);
  const [initialIdea, setInitialIdea] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLangChange = (l: 'en' | 'ar') => {
    setSelectedLang(l);
    storage.setLanguagePreference(l);
  };

  const handleComplete = async (skipIdea: boolean = false) => {
    setIsSubmitting(true);

    const preferences: UserPreferences = {
      useCase,
      experienceLevel,
      language: selectedLang,
      initialIdea: skipIdea ? undefined : initialIdea.trim() || undefined,
    };

    await auth.completeOnboarding(preferences);
    setIsSubmitting(false);

    // If initial idea is provided, create project immediately and jump into workspace!
    if (!skipIdea && initialIdea.trim()) {
      const newProj = storage.createProject({
        title: `${initialIdea.trim().slice(0, 36)} (Production)`,
        purpose: useCase === 'marketing' ? 'marketing' : useCase === 'education' ? 'tutorial' : 'explainer',
        language: selectedLang === 'ar' ? 'Arabic' : 'English',
        aspectRatio: '16:9',
        targetDurationSeconds: 60,
        visualStyle: 'cinematic_photorealistic',
        rawIdea: initialIdea.trim(),
        userId: currentUser?.id,
      });
      router.navigate(`/app/workspace/${newProj.id}`);
    } else {
      router.navigate('/app');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[#E3E6EF] rounded-md text-xs font-medium text-[#635BFF] mb-2 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{selectedLang === 'ar' ? 'إعداد مساحة العمل الخاصة بك' : 'Welcome to Obido Studio'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#11152B] font-display">
          {selectedLang === 'ar' ? `أهلاً بك، ${currentUser?.name}` : `Welcome aboard, ${currentUser?.name}`}
        </h1>
        <p className="text-xs text-[#62677A] max-w-md mx-auto">
          {selectedLang === 'ar'
            ? 'دعنا نخصص استوديو الفيديو ليتناسب مع أسلوبك وأهدافك الإبداعية'
            : 'Let us customize your production pipeline to match your creation goals.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white border border-[#E3E6EF] rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
          {/* Question 1: Primary Use Case */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
              1. {selectedLang === 'ar' ? 'ما هو هدفك الأساسي لإنتاج الفيديو؟' : 'Primary Video Production Use Case'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'content_creation' as const, label: 'Content Creation', icon: Clapperboard, desc: 'YouTube, Reels, Shorts' },
                { id: 'marketing' as const, label: 'Marketing & Ads', icon: Megaphone, desc: 'Acquisition & Social Hooks' },
                { id: 'education' as const, label: 'Education & Courses', icon: GraduationCap, desc: 'Tutorials & Explanations' },
                { id: 'business' as const, label: 'Enterprise / B2B', icon: Briefcase, desc: 'Product Demos & Keynotes' },
                { id: 'other' as const, label: 'Other Formats', icon: Layers, desc: 'Creative Experimentation' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = useCase === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setUseCase(item.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                        : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-[#635BFF]' : 'text-[#62677A]'}`} />
                    <div>
                      <span className="text-xs font-bold text-[#11152B] block">{item.label}</span>
                      <span className="text-[10px] text-[#62677A] block mt-0.5">{item.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 2: Experience Level */}
          <div className="space-y-3 pt-4 border-t border-[#E3E6EF]">
            <label className="block text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
              2. {selectedLang === 'ar' ? 'مستوى خبرتك في صناعة الفيديو' : 'Video Creation Experience'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'beginner' as const, label: 'Beginner', desc: 'Creating my first video' },
                { id: 'intermediate' as const, label: 'Intermediate', desc: 'Producing regular content' },
                { id: 'advanced' as const, label: 'Advanced / Pro', desc: 'Full pipeline director' },
              ].map((lvl) => {
                const isSelected = experienceLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setExperienceLevel(lvl.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                        : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#11152B] block">{lvl.label}</span>
                    <span className="text-[10px] text-[#62677A] block mt-0.5">{lvl.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Language & RTL */}
          <div className="space-y-3 pt-4 border-t border-[#E3E6EF]">
            <label className="block text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>3. {selectedLang === 'ar' ? 'لغة واجهة الاستوديو المفضلة' : 'Preferred Interface Language'}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleLangChange('en')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedLang === 'en'
                    ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                    : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                }`}
              >
                <span className="text-xs font-bold text-[#11152B] block">English (LTR)</span>
                <span className="text-[10px] text-[#62677A] block mt-0.5">International Standard</span>
              </button>
              <button
                type="button"
                onClick={() => handleLangChange('ar')}
                className={`p-3 rounded-xl border text-right transition-all ${
                  selectedLang === 'ar'
                    ? 'border-[#635BFF] bg-[#635BFF]/5 text-[#635BFF]'
                    : 'border-[#E3E6EF] hover:border-[#D1D5E5] text-[#62677A]'
                }`}
              >
                <span className="text-xs font-bold text-[#11152B] block">العربية (RTL)</span>
                <span className="text-[10px] text-[#62677A] block mt-0.5">واجهة عربية مع خط IBM Plex</span>
              </button>
            </div>
          </div>

          {/* Question 4: Optional Initial Video Idea */}
          <div className="space-y-3 pt-4 border-t border-[#E3E6EF]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#38D9F9]" />
                <span>4. {selectedLang === 'ar' ? 'فكرة الفيديو الأولى (اختياري)' : 'Your First Video Idea (Optional)'}</span>
              </label>
              <span className="text-[10px] text-[#62677A]">Optional</span>
            </div>
            <textarea
              value={initialIdea}
              onChange={(e) => setInitialIdea(e.target.value)}
              rows={3}
              placeholder={
                selectedLang === 'ar'
                  ? 'مثال: فيديو مدته 60 ثانية يشرح كيف يساعد الذكاء الاصطناعي في اختصار وقت المونتاج...'
                  : 'e.g. A 45-second high-energy product launch for our new mobile app, highlighting speed and design...'
              }
              className="w-full text-xs p-3 bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl focus:border-[#635BFF] focus:outline-none transition-colors text-[#171A2B]"
            />
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-[#E3E6EF] flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleComplete(true)}
              className="text-xs font-medium text-[#62677A] hover:text-[#11152B] transition-colors"
            >
              {selectedLang === 'ar' ? 'تخطي الفكرة والانتقال للاستوديو' : 'Skip & Go to Dashboard'}
            </button>

            <button
              type="button"
              onClick={() => handleComplete(false)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-xl shadow-sm transition-all"
            >
              <span>{selectedLang === 'ar' ? 'إكمال الإعداد وبدء الإنشاء' : 'Complete Setup & Launch Studio'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
