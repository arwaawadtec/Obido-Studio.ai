import React, { useState } from 'react';
import {
  Video,
  ArrowRight,
  Sparkles,
  Layers,
  Film,
  Camera,
  Terminal,
  FolderOpen,
  Cpu,
  Sliders,
  Share2,
  CheckCircle2,
  Play,
  Monitor,
  Smartphone,
  Globe,
  Subtitles,
  HelpCircle,
  Shield,
  FileText,
  Clock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { router } from '../../services/router';
import { auth } from '../../services/auth';
import { storage, TEMPLATES } from '../../services/storage';

interface LandingPageProps {
  onOpenHelp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenHelp }) => {
  const lang = storage.getLanguagePreference();
  const isAuth = auth.isAuthenticated();
  const currentUser = auth.getCurrentUser();

  const [previewTab, setPreviewTab] = useState<'editor' | 'storyboard' | 'prompts'>('editor');
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);

  const toggleLang = () => {
    const next = lang === 'en' ? 'ar' : 'en';
    storage.setLanguagePreference(next);
  };

  const handleStartCreating = () => {
    if (isAuth) {
      if (currentUser && !currentUser.hasCompletedOnboarding) {
        router.navigate('/onboarding');
      } else {
        router.navigate('/app');
      }
    } else {
      router.navigate('/sign-up');
    }
  };

  const handleTemplateClick = (templateId: string) => {
    if (isAuth) {
      const proj = storage.createFromTemplate(templateId);
      if (proj) {
        router.navigate(`/app/workspace/${proj.id}`);
      } else {
        router.navigate('/app/templates');
      }
    } else {
      router.navigate(`/sign-up?redirect=${encodeURIComponent(`/app/templates`)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#171A2B] selection:bg-[#635BFF]/20 selection:text-[#11152B] flex flex-col">
      {/* Top Banner for Logged-In Users */}
      {isAuth && (
        <div className="bg-[#11152B] text-white px-6 py-2 text-xs flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span>
              {lang === 'ar' ? `مرحباً بك مجدداً، ${currentUser?.name}` : `Signed in as ${currentUser?.name}`}
            </span>
            <span aria-hidden="true" className="text-white/40">·</span>
            <span className="text-white/60 capitalize font-mono">{currentUser?.tier} Plan</span>
          </div>
          <button
            onClick={() => router.navigate('/app')}
            className="flex items-center gap-1.5 text-[#38D9F9] hover:underline font-semibold"
          >
            <span>{lang === 'ar' ? 'الذهاب إلى لوحة التحكم' : 'Go to Studio Dashboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Public Marketing Top Bar Contract */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E3E6EF] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="/" className="flex items-center gap-2.5 text-left group">
              <div className="w-9 h-9 rounded-lg bg-[#11152B] flex items-center justify-center text-white shadow-sm group-hover:bg-[#635BFF] transition-colors">
                <Video className="w-5 h-5 text-[#38D9F9]" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#11152B] font-display whitespace-nowrap block leading-none">
                  Obido Studio
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#62677A] font-mono mt-0.5 block">
                  Video Creation Platform
                </span>
              </div>
            </a>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#62677A]">
            <a href="#how-it-works" className="hover:text-[#11152B] transition-colors whitespace-nowrap">
              {lang === 'ar' ? 'كيف يعمل' : 'How It Works'}
            </a>
            <a href="#features" className="hover:text-[#11152B] transition-colors whitespace-nowrap">
              {lang === 'ar' ? 'المميزات' : 'Features'}
            </a>
            <a href="#templates" className="hover:text-[#11152B] transition-colors whitespace-nowrap">
              {lang === 'ar' ? 'القوالب' : 'Templates'}
            </a>
            <button
              onClick={onOpenHelp}
              className="hover:text-[#11152B] transition-colors whitespace-nowrap text-left"
            >
              {lang === 'ar' ? 'الدليل' : 'Production Guide'}
            </button>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language Switch */}
            <button
              onClick={toggleLang}
              title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded-md transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="font-mono uppercase">{lang === 'en' ? 'AR' : 'EN'}</span>
            </button>

            {isAuth ? (
              <button
                onClick={() => router.navigate('/app')}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg shadow-sm transition-all whitespace-nowrap"
              >
                <span>{lang === 'ar' ? 'افتح الاستوديو' : 'Open Studio'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.navigate('/sign-in')}
                  className="px-3.5 py-2 text-xs font-semibold text-[#11152B] hover:text-[#635BFF] transition-colors whitespace-nowrap"
                >
                  {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                </button>
                <button
                  onClick={handleStartCreating}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all whitespace-nowrap"
                >
                  <span>{lang === 'ar' ? 'ابدأ الإنشاء' : 'Start Creating'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle background ambient gradients */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-[#635BFF]/15 via-[#9B8CFF]/10 to-[#38D9F9]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10 space-y-10 text-center">
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[#E3E6EF] rounded-md text-xs font-medium text-[#62677A] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>{lang === 'ar' ? 'استوديو إنتاج فيديو متكامل بالذكاء الاصطناعي' : 'End-to-End AI Video Creation Platform'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#11152B] font-display text-balance leading-[1.12]">
              {lang === 'ar'
                ? 'من الفكرة إلى الفيديو النهائي. كل شيء في استوديو واحد.'
                : 'From Idea to Video. All in One Studio.'}
            </h1>

            <p className="text-base sm:text-lg text-[#62677A] leading-relaxed max-w-2xl mx-auto text-balance">
              {lang === 'ar'
                ? 'حوّل أفكارك إلى فيديوهات جاهزة للإنتاج مع كتابة السيناريو الذكية، ولوحة القصة، وتوليد الوسائط، والمونتاج، والتصدير—في سير عمل واحد مترابط.'
                : 'Turn your ideas into production-ready videos with AI-assisted scripting, storyboarding, media generation, editing, and export—all in one connected workflow.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                onClick={handleStartCreating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 text-sm font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] active:scale-[0.98] rounded-xl shadow-md transition-all"
              >
                <span>{lang === 'ar' ? 'ابدأ الإنشاء مجاناً' : 'Start Creating'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#how-it-works"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-xl transition-colors"
              >
                <span>{lang === 'ar' ? 'اكتشف طريقة العمل' : 'Explore How It Works'}</span>
              </a>
            </div>
          </div>

          {/* High-Fidelity Studio Workspace Preview */}
          <div className="pt-8">
            <div className="relative mx-auto max-w-5xl rounded-2xl bg-[#11152B] p-2 sm:p-4 border border-[#171A2B] shadow-2xl text-left overflow-hidden">
              {/* Studio Window Chrome */}
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]/80" />
                  </div>
                  <span className="font-mono text-[11px] text-white/40 ml-2">Obido Studio · Active Production View</span>
                </div>

                {/* View switcher tabs */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg">
                  <button
                    onClick={() => setPreviewTab('editor')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      previewTab === 'editor' ? 'bg-[#635BFF] text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Timeline Editor
                  </button>
                  <button
                    onClick={() => setPreviewTab('storyboard')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      previewTab === 'storyboard' ? 'bg-[#635BFF] text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Storyboard
                  </button>
                  <button
                    onClick={() => setPreviewTab('prompts')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      previewTab === 'prompts' ? 'bg-[#635BFF] text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Prompt Studio
                  </button>
                </div>
              </div>

              {/* Dynamic Workspace Canvas Preview */}
              {previewTab === 'editor' && (
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    {/* Viewport Canvas */}
                    <div className="lg:col-span-2 aspect-video bg-black rounded-xl border border-white/10 relative overflow-hidden flex flex-col justify-between p-5">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#635BFF]/35 via-[#11152B] to-[#38D9F9]/20" />
                      <div className="relative z-10 flex justify-between text-xs">
                        <span className="font-mono bg-black/70 px-2.5 py-1 rounded text-[#38D9F9] font-semibold">
                          SCENE #2 · 00:10-00:22
                        </span>
                        <span className="font-mono bg-black/70 px-2 py-1 rounded text-white/80 text-[11px]">
                          Wide establishing · 16:9
                        </span>
                      </div>

                      <div className="relative z-10 text-center max-w-sm mx-auto space-y-1.5">
                        <Film className="w-8 h-8 text-[#38D9F9]/70 mx-auto" />
                        <h4 className="text-sm font-bold text-white">Quantum Leap: Autonomous Data Workflows</h4>
                        <p className="text-[11px] text-white/70">
                          Holographic DAG telemetry self-reorganizing in 14ms before latency cascades.
                        </p>
                      </div>

                      <div className="relative z-10 text-center">
                        <span className="inline-block bg-black/80 backdrop-blur-xs px-4 py-1.5 rounded-lg border border-white/10 text-xs text-white">
                          "Traditional monitoring merely alerts you to fires. Obido writes the idempotent fix."
                        </span>
                      </div>
                    </div>

                    {/* Mini Inspector */}
                    <div className="bg-[#171A2B] border border-white/10 rounded-xl p-4 space-y-3 text-xs text-white/80">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-bold text-white">Clip Inspector</span>
                        <span className="font-mono text-[#38D9F9] text-[11px]">1080p @ 30 FPS</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">TRANSITION</span>
                        <span className="font-semibold text-white">Smooth Crossfade (0.5s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">AUDIO GAIN</span>
                        <span className="font-mono text-[#16A34A]">-14 dB (Synced Narration)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">STATUS</span>
                        <span className="text-[#38D9F9] font-medium">✓ Ready for Master Render</span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Track Timeline Strip */}
                  <div className="bg-[#0B0E1E] rounded-xl border border-white/10 p-3 space-y-2 font-mono text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-white/50 text-[10px]">VIDEO V1</span>
                      <div className="flex-1 h-8 bg-black/40 rounded border border-white/10 p-0.5 flex gap-1">
                        <div className="w-[20%] h-full bg-[#635BFF]/40 rounded text-[9px] flex items-center justify-center text-white truncate px-1">#1 Alert 10s</div>
                        <div className="w-[30%] h-full bg-[#635BFF] rounded text-[9px] flex items-center justify-center text-white font-bold truncate px-1">#2 Telemetry 12s</div>
                        <div className="w-[25%] h-full bg-[#635BFF]/40 rounded text-[9px] flex items-center justify-center text-white truncate px-1">#3 Patch 14s</div>
                        <div className="w-[25%] h-full bg-[#635BFF]/40 rounded text-[9px] flex items-center justify-center text-white truncate px-1">#4 Outro 12s</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-white/50 text-[10px]">VOICE A1</span>
                      <div className="flex-1 h-6 bg-black/40 rounded border border-white/10 p-0.5 flex items-center">
                        <div className="w-[90%] h-full bg-[#E879F9]/30 rounded text-[9px] text-[#E879F9] flex items-center px-2">Gemini Flash TTS (24kHz Mono Master)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === 'storyboard' && (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { num: 1, title: 'Server Chassis Alert', dur: '10s', framing: 'Close-up' },
                    { num: 2, title: 'Holographic DAG Telemetry', dur: '12s', framing: 'Wide establishing' },
                    { num: 3, title: 'Autonomous Hot-Swap Patch', dur: '14s', framing: 'Medium shot' },
                  ].map((sc) => (
                    <div key={sc.num} className="bg-[#171A2B] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono bg-[#635BFF] text-white px-2 py-0.5 rounded font-bold">#{sc.num}</span>
                        <span className="text-white/60 font-mono text-[11px]">{sc.dur}</span>
                      </div>
                      <div className="aspect-video bg-black/60 rounded border border-white/10 flex items-center justify-center text-center p-2">
                        <Camera className="w-6 h-6 text-[#38D9F9] mb-1" />
                      </div>
                      <h5 className="text-xs font-bold text-white">{sc.title}</h5>
                      <span className="text-[10px] text-white/50 block">{sc.framing}</span>
                    </div>
                  ))}
                </div>
              )}

              {previewTab === 'prompts' && (
                <div className="p-6 space-y-3 text-xs font-mono text-white/80">
                  <div className="p-3 bg-black/50 border border-white/10 rounded-lg">
                    <span className="text-[#38D9F9] block text-[10px] font-bold mb-1">VISUAL PROMPT</span>
                    <p className="text-white/90">"Cinematic macro view of server chassis indicator lights glowing in dark room, cold slate blue lighting, shallow depth of field, 35mm anamorphic lens, 8k resolution"</p>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-lg">
                    <span className="text-[#9B8CFF] block text-[10px] font-bold mb-1">MOTION VECTORS</span>
                    <p className="text-white/90">"Slow continuous dolly-out zoom backwards from lens, gentle rotation 5 degrees, steady camera track"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white border-y border-[#E3E6EF]">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <span className="text-xs font-mono font-semibold text-[#635BFF] uppercase tracking-wider">
              {lang === 'ar' ? 'سير عمل الإنتاج' : '8-Stage Linear Production Pipeline'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'كيف يعمل استوديو أوبيدو' : 'How Obido Studio Works'}
            </h2>
            <p className="text-sm text-[#62677A]">
              {lang === 'ar'
                ? 'رحلة منظمة خطوة بخطوة تضمن التحكم البشري الكامل، من الفكرة الأولية إلى التسليم النهائي.'
                : 'A disciplined, human-controlled workflow designed for consistency, speed, and creative mastery.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: lang === 'ar' ? '1. صف فكرتك' : '1. Describe Your Idea',
                desc: lang === 'ar' ? 'حدد الجمهور المستهدف، والمدة، والأسلوب البصري، والرسالة الرئيسية.' : 'Set purpose, target audience, aspect ratio, duration, and tone of voice.',
                icon: FileText,
              },
              {
                step: '02',
                title: lang === 'ar' ? '2. ولّد ونقّح السيناريو' : '2. Draft & Refine Script',
                desc: lang === 'ar' ? 'حساب دقيق لسرعة الإلقاء (~140 كلمة/دقيقة) لمنع تسارع الكلام.' : 'AI script generation with word economy validation and version control.',
                icon: Sparkles,
              },
              {
                step: '03',
                title: lang === 'ar' ? '3. ابنِ لوحة القصة' : '3. Build Your Storyboard',
                desc: lang === 'ar' ? 'تقسيم تلقائي للسيناريو إلى مشاهد متتالية مع ضبط التوقيت والزوايا.' : 'Decompose screenplay into ordered shots with duration meters.',
                icon: Layers,
              },
              {
                step: '04',
                title: lang === 'ar' ? '4. وجّه الكاميرا' : '4. Scene Prompts',
                desc: lang === 'ar' ? 'فصل دقيق بين الموجه البصري، وحركة الكاميرا، والموجه السلبي.' : 'Engineer cinematography syntax, lens specs, and negative prompts.',
                icon: Terminal,
              },
              {
                step: '05',
                title: lang === 'ar' ? '5. ولّد الوسائط' : '5. Generate Media',
                desc: lang === 'ar' ? 'تشغيل نماذج الفيديو مع إشعار صريح بالحالة ودون ادعاءات كاذبة.' : 'Provider-independent dispatch queue with honest status reporting.',
                icon: Cpu,
              },
              {
                step: '06',
                title: lang === 'ar' ? '6. نظّم مكتبتك' : '6. Organize Assets',
                desc: lang === 'ar' ? 'مكتبة شاملة للمقاطع المنتجة، والتسجيلات الصوتية، والملفات المرفوعة.' : 'Manage generated clips, speech voiceovers, and custom footage.',
                icon: FolderOpen,
              },
              {
                step: '07',
                title: lang === 'ar' ? '7. حرّر التايم لاين' : '7. Edit Your Timeline',
                desc: lang === 'ar' ? 'مساحة عمل مظلمة للمونتاج مع مسارات الفيديو والصوت والترجمة.' : 'Multi-track timeline with real-time subtitle sync and safe zones.',
                icon: Sliders,
              },
              {
                step: '08',
                title: lang === 'ar' ? '8. صدّر حزمة الإنتاج' : '8. Export Deliverables',
                desc: lang === 'ar' ? 'تصدير ملفات SRT المتزامنة وحزمة الإنتاج الكاملة للعمل في Premiere.' : 'Compile master video packages and SubRip (.srt) caption files.',
                icon: Share2,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="p-5 rounded-xl border border-[#E3E6EF] bg-[#F6F7FB]/50 hover:bg-white hover:border-[#635BFF] transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#635BFF]">{s.step}</span>
                      <Icon className="w-4 h-4 text-[#62677A]" />
                    </div>
                    <h3 className="text-sm font-bold text-[#11152B]">{s.title}</h3>
                    <p className="text-xs text-[#62677A] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <span className="text-xs font-mono font-semibold text-[#635BFF] uppercase tracking-wider">
              {lang === 'ar' ? 'القدرات الحقيقية' : 'Production Capabilities'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#11152B] font-display">
              {lang === 'ar' ? 'أدوات احترافية لصناع المحتوى والشركات' : 'Engineered for Real Video Creation'}
            </h2>
            <p className="text-sm text-[#62677A]">
              {lang === 'ar'
                ? 'لا وعود وهمية. بنينا استوديو متكامل يربط كل خطوة في عملية الإنتاج دون انقطاع.'
                : 'Zero hallucinations. Obido Studio provides verifiable architectural depth across every step.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: lang === 'ar' ? 'صياغة السيناريو بالذكاء الاصطناعي' : 'AI-Assisted Scripting',
                desc: lang === 'ar' ? 'توليد نصوص متوافقة مع توقيت المشاهد عبر Gemini 3.8 Flash مع حساب معدل الكلمات.' : 'Calibrated screenplay synthesis using Gemini 3.8 Flash with live word rate validation.',
                badge: 'Live Gemini API',
              },
              {
                step: '02',
                title: lang === 'ar' ? 'تخطيط لوحة القصة بالثواني' : 'Scene-by-Scene Storyboard',
                desc: lang === 'ar' ? 'تنظيم المشاهد، وزوايا الكاميرا (Wide, Medium, Close-up)، والتأكد من مطابقة مدة الفيديو.' : 'Decompose scripts into ordered camera frames with strict total duration metering.',
                badge: 'Core Feature',
              },
              {
                step: '03',
                title: lang === 'ar' ? 'استوديو هندسة الموجهات' : 'Prompt Engineering Studio',
                desc: lang === 'ar' ? 'فصل موجهات الكاميرا، وتحديد العدسة والإضاءة، والموجهات السلبية لمنع التشوهات.' : 'Granular separation of visual, camera motion, negative, and sound design prompts.',
                badge: 'Core Feature',
              },
              {
                step: '04',
                title: lang === 'ar' ? 'إدارة مهام التوليد' : 'Generation Job Dispatcher',
                desc: lang === 'ar' ? 'واجهة موحدة تدعم محولات Veo وOmni وRunway والنموذج المحلي مع تتبع دقيق للحالة.' : 'Multi-provider job lifecycle (queued, processing, succeeded) with transparent demo labeling.',
                badge: 'Provider Adapter',
              },
              {
                step: '05',
                title: lang === 'ar' ? 'محرر التايم لاين المظلم' : 'Multi-Track Timeline Editor',
                desc: lang === 'ar' ? 'مساحة عمل متخصصة بمظهر داكن للمعاينة الحية وتعديل الفترات ومزامنة الترجمة.' : 'Dedicated dark media workspace with synced audio, video cuts, and safe-area overlays.',
                badge: 'Core Feature',
              },
              {
                step: '06',
                title: lang === 'ar' ? 'تصدير الترجمة SRT وحزم الإنتاج' : 'Subtitle & Package Export',
                desc: lang === 'ar' ? 'توليد ملفات SubRip (.srt) حقيقية متزامنة وتصدير بيانات المشروع للعمل في Premiere.' : 'Generates real, timestamped .srt subtitles and complete project JSON deliverables.',
                badge: 'Core Feature',
              },
              {
                step: '07',
                title: lang === 'ar' ? 'دعم كامل للعربية (RTL)' : 'Native Arabic RTL Layout',
                desc: lang === 'ar' ? 'دعم حقيقي لاتجاه الكتابة والتصميم من اليمين لليار مع خط IBM Plex Sans Arabic.' : 'Complete right-to-left UI alignment and verified Arabic typography support.',
                badge: 'Accessible',
              },
              {
                step: '08',
                title: lang === 'ar' ? 'عزل بيانات المستخدمين' : 'User Data Isolation',
                desc: lang === 'ar' ? 'حماية بيانات المشاريع وحفظها محلياً مع إمكانية التصدير والاستيراد في أي وقت.' : 'Scoped project repositories ensuring users only see their own active pipelines.',
                badge: 'Security',
              },
              {
                step: '09',
                title: lang === 'ar' ? 'الشفافية ومنع الادعاءات الوهمية' : 'Zero Fake Success Principle',
                desc: lang === 'ar' ? 'التمييز الشفاف بين العمليات الحقيقية والنموذج الأولي دون تزوير شاشات النجاح.' : 'Explicit badges for demonstration data and honest reporting of external dependencies.',
                badge: 'Integrity',
              },
            ].map((f, i) => (
              <div key={i} className="p-6 bg-white border border-[#E3E6EF] rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-[#635BFF] font-semibold">{f.badge}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                </div>
                <h3 className="text-sm font-bold text-[#11152B]">{f.title}</h3>
                <p className="text-xs text-[#62677A] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-20 bg-white border-y border-[#E3E6EF]">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-[#635BFF] uppercase tracking-wider">
                {lang === 'ar' ? 'قوالب البداية السريعة' : 'Curated Blueprints'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#11152B] font-display">
                {lang === 'ar' ? 'ابدأ بقوالب مثبتة النجاح' : 'Start with Proven Narrative Formulas'}
              </h2>
            </div>
            <button
              onClick={() => router.navigate('/app/templates')}
              className="text-xs font-semibold text-[#635BFF] hover:underline flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'عرض جميع القوالب' : 'View all blueprints'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-[#F6F7FB] border border-[#E3E6EF] hover:border-[#635BFF] rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#62677A] font-mono">
                    <span className="font-bold text-[#635BFF]">{tpl.aspectRatio}</span>
                    <span>{tpl.targetDurationSeconds}s · {tpl.scenesCount} scenes</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#11152B] group-hover:text-[#635BFF] transition-colors">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-[#62677A] line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTemplateClick(tpl.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#11152B] bg-white hover:bg-[#635BFF] hover:text-white border border-[#E3E6EF] rounded-lg transition-colors"
                >
                  <span>{lang === 'ar' ? 'استخدم القالب' : 'Use Blueprint'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-bold text-[#11152B] font-display text-balance">
            {lang === 'ar'
              ? 'جاهز لتحويل أفكارك إلى إنتاج سينمائي متكامل؟'
              : 'Ready to build studio-grade video from concept to timeline?'}
          </h2>
          <p className="text-sm text-[#62677A] max-w-xl mx-auto leading-relaxed">
            {lang === 'ar'
              ? 'انضم إلى صانعي المحتوى والمصممين والشركات الذين يستخدمون Obido Studio لصياغة فيديوهاتهم.'
              : 'Take control of every scene, duration, framing, and voiceover in one unified workspace.'}
          </p>
          <div className="pt-2">
            <button
              onClick={handleStartCreating}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <span>{lang === 'ar' ? 'ابدأ الإنشاء الآن' : 'Start Creating Now'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="mt-auto bg-white border-t border-[#E3E6EF] py-12 px-6 text-xs text-[#62677A]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="space-y-3 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#11152B] flex items-center justify-center text-white">
                <Video className="w-4 h-4 text-[#38D9F9]" />
              </div>
              <span className="font-bold text-sm text-[#11152B] font-display">Obido Studio</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              End-to-end AI video creation workspace guiding creators from concept to master timeline export.
            </p>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-[#11152B] block text-xs">Product</span>
            <ul className="space-y-1.5 text-[11px]">
              <li><a href="#how-it-works" className="hover:text-[#11152B]">How It Works</a></li>
              <li><a href="#features" className="hover:text-[#11152B]">Features</a></li>
              <li><a href="#templates" className="hover:text-[#11152B]">Blueprints</a></li>
              <li><button onClick={handleStartCreating} className="hover:text-[#11152B]">Open Studio</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-[#11152B] block text-xs">Resources</span>
            <ul className="space-y-1.5 text-[11px]">
              <li><button onClick={onOpenHelp} className="hover:text-[#11152B]">Production Guide</button></li>
              <li><button onClick={() => setLegalModal('contact')} className="hover:text-[#11152B]">Support & Feedback</button></li>
              <li><span className="text-[#62677A]/60">API Documentation (v1.0)</span></li>
            </ul>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-[#11152B] block text-xs">Legal & Privacy</span>
            <ul className="space-y-1.5 text-[11px]">
              <li><button onClick={() => setLegalModal('privacy')} className="hover:text-[#11152B]">Privacy Policy</button></li>
              <li><button onClick={() => setLegalModal('terms')} className="hover:text-[#11152B]">Terms of Service</button></li>
              <li><span className="text-[#62677A]/60">Cookie Preferences</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-[#E3E6EF] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <span>© {new Date().getFullYear()} Obido Studio. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <span>Inter & IBM Plex Sans Arabic</span>
            <span>·</span>
            <span className="text-[#635BFF] font-medium">v1.0 Foundation</span>
          </div>
        </div>
      </footer>

      {/* Internal Legal / Contact Modals */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#E3E6EF] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
              <h3 className="font-bold text-sm text-[#11152B]">
                {legalModal === 'privacy' && 'Privacy Policy'}
                {legalModal === 'terms' && 'Terms of Service'}
                {legalModal === 'contact' && 'Contact Support'}
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="text-[#62677A] hover:text-[#11152B]"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-[#62677A] space-y-3 leading-relaxed max-h-60 overflow-y-auto light-scrollbar">
              {legalModal === 'privacy' && (
                <p>
                  Obido Studio values creator privacy. Your scripts, storyboards, and generated prompts are stored locally in your browser storage session and sent only to server-side AI endpoints when you explicitly trigger generation. We never sell creator data.
                </p>
              )}
              {legalModal === 'terms' && (
                <p>
                  By using Obido Studio, you retain full ownership of all prompts, scripts, and media generated in your workspace. You agree not to generate defamatory or unlawful material.
                </p>
              )}
              {legalModal === 'contact' && (
                <p>
                  For feedback, feature requests, or technical assistance with Obido Studio, reach out to our team at support@obidostudio.com or open the in-app Production Guide.
                </p>
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#11152B] rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
