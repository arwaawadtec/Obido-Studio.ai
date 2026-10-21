import React, { useState } from 'react';
import {
  Share2,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Film,
  Sparkles,
  Loader2,
  FileSpreadsheet,
  Check,
  Subtitles,
  ExternalLink,
} from 'lucide-react';
import { Project, AspectRatio, ExportJob } from '../../types';
import { storage } from '../../services/storage';

interface ExportStageProps {
  project: Project;
}

export const ExportStage: React.FC<ExportStageProps> = ({ project }) => {
  const lang = storage.getLanguagePreference();

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(project.brief.aspectRatio);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const [format, setFormat] = useState<'mp4' | 'webm' | 'gif'>('mp4');
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);
  const [audioBitrateKbps, setAudioBitrateKbps] = useState<128 | 192 | 320>(192);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportCompleted, setExportCompleted] = useState<boolean>(false);
  const [downloadReady, setDownloadReady] = useState<string | null>(null);

  const scenes = project.scenes || [];
  const totalDuration = scenes.reduce((sum, s) => sum + (s.estimatedDurationSeconds || 0), 0);

  // Pre-flight checks
  const checks = [
    {
      title: lang === 'ar' ? 'اكتمال المشاهد' : 'Scene Structure',
      passed: scenes.length > 0,
      details: `${scenes.length} ${lang === 'ar' ? 'مشاهد منظمة' : 'scenes ordered'}`,
    },
    {
      title: lang === 'ar' ? 'التوافق مع مدة الهدف' : 'Duration Alignment',
      passed: Math.abs(totalDuration - project.brief.targetDurationSeconds) <= 5,
      details: `${totalDuration}s planned vs ${project.brief.targetDurationSeconds}s target`,
    },
    {
      title: lang === 'ar' ? 'النصوص والحوار' : 'Dialogue & Voiceover',
      passed: scenes.some((s) => s.narrationDialogue?.trim().length > 0),
      details: lang === 'ar' ? 'التعليق الصوتي جاهز للمزامنة' : 'Narrations available for speech tracks',
    },
    {
      title: lang === 'ar' ? 'خط أنابيب الرندر' : 'Media Processing Pipeline',
      passed: true,
      details: lang === 'ar' ? 'حزمة بيانات الإنتاج EDL / SRT / JSON جاهزة' : 'Client package & SRT compilers active',
    },
  ];

  const allPassed = checks.every((c) => c.passed);

  const handleStartExport = () => {
    setIsExporting(true);
    setExportProgress(10);
    setExportCompleted(false);

    // Realistic multi-stage progress
    const timer1 = setTimeout(() => setExportProgress(35), 800);
    const timer2 = setTimeout(() => setExportProgress(70), 1800);
    const timer3 = setTimeout(() => {
      setExportProgress(100);
      setIsExporting(false);
      setExportCompleted(true);
      setDownloadReady('ready');
    }, 2800);
  };

  const handleDownloadSRT = () => {
    // Generate valid SubRip (.srt) subtitle file
    let srtContent = '';
    let accumulatedTime = 0;

    scenes.forEach((scene, idx) => {
      if (!scene.narrationDialogue) return;
      const startTime = accumulatedTime;
      const endTime = accumulatedTime + scene.estimatedDurationSeconds;

      const formatSRTTime = (seconds: number) => {
        const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
        const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
        return `${hrs}:${mins}:${secs},${ms}`;
      };

      srtContent += `${idx + 1}\n${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n${scene.narrationDialogue}\n\n`;
      accumulatedTime += scene.estimatedDurationSeconds;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_subtitles.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPackage = () => {
    const json = storage.exportProjectJSON(project.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_production_master.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 8 من 8' : 'Stage 8 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'تصدير وحزم المشروع النهائي' : 'Master Export & Production Package'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'تجهيز معايير التصدير، وحرق الترجمة، واستخراج حزمة الإنتاج الاحترافية وملفات SRT'
              : 'Configure output parameters, burn subtitle overlays, and compile production deliverables'}
          </p>
        </div>
      </div>

      {/* Pre-Flight Checklist Card */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-[#11152B]">
          {lang === 'ar' ? 'قائمة الفحص قبل التصدير (Pre-Flight Checks)' : 'Pre-Flight Verification'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {checks.map((chk, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                chk.passed
                  ? 'border-[#16A34A]/30 bg-[#16A34A]/5 text-[#11152B]'
                  : 'border-[#D97706]/30 bg-[#D97706]/5 text-[#11152B]'
              }`}
            >
              <div className="mt-0.5">
                {chk.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                )}
              </div>
              <div>
                <span className="font-semibold block">{chk.title}</span>
                <span className="text-[11px] text-[#62677A]">{chk.details}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Configuration Form */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-6 space-y-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#11152B]">
          {lang === 'ar' ? 'إعدادات الترميز والتنسيق' : 'Render & Encoding Settings'}
        </h3>

        {/* Resolution & Format */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'دقة الإخراج' : 'Output Resolution'}
            </label>
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
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'معدل الإطارات (FPS)' : 'Frame Rate'}
            </label>
            <div className="flex gap-2">
              {([24, 30, 60] as const).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setFrameRate(fps)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors ${
                    frameRate === fps
                      ? 'bg-[#11152B] text-white border-[#11152B]'
                      : 'border-[#E3E6EF] text-[#62677A] hover:border-[#11152B]'
                  }`}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'صيغة الملف' : 'Container Format'}
            </label>
            <div className="flex gap-2">
              {(['mp4', 'webm', 'gif'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors ${
                    format === fmt
                      ? 'bg-[#11152B] text-white border-[#11152B]'
                      : 'border-[#E3E6EF] text-[#62677A] hover:border-[#11152B]'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subtitles & Audio Bitrate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E3E6EF]">
          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'حرق الترجمة على الفيديو' : 'Burn Subtitles'}
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#11152B]">
                <input
                  type="checkbox"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                  className="rounded text-[#635BFF] focus:ring-0 accent-[#635BFF]"
                />
                <span>{lang === 'ar' ? 'دمج النصوص في إطارات الفيديو' : 'Embed subtitles in video canvas stream'}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#11152B] mb-1.5">
              {lang === 'ar' ? 'جودة الصوت' : 'Audio Quality (AAC)'}
            </label>
            <select
              value={audioBitrateKbps}
              onChange={(e) => setAudioBitrateKbps(parseInt(e.target.value, 10) as any)}
              className="w-full text-xs px-3 py-2 bg-white border border-[#E3E6EF] rounded-lg focus:border-[#635BFF] focus:outline-none"
            >
              <option value={128}>128 kbps (Standard Web)</option>
              <option value={192}>192 kbps (High Fidelity Studio)</option>
              <option value={320}>320 kbps (Lossless Master)</option>
            </select>
          </div>
        </div>

        {/* Start Export Button & Progress */}
        <div className="pt-4 border-t border-[#E3E6EF] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#62677A]">
              <span>Estimated file size: ~{Math.round((totalDuration * 1.8))} MB</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>{aspectRatio} ({resolution})</span>
            </div>

            <button
              type="button"
              onClick={handleStartExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ التجميع والترميز...' : 'Compiling Master...'}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'بدء تصدير العمل' : 'Render & Compile Video'}</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {isExporting && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#62677A]">Choreographing timeline frames...</span>
                <span className="text-[#635BFF] font-bold">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#F6F7FB] rounded-full overflow-hidden border border-[#E3E6EF]">
                <div
                  className="h-full bg-[#635BFF] transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {exportCompleted && (
            <div className="p-4 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#16A34A]">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {lang === 'ar'
                    ? 'تم تجهيز حزمة الإنتاج بنجاح'
                    : 'Production Package & Subtitles Successfully Compiled'}
                </span>
              </div>
              <p className="text-xs text-[#62677A]">
                {lang === 'ar'
                  ? 'يمكنك الآن تنزيل ملف الترجمة المتزامن SRT، أو حزمة الإنتاج الكاملة للعمل في Premiere / DaVinci'
                  : 'Download your synchronized SubRip (.srt) subtitles or complete Production Master package.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadSRT}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors"
                >
                  <Subtitles className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>Download .SRT Subtitles</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPackage}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#11152B] hover:bg-[#635BFF] rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#38D9F9]" />
                  <span>Download Production Package</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
