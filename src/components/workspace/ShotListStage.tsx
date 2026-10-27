import React, { useState } from 'react';
import {
  Film,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Clock,
  Camera,
  Layers,
  Sliders,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  Project,
  Shot,
  ShotFraming,
  CameraAngle,
  CameraMovement,
  Scene,
} from '../../types';
import { storage } from '../../services/storage';
import { getShotsForScene } from '../../services/shotMigration';

interface ShotListStageProps {
  project: Project;
  onProceedToStoryboard: () => void;
}

const FRAMING_OPTIONS: { value: ShotFraming; label: string }[] = [
  { value: 'extreme_wide', label: 'Extreme Wide' },
  { value: 'wide', label: 'Wide Shot' },
  { value: 'medium_wide', label: 'Medium Wide' },
  { value: 'medium', label: 'Medium Shot' },
  { value: 'close_up', label: 'Close-Up' },
  { value: 'extreme_close_up', label: 'Extreme Close-Up' },
  { value: 'over_the_shoulder', label: 'Over-The-Shoulder' },
  { value: 'pov', label: 'POV' },
  { value: 'macro', label: 'Macro' },
];

const ANGLE_OPTIONS: { value: CameraAngle; label: string }[] = [
  { value: 'eye_level', label: 'Eye Level' },
  { value: 'low_angle', label: 'Low Angle' },
  { value: 'high_angle', label: 'High Angle' },
  { value: 'dutch_angle', label: 'Dutch Angle' },
  { value: 'birds_eye', label: "Bird's Eye" },
  { value: 'worms_eye', label: "Worm's Eye" },
];

