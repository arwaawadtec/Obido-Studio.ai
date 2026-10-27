import React, { useState } from 'react';
import {
  FolderOpen,
  Film,
  Image as ImageIcon,
  Mic,
  Music,
  Upload,
  ArrowRight,
  Download,
  Trash2,
  Check,
  Plus,
  Play,
} from 'lucide-react';
import { Project, Asset } from '../../types';
import { storage } from '../../services/storage';

interface AssetsStageProps {
  project: Project;
  onProceedToGeneration?: () => void;
  onProceedToEditing?: () => void;
}

export const AssetsStage: React.FC<AssetsStageProps> = ({
  project,
  onProceedToGeneration,
  onProceedToEditing,
}) => {
  const lang = storage.getLanguagePreference();

  const [filterType, setFilterType] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const assets = project.assets || [];

  const filteredAssets = assets.filter((asset) => {
    if (filterType === 'all') return true;
    if (filterType === 'video') return asset.type === 'video';
    if (filterType === 'image') return asset.type === 'image';
    if (filterType === 'audio') return asset.type === 'audio_voiceover' || asset.type === 'audio_music';
    return true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: Asset['type'] = 'video';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio_voiceover';

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      storage.addAsset(project.id, {
        projectId: project.id,
        name: file.name,
        type,
        url,
        filesizeBytes: file.size,
        format: file.name.split('.').pop() || 'mp4',
        provider: 'user_upload',
        isSimulatedDemo: false,
        durationSeconds: 10,
        dimensions: { width: 1920, height: 1080 },
        aspectRatio: project.brief.aspectRatio,
      });
    };
    reader.readAsDataURL(file);
  };

  const [timelineFeedback, setTimelineFeedback] = useState<string | null>(null);

  const handleAttachToTimeline = (asset: Asset) => {
    const newClip = {
      id: 'clip_' + Math.random().toString(36).substring(2, 8),
      sceneId: asset.sceneId || project.scenes[0]?.id || 'sc_1',
      shotId: asset.shotId,
      assetId: asset.id,
      track: asset.type === 'audio_voiceover' ? ('voiceover' as const) : ('video' as const),
      startTimeSeconds: 0,
      durationSeconds: asset.durationSeconds || 10,
      sourceInSeconds: 0,
      volume: 1,
      title: asset.name,
      transitionIn: 'crossfade' as const,
    };

    storage.updateProject(project.id, {
      timeline: {
        ...project.timeline,
        clips: [...(project.timeline?.clips || []), newClip],
      },
    });

    setTimelineFeedback(lang === 'ar' ? 'تمت إضافة العنصر إلى مسار التايم لاين بنجاح' : 'Asset added to editor timeline');
    setTimeout(() => setTimelineFeedback(null), 3000);
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'generation');
    if (onProceedToGeneration) {
      onProceedToGeneration();
    } else if (onProceedToEditing) {
      onProceedToEditing();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 7 من 10' : 'Stage 7 of 10'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'مكتبة الوسائط والأصول المنتجة' : 'Assets & Media Repository'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'إدارة مقاطع الفيديو المولدة، والتسجيلات الصوتية، والمراجع البصرية، والملفات المرفوعة'
              : 'Inspect, preview, organize, and assign generated clips and uploaded footage to your timeline'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* File Upload Trigger */}
          <label className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'رفع ملف' : 'Upload Asset'}</span>
            <input
              type="file"
              accept="video/*,image/*,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى التوليد (المرحلة 8)' : 'Proceed to Generation (Stage 8)'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {timelineFeedback && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{timelineFeedback}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E6EF] pb-3">
        {[
          { id: 'all', label: lang === 'ar' ? 'الكل' : 'All Assets' },
          { id: 'video', label: lang === 'ar' ? 'مقاطع الفيديو' : 'Video Clips' },
          { id: 'image', label: lang === 'ar' ? 'الصور والمراجع' : 'Reference Images' },
          { id: 'audio', label: lang === 'ar' ? 'الصوتيات' : 'Audio & Voiceovers' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterType === tab.id
                ? 'bg-[#11152B] text-white shadow-xs'
                : 'text-[#62677A] hover:bg-[#F6F7FB] hover:text-[#11152B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
          <FolderOpen className="w-10 h-10 text-[#62677A]/40 mx-auto" />
          <h3 className="text-sm font-semibold text-[#11152B]">
            {lang === 'ar' ? 'لا توجد وسائط في هذا التصنيف' : 'No assets in this category'}
          </h3>
          <p className="text-xs text-[#62677A] max-w-sm mx-auto">
            {lang === 'ar'
              ? 'يمكنك تشغيل مهام توليد جديدة من مرحلة التوليد أو رفع وسائطك الخاصة هنا.'
              : 'Dispatch generation jobs in Stage 5 or upload custom media files to populate this repository.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            const isVideo = asset.type === 'video';
            const isAudio = asset.type.startsWith('audio');

            return (
              <div
                key={asset.id}
                className="bg-white border border-[#E3E6EF] hover:border-[#635BFF] rounded-xl p-4 space-y-3 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  {/* Thumbnail / Media Card */}
                  <div className="aspect-video w-full rounded-lg bg-[#11152B] border border-[#E3E6EF] relative overflow-hidden flex items-center justify-center text-white mb-3">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#635BFF]/30 via-transparent to-[#38D9F9]/20" />
                    <div className="relative z-10 flex flex-col items-center text-center p-2">
                      {isVideo ? (
                        <Film className="w-8 h-8 text-[#38D9F9] mb-1" />
                      ) : isAudio ? (
                        <Mic className="w-8 h-8 text-[#E879F9] mb-1" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-[#9B8CFF] mb-1" />
                      )}
                      <span className="text-[11px] font-mono text-[#E3E6EF]/80">
                        {asset.durationSeconds ? `${asset.durationSeconds}s · ` : ''}{asset.format.toUpperCase()}
                      </span>
                    </div>

                    {asset.isSimulatedDemo && (
                      <span className="absolute top-2 right-2 text-[10px] bg-black/60 text-[#38D9F9] px-2 py-0.5 rounded font-mono">
                        Demo
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-[#11152B] line-clamp-1">
                    {asset.name}
                  </h4>

                  {/* Metadata line */}
                  <div className="flex items-center gap-2 text-[11px] text-[#62677A] mt-1 font-mono">
                    <span>{(asset.filesizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <span>·</span>
                    <span className="capitalize">{asset.provider}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-[#E3E6EF] flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleAttachToTimeline(asset)}
                    className="flex items-center gap-1 text-[#635BFF] hover:text-[#5249ea] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة للتايم لاين' : 'Add to Timeline'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
