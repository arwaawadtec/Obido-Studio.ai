import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sliders,
  Scissors,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  Check,
  ChevronRight,
  Film,
  Mic,
  Music,
  Subtitles,
} from 'lucide-react';
import { Project, TimelineClip, Scene } from '../../types';
import { storage } from '../../services/storage';

interface EditorStageProps {
  project: Project;
  onProceedToExport: () => void;
}

export const EditorStage: React.FC<EditorStageProps> = ({ project, onProceedToExport }) => {
  const lang = storage.getLanguagePreference();

  const scenes = project.scenes || [];
  const totalDuration = project.brief.targetDurationSeconds || 60;

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Build timeline clips from scenes if timeline is empty
  const clips: TimelineClip[] = (project.timeline?.clips?.length > 0)
    ? project.timeline.clips
    : scenes.map((s, idx) => {
        const prevDuration = scenes
          .slice(0, idx)
          .reduce((sum, prev) => sum + (prev.estimatedDurationSeconds || 10), 0);
        return {
          id: 'clip_sc_' + s.id,
          sceneId: s.id,
          track: 'video',
          startTimeSeconds: prevDuration,
          durationSeconds: s.estimatedDurationSeconds || 10,
          sourceInSeconds: 0,
          volume: 1,
          title: `Scene ${s.sceneNumber}: ${s.narrativePurpose}`,
          transitionIn: idx === 0 ? 'cut' : 'crossfade',
        };
      });

  // Calculate current active scene based on currentTime
  let accumulatedTime = 0;
  let activeScene: Scene | undefined = scenes[0];
  for (const s of scenes) {
    if (currentTime >= accumulatedTime && currentTime < accumulatedTime + s.estimatedDurationSeconds) {
      activeScene = s;
      break;
    }
    accumulatedTime += s.estimatedDurationSeconds;
  }
  if (!activeScene && scenes.length > 0) {
    activeScene = scenes[scenes.length - 1];
  }

  // Selected clip object
  const selectedClip = clips.find((c) => c.id === selectedClipId) || clips[0];

  // Playback Loop
  useEffect(() => {
    if (isPlaying) {
      const step = (timestamp: number) => {
        if (lastTimestampRef.current !== null) {
          const delta = (timestamp - lastTimestampRef.current) / 1000;
          setCurrentTime((prev) => {
            const next = prev + delta;
            if (next >= totalDuration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }
        lastTimestampRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame(step);
      };

      lastTimestampRef.current = null;
      animationFrameRef.current = requestAnimationFrame(step);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastTimestampRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  const handleUpdateClip = (clipId: string, updates: Partial<TimelineClip>) => {
    const updatedClips = clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
    storage.updateProject(project.id, {
      timeline: {
        ...project.timeline,
        clips: updatedClips,
      },
    });
  };

  const handleProceed = () => {
    storage.setWorkflowStage(project.id, 'export');
    onProceedToExport();
  };

  // Aspect ratio styling
  const aspectRatio = project.brief.aspectRatio;
  const canvasContainerStyle =
    aspectRatio === '9:16'
      ? 'w-[260px] h-[462px]'
      : aspectRatio === '1:1'
      ? 'w-[360px] h-[360px]'
      : 'w-full max-w-[640px] aspect-video';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E3E6EF]">
        <div>
          <div className="text-xs text-[#635BFF] font-semibold tracking-wide uppercase font-mono mb-1">
            {lang === 'ar' ? 'المرحلة 7 من 8' : 'Stage 7 of 8'}
          </div>
          <h2 className="text-xl font-bold text-[#11152B] font-display">
            {lang === 'ar' ? 'استوديو المونتاج والتايم لاين' : 'Multi-Track Timeline Studio'}
          </h2>
          <p className="text-xs text-[#62677A] mt-0.5">
            {lang === 'ar'
              ? 'مساحة العمل المظلمة لمشاهدة التسلسل الزمني، وضبط التوقيت، ومعاينة الترجمة والصوت'
              : 'Dedicated dark media workspace for timeline choreography, subtitle timing, and scene flow'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#635BFF] hover:bg-[#5249ea] rounded-lg shadow-sm transition-all"
          >
            <span>{lang === 'ar' ? 'المتابعة إلى التصدير' : 'Proceed to Export'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Dark Media Workspace */}
      <div className="bg-[#11152B] text-white rounded-2xl border border-[#171A2B] overflow-hidden shadow-xl flex flex-col">
        {/* Workspace Toolbar */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-white text-sm">
              {project.title}
            </span>
            <span className="text-[#38D9F9] font-mono text-[11px]">
              {aspectRatio} · {project.timeline.fps || 30} FPS
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSafeAreas(!showSafeAreas)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                showSafeAreas
                  ? 'bg-[#635BFF]/30 border-[#635BFF] text-[#38D9F9]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {showSafeAreas ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Safe Zones</span>
            </button>
          </div>
        </div>

        {/* Video Canvas & Inspector Split */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Canvas Viewport (Center) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center">
            <div
              className={`relative bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center ${canvasContainerStyle}`}
            >
              {/* Dynamic Scene Visualizer */}
              {activeScene ? (
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  {/* Scene background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#635BFF]/30 via-[#11152B] to-[#38D9F9]/20" />

                  {/* Top HUD */}
                  <div className="relative z-10 flex items-center justify-between text-xs">
                    <span className="font-mono bg-black/70 px-2.5 py-1 rounded text-[#38D9F9] font-semibold">
                      SCENE #{activeScene.sceneNumber}
                    </span>
                    <span className="font-mono bg-black/70 px-2 py-1 rounded text-white/80 text-[11px]">
                      {activeScene.cameraFraming}
                    </span>
                  </div>

                  {/* Center Visual Cue Focus */}
                  <div className="relative z-10 text-center px-4 max-w-sm mx-auto space-y-2">
                    <Film className="w-10 h-10 text-[#38D9F9]/60 mx-auto" />
                    <h4 className="text-sm font-bold text-white leading-snug">
                      {activeScene.narrativePurpose}
                    </h4>
                    <p className="text-[11px] text-white/70 line-clamp-2">
                      {activeScene.visualDescription}
                    </p>
                  </div>

                  {/* Bottom Subtitle Overlay */}
                  <div className="relative z-10 text-center">
                    {activeScene.narrationDialogue ? (
                      <div className="inline-block bg-black/80 backdrop-blur-xs px-4 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-white max-w-md shadow-md">
                        {activeScene.narrationDialogue}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-white/40 text-xs font-mono">No Scene Loaded</div>
              )}

              {/* Safe Area Overlays */}
              {showSafeAreas && aspectRatio === '9:16' && (
                <div className="absolute inset-0 border border-dashed border-[#38D9F9]/40 pointer-events-none m-6 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-[#38D9F9]/40 font-mono">
                    Vertical Safe Zone (TikTok / Reels)
                  </span>
                </div>
              )}
              {showSafeAreas && aspectRatio === '16:9' && (
                <div className="absolute inset-0 border border-dashed border-[#38D9F9]/30 pointer-events-none m-8 rounded flex items-center justify-center">
                  <span className="text-[10px] text-[#38D9F9]/30 font-mono">
                    16:9 Title Safe Area
                  </span>
                </div>
              )}
            </div>

            {/* Playback Controls & Timecode */}
            <div className="mt-4 flex items-center gap-4 text-xs font-mono">
              <button
                type="button"
                onClick={handleRestart}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-[#635BFF] hover:bg-[#5249ea] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 px-3 py-1.5 rounded-lg text-white font-bold tabular-nums">
                <span className="text-[#38D9F9]">{formatTimecode(currentTime)}</span>
                <span className="text-white/40">/</span>
                <span className="text-white/70">{formatTimecode(totalDuration)}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-[#DC2626]" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Clip Inspector Panel (Right) */}
          <div className="bg-[#171A2B] border border-white/10 rounded-xl p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#38D9F9]" />
                <span>Clip Inspector</span>
              </span>
              <span className="font-mono text-[#635BFF] text-[11px]">
                {selectedClip ? selectedClip.track.toUpperCase() : 'NONE'}
              </span>
            </div>

            {selectedClip ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Clip Title
                  </label>
                  <input
                    type="text"
                    value={selectedClip.title}
                    onChange={(e) => handleUpdateClip(selectedClip.id, { title: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white focus:outline-none focus:border-[#635BFF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      Start Time (s)
                    </label>
                    <input
                      type="number"
                      value={selectedClip.startTimeSeconds}
                      onChange={(e) =>
                        handleUpdateClip(selectedClip.id, { startTimeSeconds: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-xs font-mono px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      Duration (s)
                    </label>
                    <input
                      type="number"
                      value={selectedClip.durationSeconds}
                      onChange={(e) =>
                        handleUpdateClip(selectedClip.id, { durationSeconds: parseFloat(e.target.value) || 1 })
                      }
                      className="w-full text-xs font-mono px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">
                    Transition In
                  </label>
                  <select
                    value={selectedClip.transitionIn || 'cut'}
                    onChange={(e) => handleUpdateClip(selectedClip.id, { transitionIn: e.target.value as any })}
                    className="w-full text-xs px-2.5 py-1.5 bg-black/40 border border-white/10 rounded text-white"
                  >
                    <option value="cut">Cut (Immediate)</option>
                    <option value="crossfade">Crossfade (Dissolve)</option>
                    <option value="dip_to_black">Dip to Black</option>
                    <option value="wipe_right">Wipe Right</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
                    <span>Track Gain / Volume</span>
                    <span className="font-mono text-[#38D9F9]">
                      {Math.round((selectedClip.volume || 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedClip.volume || 1}
                    onChange={(e) => handleUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                    className="w-full accent-[#635BFF]"
                  />
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-white/40">Select a clip in the timeline</div>
            )}
          </div>
        </div>

        {/* Multi-Track Timeline Header & Scrubber */}
        <div className="bg-[#0B0E1E] border-t border-white/10 p-4 space-y-3">
          {/* Timeline Ruler */}
          <div className="relative h-6 bg-black/50 border-b border-white/10 flex items-center px-4 overflow-hidden">
            {/* Scrubber Playhead handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#38D9F9] z-20"
              style={{
                left: `${Math.min(100, (currentTime / totalDuration) * 100)}%`,
              }}
            >
              <div className="w-2.5 h-2.5 bg-[#38D9F9] -ml-1 rounded-full shadow-md" />
            </div>

            {/* Time markers */}
            <div className="w-full flex justify-between text-[10px] text-white/40 font-mono">
              <span>00:00</span>
              <span>{formatTimecode(totalDuration * 0.25)}</span>
              <span>{formatTimecode(totalDuration * 0.5)}</span>
              <span>{formatTimecode(totalDuration * 0.75)}</span>
              <span>{formatTimecode(totalDuration)}</span>
            </div>
          </div>

          {/* Timeline Tracks */}
          <div className="space-y-2 font-mono text-xs">
            {/* Track 1: Video / Scene Cuts */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5 text-white/70 text-[11px]">
                <Film className="w-3.5 h-3.5 text-[#38D9F9]" />
                <span>Video V1</span>
              </div>
              <div className="flex-1 h-10 bg-black/40 rounded border border-white/10 p-1 flex gap-1 relative overflow-hidden">
                {scenes.map((s) => {
                  const widthPercent = (s.estimatedDurationSeconds / totalDuration) * 100;
                  const isCurrent = activeScene?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedClipId('clip_sc_' + s.id);
                        // Jump scrubber to start of scene
                        const prevSum = scenes
                          .slice(0, s.sceneNumber - 1)
                          .reduce((acc, curr) => acc + curr.estimatedDurationSeconds, 0);
                        setCurrentTime(prevSum);
                      }}
                      style={{ width: `${widthPercent}%` }}
                      className={`h-full rounded px-2 flex items-center justify-between text-[10px] cursor-pointer transition-all truncate border ${
                        isCurrent
                          ? 'bg-[#635BFF] text-white border-white/40 shadow-sm'
                          : 'bg-[#635BFF]/30 text-white/80 border-transparent hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold truncate">#{s.sceneNumber}</span>
                      <span className="text-[9px] opacity-80">{s.estimatedDurationSeconds}s</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Voiceover Audio Track */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5 text-white/70 text-[11px]">
                <Mic className="w-3.5 h-3.5 text-[#E879F9]" />
                <span>Voice A1</span>
              </div>
              <div className="flex-1 h-8 bg-black/40 rounded border border-white/10 p-1 flex items-center">
                <div
                  style={{ width: '92%' }}
                  className="h-full bg-[#E879F9]/30 border border-[#E879F9]/50 rounded px-2 flex items-center justify-between text-[10px] text-[#E879F9]"
                >
                  <span className="truncate">AI Voiceover (Master Narration)</span>
                  <span className="text-[9px] opacity-80">98% Synced</span>
                </div>
              </div>
            </div>

            {/* Track 3: Subtitles / Timed Captions */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5 text-white/70 text-[11px]">
                <Subtitles className="w-3.5 h-3.5 text-[#38D9F9]" />
                <span>Captions</span>
              </div>
              <div className="flex-1 h-7 bg-black/40 rounded border border-white/10 p-1 flex gap-1">
                {scenes.map((s) => {
                  const widthPercent = (s.estimatedDurationSeconds / totalDuration) * 100;
                  return (
                    <div
                      key={s.id}
                      style={{ width: `${widthPercent}%` }}
                      className="h-full bg-white/10 border border-white/20 rounded px-1.5 flex items-center text-[9px] text-white/80 truncate"
                    >
                      <span>{s.narrationDialogue ? `"${s.narrationDialogue.slice(0, 16)}..."` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 4: Ambient Music Track */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5 text-white/70 text-[11px]">
                <Music className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Music A2</span>
              </div>
              <div className="flex-1 h-7 bg-black/40 rounded border border-white/10 p-1 flex items-center">
                <div
                  style={{ width: '100%' }}
                  className="h-full bg-[#16A34A]/20 border border-[#16A34A]/40 rounded px-2 flex items-center justify-between text-[10px] text-[#16A34A]"
                >
                  <span className="truncate">Cinematic Minimal Ambient Bed</span>
                  <span className="text-[9px] opacity-80">-14dB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