const MOVEMENT_OPTIONS: { value: CameraMovement; label: string }[] = [
  { value: 'static', label: 'Static (Locked Off)' },
  { value: 'pan_left', label: 'Pan Left' },
  { value: 'pan_right', label: 'Pan Right' },
  { value: 'tilt_up', label: 'Tilt Up' },
  { value: 'tilt_down', label: 'Tilt Down' },
  { value: 'dolly_in', label: 'Dolly In (Push)' },
  { value: 'dolly_out', label: 'Dolly Out (Pull)' },
  { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' },
  { value: 'tracking', label: 'Dynamic Tracking' },
  { value: 'crane', label: 'Crane / Boom' },
  { value: 'handheld', label: 'Handheld Organic' },
  { value: 'orbital', label: 'Orbital 360' },
];

export const ShotListStage: React.FC<ShotListStageProps> = ({ project, onProceedToStoryboard }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const [selectedSceneId, setSelectedSceneId] = useState<string>(scenes[0]?.id || '');
  const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  const currentShots = activeScene ? getShotsForScene(project, activeScene.id) : [];
  const allShots = project.shots || [];

  const targetDurationSec = project.brief.targetDurationSeconds || 60;
  const totalShotsDuration = allShots.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);
  const activeSceneDuration = currentShots.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);

  const handleAddShot = () => {
    if (!activeScene) return;
    const nextShotNum = currentShots.length + 1;
    storage.addShot(project.id, activeScene.id, {
      durationSeconds: 4,
      framing: 'medium',
      cameraAngle: 'eye_level',
      cameraMovement: 'static',
      visualIntent: `Shot ${nextShotNum}: Visual composition`,
    });
  };

  const handleUpdateShot = (shotId: string, updates: Partial<Shot>) => {
    storage.updateShot(project.id, shotId, updates);
  };

  const handleDeleteShot = (shotId: string) => {
    storage.deleteShot(project.id, shotId);
  };

  const handleMoveShot = (index: number, direction: 'up' | 'down') => {
    if (!activeScene) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < currentShots.length) {
      storage.reorderShots(project.id, activeScene.id, index, targetIndex);
    }
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'storyboard');
    onProceedToStoryboard();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 4 من 10' : 'Stage 4 of 10'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'قائمة اللقطات والكاميرا' : 'Shot List & Camera Cinematography'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'تحديد اللقطات لكل مشهد، وتكوين الكاميرا، والعدسات، وحركة الكاميرا، والمدد الزمنية الدقيقة'
              : 'Specify constituent shots per scene with camera framing, lens angles, motion vectors, and pacing'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeScene && (
            <button
              type="button"
              onClick={handleAddShot}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#11152B] bg-white border border-[#E3E6EF] hover:bg-[#F6F7FB] rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إضافة لقطة' : 'Add Shot'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى لوحة القصة' : 'Proceed to Storyboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pacing & Metrics Overview Bar */}
      <div className="bg-white border border-[#E3E6EF] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#62677A]">
              {lang === 'ar' ? 'إجمالي اللقطات' : 'Total Project Shots'}
            </span>
            <div className="text-lg font-bold text-[#11152B] font-mono">
              {allShots.length}
            </div>
          </div>

          <div className="h-8 w-px bg-[#E3E6EF]" />

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#62677A]">
              {lang === 'ar' ? 'إجمالي مدة اللقطات' : 'Shot Duration Total'}
            </span>
            <div className="text-lg font-bold text-[#11152B] font-mono flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#635BFF]" />
              <span>{totalShotsDuration}s</span>
              <span className="text-xs font-normal text-[#62677A]">/ {targetDurationSec}s target</span>
            </div>
          </div>

          {activeScene && (
            <>
              <div className="h-8 w-px bg-[#E3E6EF]" />
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#62677A]">
                  {lang === 'ar' ? 'مدة المشهد النشط' : 'Active Scene Duration'}
                </span>
                <div className="text-sm font-bold text-[#11152B] font-mono">
                  {activeSceneDuration}s ({currentShots.length} shots)
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium font-mono px-2.5 py-1 rounded bg-[#F6F7FB] text-[#62677A] border border-[#E3E6EF]">
            Avg: {allShots.length > 0 ? (totalShotsDuration / allShots.length).toFixed(1) : 0}s / shot
          </span>
        </div>
      </div>

      {/* Scene Navigation Tabs */}
      {scenes.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#E3E6EF] scrollbar-none">
            {scenes.map((sc, idx) => {
              const isSelected = (activeScene?.id || '') === sc.id;
              const sceneShotCount = project.shots?.filter((s) => s.sceneId === sc.id).length || 0;
              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedSceneId(sc.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#11152B] text-white shadow-xs'
                      : 'bg-white border border-[#E3E6EF] text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#F0F2F7] text-[#11152B]'
                  }`}>
                    {idx + 1}
                  </span>
                  <span>{sc.narrativePurpose || `Scene ${idx + 1}`}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E3E6EF] text-[#62677A]'
                  }`}>
                    {sceneShotCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Scene Heading & Shots List */}
          {activeScene && (
            <div className="space-y-4">
              <div className="bg-[#F6F7FB] border border-[#E3E6EF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono font-bold text-[#635BFF] uppercase tracking-wider">
                    {lang === 'ar' ? `المشهد ${activeScene.sceneNumber}: اللقطات التابعة` : `Scene ${activeScene.sceneNumber} Shots`}
                  </div>
                  <h3 className="text-sm font-bold text-[#11152B] mt-0.5">
                    {activeScene.narrativePurpose}
                  </h3>
                  {activeScene.visualDescription && (
                    <p className="text-xs text-[#62677A] mt-1 line-clamp-2">
                      {activeScene.visualDescription}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddShot}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة لقطة للمشهد' : 'Add Shot to Scene'}</span>
                </button>
              </div>

              {/* Shots List for active scene */}
              <div className="space-y-3">
                {currentShots.map((shot, shotIndex) => (
                  <div
                    key={shot.id}
                    className="bg-white border border-[#E3E6EF] rounded-xl p-4 space-y-3 shadow-xs hover:border-[#CBD1E1] transition-all"
                  >
                    {/* Shot Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E3E6EF]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#635BFF] text-white">
                          Take {shot.shotNumber}
                        </span>
                        <input
                          type="text"
                          value={shot.name}
                          onChange={(e) => handleUpdateShot(shot.id, { name: e.target.value })}
                          placeholder={lang === 'ar' ? 'عنوان اللقطة...' : 'Shot title...'}
                          className="text-xs font-bold text-[#11152B] bg-transparent border-b border-transparent hover:border-[#CBD1E1] focus:border-[#635BFF] focus:outline-none px-1 py-0.5 w-48 sm:w-64"
                        />
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        <span className="text-xs font-mono text-[#62677A] bg-[#F6F7FB] px-2 py-0.5 rounded border border-[#E3E6EF] mr-1">
                          {shot.durationSeconds}s
                        </span>

                        <button
                          type="button"
                          onClick={() => handleMoveShot(shotIndex, 'up')}
                          disabled={shotIndex === 0}
                          title={lang === 'ar' ? 'تحريك لأعلى' : 'Move Up'}
                          className="p-1 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveShot(shotIndex, 'down')}
                          disabled={shotIndex === currentShots.length - 1}
                          title={lang === 'ar' ? 'تحريك لأسفل' : 'Move Down'}
                          className="p-1 text-[#62677A] hover:text-[#11152B] hover:bg-[#F6F7FB] rounded disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteShot(shot.id)}
                          title={lang === 'ar' ? 'حذف اللقطة' : 'Delete Shot'}
                          className="p-1 text-[#62677A] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Shot Cinematography Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Framing */}
                      <div className="space-y-1">
                        <label className="font-semibold text-[#11152B] flex items-center gap-1">
                          <Camera className="w-3 h-3 text-[#635BFF]" />
                          <span>{lang === 'ar' ? 'تأطير الكاميرا' : 'Camera Framing'}</span>
                        </label>
                        <select
                          value={shot.framing}
                          onChange={(e) => handleUpdateShot(shot.id, { framing: e.target.value as ShotFraming })}
                          className="w-full p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded-md focus:border-[#635BFF] focus:outline-none"
                        >
                          {FRAMING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Angle */}
                      <div className="space-y-1">
                        <label className="font-semibold text-[#11152B] flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-[#635BFF]" />
                          <span>{lang === 'ar' ? 'زاوية الكاميرا' : 'Camera Angle'}</span>
                        </label>
                        <select
                          value={shot.cameraAngle}
                          onChange={(e) => handleUpdateShot(shot.id, { cameraAngle: e.target.value as CameraAngle })}
                          className="w-full p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded-md focus:border-[#635BFF] focus:outline-none"
                        >
                          {ANGLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Movement */}
                      <div className="space-y-1">
                        <label className="font-semibold text-[#11152B] flex items-center gap-1">
                          <Film className="w-3 h-3 text-[#635BFF]" />
                          <span>{lang === 'ar' ? 'حركة الكاميرا' : 'Camera Movement'}</span>
                        </label>
                        <select
                          value={shot.cameraMovement}
                          onChange={(e) => handleUpdateShot(shot.id, { cameraMovement: e.target.value as CameraMovement })}
                          className="w-full p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded-md focus:border-[#635BFF] focus:outline-none"
                        >
                          {MOVEMENT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Visual Intent & Duration Slider */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
                      <div className="md:col-span-8 space-y-1">
                        <label className="font-semibold text-[#11152B]">
                          {lang === 'ar' ? 'الهدف البصري للقطة' : 'Visual Intent & Composition Details'}
                        </label>
                        <input
                          type="text"
                          value={shot.visualIntent}
                          onChange={(e) => handleUpdateShot(shot.id, { visualIntent: e.target.value })}
                          placeholder={
                            lang === 'ar'
                              ? 'مثال: تركيز حاد على عيني الشخصية مع إضاءة خافتة وضبابية في الخلفية...'
                              : 'e.g., Sharp focus on hero product with soft directional rim light and shallow depth of field...'
                          }
                          className="w-full p-2 bg-[#F6F7FB] border border-[#E3E6EF] rounded-md focus:border-[#635BFF] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-4 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-[#11152B]">
                          <span>{lang === 'ar' ? 'المدة الزمنية' : 'Shot Duration'}</span>
                          <span className="font-mono text-[#635BFF] font-bold">{shot.durationSeconds}s</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={shot.durationSeconds || 4}
                          onChange={(e) => handleUpdateShot(shot.id, { durationSeconds: Number(e.target.value) })}
                          className="w-full accent-[#635BFF]"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {currentShots.length === 0 && (
                  <div className="p-8 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-2">
                    <Film className="w-8 h-8 text-[#62677A]/40 mx-auto" />
                    <h4 className="text-xs font-semibold text-[#11152B]">
                      {lang === 'ar' ? 'لا توجد لقطات في هذا المشهد' : 'No shots in this scene yet'}
                    </h4>
                    <p className="text-[11px] text-[#62677A]">
                      {lang === 'ar' ? 'أضف لقطة أولى لتحديد حركات الكاميرا والمدد.' : 'Click "Add Shot" to define constituent shots and camera parameters.'}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAddShot}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-md transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'إضافة لقطة' : 'Add First Shot'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center bg-white border border-[#E3E6EF] rounded-xl space-y-3">
          <Layers className="w-10 h-10 text-[#62677A]/40 mx-auto" />
          <h3 className="text-sm font-semibold text-[#11152B]">
            {lang === 'ar' ? 'يرجى إنشاء مشاهد أولاً في المرحلة 3' : 'Please organize narrative scenes first in Stage 3'}
          </h3>
          <p className="text-xs text-[#62677A] max-w-sm mx-auto">
            {lang === 'ar'
              ? 'اللقطات تبنى داخل المشاهد السردية لتنظيم حركة الكاميرا ومواعيد القطع.'
              : 'Shots belong to narrative scenes. Visit Stage 3 (Scenes) to break down your story structure.'}
          </p>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="pt-4 border-t border-[#E3E6EF] flex items-center justify-between">
        <div className="text-xs text-[#62677A]">
          {lang === 'ar'
            ? `${allShots.length} لقطة موزعة على ${scenes.length} مشهد`
            : `${allShots.length} shots organized across ${scenes.length} scenes`}
        </div>

        <button
          type="button"
          onClick={handleProceed}
          className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <span>{lang === 'ar' ? 'المتابعة إلى لوحة القصة (المرحلة 5)' : 'Proceed to Storyboard (Stage 5)'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
