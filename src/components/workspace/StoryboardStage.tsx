import React, { useState } from 'react';
import {
  LayoutGrid,
  Sparkles,
  ArrowRight,
  Clock,
  Camera,
  Film,
  User,
  Palette,
  Check,
  CheckCircle2,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { Project, Shot, ShotStatus } from '../../types';
import { storage } from '../../services/storage';
import { getShotsForScene } from '../../services/shotMigration';

interface StoryboardStageProps {
  project: Project;
  onProceedToPrompts: () => void;
}

export const StoryboardStage: React.FC<StoryboardStageProps> = ({ project, onProceedToPrompts }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const shots = project.shots || [];
  const aspectRatio = project.brief.aspectRatio || '16:9';

  const [selectedShotId, setSelectedShotId] = useState<string>(shots[0]?.id || '');
  const activeShot = shots.find((s) => s.id === selectedShotId) || shots[0];

  const handleUpdateShotStatus = (shotId: string, status: ShotStatus) => {
    storage.updateShot(project.id, shotId, { status });
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'prompts');
    onProceedToPrompts();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 5 من 10' : 'Stage 5 of 10'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'لوحة القصة المصورة والاتساق البصري' : 'Storyboard Panels & Visual Continuity'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'معاينة الإطارات البصرية، والتحقق من اتساق الشخصيات، والإضاءة، وتتابع حركة الكاميرا'
              : 'Visual shot panels, character appearance sheet, lighting consistency, and camera coverage'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى الموجهات' : 'Proceed to Prompts'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Consistency & Character Sheet Reference Card */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Visual Style & Palette */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-[#E3E6EF] pb-3 md:pb-0 md:pr-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
            <Palette className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>{lang === 'ar' ? 'الهوية البصرية واللوحة' : 'Visual Identity & Palette'}</span>
          </div>
          <div className="text-xs text-[#62677A] space-y-1">
            <div className="capitalize font-semibold text-[#11152B]">
              {project.brief.visualStyle.replace(/_/g, ' ')}
            </div>
            <div className="text-[11px] leading-relaxed">
              {project.brief.toneOfVoice || 'Professional, consistent cinematic realism.'}
            </div>
          </div>
        </div>

        {/* Character Sheet / Subject Reference */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-[#E3E6EF] pb-3 md:pb-0 md:pr-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
            <User className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>{lang === 'ar' ? 'دليل الشخصيات والموضوع' : 'Subject & Character Sheet'}</span>
          </div>
          <div className="text-xs text-[#62677A] space-y-1">
            <div className="font-semibold text-[#11152B]">
              {project.brief.targetAudience}
            </div>
            <div className="text-[11px] leading-relaxed">
              {project.brief.keyTakeaway || 'Main protagonist and product positioning focus.'}
            </div>
          </div>
        </div>

        {/* Framing & Aspect Ratio Constraints */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#11152B] uppercase tracking-wider font-mono">
            <Camera className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>{lang === 'ar' ? 'المعايير الفنية للتصوير' : 'Format & Constraints'}</span>
          </div>
          <div className="text-xs text-[#62677A] space-y-1">
            <div className="font-mono text-[#11152B] font-bold">
              Aspect Ratio: {aspectRatio}
            </div>
            <div className="text-[11px] font-mono">
              Target Duration: {project.brief.targetDurationSeconds}s ({shots.length} shots)
            </div>
          </div>
        </div>
      </div>

      {/* Storyboard Visual Panel Grid (organized by Scene) */}
      <div className="space-y-8">
        {scenes.map((scene) => {
          const sceneShots = getShotsForScene(project, scene.id);

          return (
            <div key={scene.id} className="space-y-4">
              {/* Scene Divider Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E3E6EF]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#11152B] text-white">
                    Scene {scene.sceneNumber}
                  </span>
                  <h3 className="text-sm font-bold text-[#11152B]">
                    {scene.narrativePurpose}
                  </h3>
                </div>
                <div className="text-xs text-[#62677A] font-mono">
                  {sceneShots.length} panels · {scene.estimatedDurationSeconds || 5}s
                </div>
              </div>

              {/* Shot Visual Panels Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sceneShots.map((shot) => {
                  const isSelected = (activeShot?.id || '') === shot.id;

                  return (
                    <div
                      key={shot.id}
                      onClick={() => setSelectedShotId(shot.id)}
                      className={`bg-white border rounded-xl overflow-hidden transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#635BFF] ring-2 ring-[#635BFF]/20'
                          : 'border-[#E3E6EF] hover:border-[#CBD1E1]'
                      }`}
                    >
                      {/* Frame Mockup / Visual Canvas Canvas Placeholder */}
                      <div className="relative bg-[#11152B] flex flex-col items-center justify-center p-4 min-h-[140px] text-white overflow-hidden group">
                        {/* Aspect Ratio Guide Box */}
                        <div
                          className={`w-full max-w-[220px] mx-auto border border-white/20 rounded flex flex-col items-center justify-center p-3 text-center bg-black/40 backdrop-blur-xs transition-transform group-hover:scale-[1.02] ${
                            aspectRatio === '9:16'
                              ? 'aspect-[9/16] max-w-[120px]'
                              : aspectRatio === '1:1'
                              ? 'aspect-square max-w-[140px]'
                              : 'aspect-[16/9]'
                          }`}
                        >
                          <Camera className="w-5 h-5 text-[#38D9F9] mb-1 opacity-80" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#38D9F9]">
                            {shot.framing.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-white/70 font-mono mt-0.5">
                            {shot.cameraMovement.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Top Badges overlay */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-black/60 text-white font-bold backdrop-blur-xs">
                            Take {shot.shotNumber}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-black/60 text-white/90 backdrop-blur-xs">
                            {shot.durationSeconds}s
                          </span>
                        </div>
                      </div>

                      {/* Content & Metadata */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-[#11152B] line-clamp-1">
                              {shot.name || `Shot ${shot.shotNumber}`}
                            </h4>
                            <span className="text-[10px] font-mono capitalize px-1.5 py-0.5 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
                              {shot.cameraAngle.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#62677A] line-clamp-2 leading-relaxed">
                            {shot.visualIntent || scene.visualDescription || 'Visual composition defined for this shot.'}
                          </p>

                          {shot.dialogueSnippet && (
                            <div className="text-[10px] text-[#635BFF] bg-[#635BFF]/5 p-1.5 rounded border border-[#635BFF]/15 line-clamp-1 italic">
                              "{shot.dialogueSnippet}"
                            </div>
                          )}
                        </div>

                        {/* Shot Review Status Selector */}
                        <div className="pt-2 border-t border-[#E3E6EF] flex items-center justify-between text-xs">
                          <span className="text-[10px] font-mono uppercase text-[#62677A]">Status:</span>
                          <select
                            value={shot.status}
                            onChange={(e) => handleUpdateShotStatus(shot.id, e.target.value as ShotStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-medium px-2 py-0.5 bg-[#F6F7FB] border border-[#E3E6EF] rounded text-[#11152B] focus:border-[#635BFF] focus:outline-none"
                          >
                            <option value="draft">Draft</option>
                            <option value="ready">Ready</option>
                            <option value="prompted">Prompted</option>
                            <option value="generating">Generating</option>
                            <option value="approved">Approved</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {shots.length === 0 && (
          <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
            <LayoutGrid className="w-10 h-10 text-[#62677A]/40 mx-auto" />
            <h3 className="text-sm font-semibold text-[#11152B]">
              {lang === 'ar' ? 'لا توجد لقطات مصورة' : 'No storyboard panels yet'}
            </h3>
            <p className="text-xs text-[#62677A] max-w-sm mx-auto">
              {lang === 'ar'
                ? 'قم بإنشاء المشاهد وقائمة اللقطات أولاً في المرحلتين 3 و 4 لعرض لوحة القصة.'
                : 'Structure scenes and shots in Stages 3 & 4 to automatically populate your visual storyboard panels.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="pt-4 border-t border-[#E3E6EF] flex items-center justify-between">
        <div className="text-xs text-[#62677A]">
          {lang === 'ar'
            ? `${shots.length} لوحة قصة مصورة عبر ${scenes.length} مشهد`
            : `${shots.length} visual panels across ${scenes.length} narrative scenes`}
        </div>

        <button
          type="button"
          onClick={handleProceed}
          className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <span>{lang === 'ar' ? 'المتابعة إلى الموجهات (المرحلة 6)' : 'Proceed to Prompts (Stage 6)'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
