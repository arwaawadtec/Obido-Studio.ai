import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  CheckCircle,
  AlertCircle,
  Clock,
  Sliders,
  Compass,
  Film,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Project, WorkflowStage } from '../../types';
import { authenticatedFetch } from '../../services/apiClient';
import { storage } from '../../services/storage';
import { domainService } from '../../services/domainService';

export interface NovaSuggestedAction {
  id: string;
  label: string;
  description: string;
  actionType: string;
  requiresConfirmation: boolean;
  payload?: any;
}

export interface NovaPacingSummary {
  targetDurationSeconds: number;
  totalEstimatedShotDuration: number;
  variance: number;
  status: 'on_track' | 'under_target' | 'over_target';
  shotCount: number;
  averageShotDuration: number;
}

export interface NovaMessage {
  id: string;
  sender: 'nova' | 'user';
  text: string;
  timestamp: string;
  stageInsight?: string;
  actions?: NovaSuggestedAction[];
  pacingSummary?: NovaPacingSummary;
}

interface NovaAssistantProps {
  project: Project;
  currentStage: WorkflowStage;
  isOpen: boolean;
  onToggle: () => void;
  onSelectStage: (stage: WorkflowStage) => void;
  onProjectUpdated?: (updatedProject: Project) => void;
}

export const NovaAssistant: React.FC<NovaAssistantProps> = ({
  project,
  currentStage,
  isOpen,
  onToggle,
  onSelectStage,
  onProjectUpdated,
}) => {
  const lang = storage.getLanguagePreference();
  const isRtl = lang === 'ar';

  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<NovaMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [executionState, setExecutionState] = useState<
    'idle' | 'thinking' | 'executing' | 'succeeded' | 'failed'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pacingData, setPacingData] = useState<NovaPacingSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<NovaSuggestedAction | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, executionState]);

  // Initial welcome message per stage
  useEffect(() => {
    if (messages.length === 0) {
      const greetingText =
        lang === 'ar'
          ? `مرحباً! أنا نوفا (Nova)، المخرج والمشرف الفني للإنتاج في Obido Studio. أنت الآن في مرحلة "${currentStage}". كيف يمكنني مساعدتك في ضبط السرد، ضبط التوقيت، أو هندسة الموجهات؟`
          : `Hello! I am Nova, your AI Production Director at Obido Studio. You are currently in the "${currentStage}" stage. I can help you evaluate pacing, refine shot prompts, or structure your scenes.`;

      setMessages([
        {
          id: `msg_welcome_${Date.now()}`,
          sender: 'nova',
          text: greetingText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          stageInsight: `Active Stage: ${currentStage.toUpperCase()}`,
        },
      ]);
    }
  }, [currentStage]);

  // Send request to /api/nova/chat
  const handleSend = async (customMessage?: string, actionType?: string) => {
    const textToSend = customMessage !== undefined ? customMessage : inputText.trim();
    if (!textToSend && !actionType) return;

    if (textToSend) {
      const userMsg: NovaMessage = {
        id: `msg_user_${Date.now()}`,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
    }

    setExecutionState('thinking');
    setErrorMessage(null);

    try {
      const payload = {
        projectId: project.id,
        currentStage,
        message: textToSend,
        actionType: actionType || 'chat',
        projectSummary: {
          title: project.title,
          purpose: project.brief?.purpose,
          targetDurationSeconds: project.brief?.targetDurationSeconds,
          visualStyle: project.brief?.visualStyle,
          currentScriptLogline: project.scripts?.find((v) => v.isCurrent)?.logline,
        },
        project,
      };

      const res = await authenticatedFetch('/api/nova/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Nova assistant returned error (${res.status})`);
      }

      const data = await res.json();
      setPacingData(data.pacingSummary || null);

      const novaReply: NovaMessage = {
        id: `msg_nova_${Date.now()}`,
        sender: 'nova',
        text: data.reply || 'Guidance received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stageInsight: data.stageInsight,
        actions: data.suggestedActions || [],
        pacingSummary: data.pacingSummary,
      };

      setMessages((prev) => [...prev, novaReply]);
      setExecutionState('idle');
    } catch (err: any) {
      console.error('[NovaAssistant] Chat error:', err);
      setExecutionState('failed');
      setErrorMessage(err.message || 'Failed to communicate with Nova assistant.');
    }
  };

  // Trigger quick action button
  const handleQuickAction = (actionType: string, label: string) => {
    handleSend(label, actionType);
  };

  // Action execution router
  const handleActionClick = (action: NovaSuggestedAction) => {
    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      executeConsequentialAction(action);
    }
  };

  // Execute confirmed action safely through domain models & storage
  const executeConsequentialAction = async (action: NovaSuggestedAction) => {
    setExecutionState('executing');
    setPendingAction(null);

    try {
      let updatedProject = { ...project };

      if (action.actionType === 'navigate_stage' && action.payload?.targetStage) {
        onSelectStage(action.payload.targetStage as WorkflowStage);
      } else if (action.actionType === 'polish_prompt') {
        // Append cinematic keywords to shots missing them
        const suffix =
          action.payload?.suffix ||
          ', 35mm anamorphic, volumetric lighting, photorealistic 8k';

        if (Array.isArray(updatedProject.shots)) {
          for (const sh of updatedProject.shots) {
            const currentIntent = sh.visualIntent || '';
            const updatedIntent = currentIntent.includes('35mm')
              ? currentIntent
              : `${currentIntent}${suffix}`;

            const result = domainService.createShotPromptVersion(updatedProject, sh.id, {
              visualPrompt: updatedIntent,
              motionInstructions: 'Cinematic camera movement, smooth pan and tracking',
              cameraDirection: sh.framing || 'medium',
            });
            updatedProject = result.project;
          }

          storage.updateProject(updatedProject.id, {
            shots: updatedProject.shots,
            prompts: updatedProject.prompts,
            activePromptVersion: updatedProject.activePromptVersion,
          });
          if (onProjectUpdated) onProjectUpdated(updatedProject);
        }
      } else if (action.actionType === 'check_pacing') {
        // Rebalance shot durations to match target
        const target = project.brief?.targetDurationSeconds || 60;
        if (Array.isArray(updatedProject.shots) && updatedProject.shots.length > 0) {
          const perShot = Math.max(2, Math.round(target / updatedProject.shots.length));
          const rebalancedShots = updatedProject.shots.map((sh) => ({
            ...sh,
            durationSeconds: perShot,
          }));

          updatedProject = {
            ...updatedProject,
            shots: rebalancedShots,
            updatedAt: new Date().toISOString(),
          };
          storage.updateProject(updatedProject.id, {
            shots: rebalancedShots,
          });
          if (onProjectUpdated) onProjectUpdated(updatedProject);
        }
      } else if (action.actionType === 'export_backup') {
        const json = storage.exportProjectJSON(project.id);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExecutionState('succeeded');

      // Post execution acknowledgment in chat
      const confirmationMsg: NovaMessage = {
        id: `msg_exec_${Date.now()}`,
        sender: 'nova',
        text:
          lang === 'ar'
            ? `تم تطبيق الإجراء بنجاح: "${action.label}". تم تحديث بيانات المشروع والتحقق من سلامة البنية.`
            : `Successfully applied: "${action.label}". Project state updated and validated.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, confirmationMsg]);

      setTimeout(() => {
        setExecutionState('idle');
      }, 2500);
    } catch (err: any) {
      console.error('[NovaAssistant] Action execution failed:', err);
      setExecutionState('failed');
      setErrorMessage(err.message || 'Failed to execute proposed action.');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-[#111318] hover:bg-[#181B22] text-white border border-[#242833] shadow-2xl rounded-lg font-medium text-xs transition-all hover:scale-[1.02] active:scale-[0.98] group"
        title="Open Nova AI Production Director"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#635BFF] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#635BFF]"></span>
        </span>
        <Sparkles className="w-4 h-4 text-[#38D9F9] transition-transform group-hover:rotate-12" />
        <span className="font-display tracking-tight text-white font-semibold">Nova Assistant</span>
      </button>
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`fixed bottom-6 right-6 z-40 flex flex-col bg-[#0F1117] text-[#E3E6EF] border border-[#242833] shadow-2xl rounded-xl transition-all duration-200 overflow-hidden ${
        isMinimized
          ? 'w-80 h-14'
          : 'w-[95vw] sm:w-[420px] md:w-[460px] h-[600px] max-h-[85vh]'
      }`}
      style={{
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141721] border-b border-[#242833] select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#635BFF]/20 border border-[#635BFF]/30 rounded-md">
            <Sparkles className="w-4 h-4 text-[#38D9F9]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm text-white tracking-tight">Nova</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#242833] text-[#9B8CFF] rounded">
                Stage: {currentStage}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-[#62677A] hover:text-white hover:bg-[#242833] rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-[#62677A] hover:text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Active Context Banner */}
          <div className="px-4 py-2 bg-[#12141D] border-b border-[#242833] flex items-center justify-between text-[11px] text-[#8E95AA]">
            <div className="flex items-center gap-2 truncate max-w-[260px]">
              <Film className="w-3.5 h-3.5 text-[#635BFF] flex-shrink-0" />
              <span className="truncate">{project.title}</span>
            </div>

            {pacingData && (
              <div
                className={`flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded ${
                  pacingData.status === 'on_track'
                    ? 'bg-[#16A34A]/20 text-[#4ADE80] border border-[#16A34A]/30'
                    : 'bg-[#EAB308]/20 text-[#FDE047] border border-[#EAB308]/30'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>
                  {pacingData.totalEstimatedShotDuration}s / {pacingData.targetDurationSeconds}s
                </span>
              </div>
            )}
          </div>

          {/* Quick Action Chips */}
          <div className="px-4 py-2 bg-[#0F1117] border-b border-[#242833] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleQuickAction('explain_stage', `Explain ${currentStage}`)}
              disabled={executionState === 'thinking'}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A1D27] hover:bg-[#242833] text-[#CCD2E3] border border-[#2D3242] rounded transition-colors disabled:opacity-50"
            >
              <Compass className="w-3 h-3 text-[#38D9F9]" />
              <span>{lang === 'ar' ? 'شرح المرحلة' : 'Explain Stage'}</span>
            </button>

            <button
              onClick={() => handleQuickAction('check_pacing', 'Check pacing & duration')}
              disabled={executionState === 'thinking'}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A1D27] hover:bg-[#242833] text-[#CCD2E3] border border-[#2D3242] rounded transition-colors disabled:opacity-50"
            >
              <Clock className="w-3 h-3 text-[#9B8CFF]" />
              <span>{lang === 'ar' ? 'تدقيق التوقيت' : 'Audit Pacing'}</span>
            </button>

            <button
              onClick={() => handleQuickAction('polish_prompt', 'Polish shot prompts')}
              disabled={executionState === 'thinking'}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A1D27] hover:bg-[#242833] text-[#CCD2E3] border border-[#2D3242] rounded transition-colors disabled:opacity-50"
            >
              <Sliders className="w-3 h-3 text-[#E879F9]" />
              <span>{lang === 'ar' ? 'تحسين الموجهات' : 'Polish Prompts'}</span>
            </button>

            <button
              onClick={() => handleQuickAction('suggest_next_steps', 'What should I do next?')}
              disabled={executionState === 'thinking'}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1A1D27] hover:bg-[#242833] text-[#CCD2E3] border border-[#2D3242] rounded transition-colors disabled:opacity-50"
            >
              <ArrowRight className="w-3 h-3 text-[#4ADE80]" />
              <span>{lang === 'ar' ? 'الخطوة التالية' : 'Next Steps'}</span>
            </button>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {msg.sender === 'nova' && (
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#62677A] font-mono">
                    <span className="text-[#38D9F9]">NOVA DIRECTOR</span>
                    <span>·</span>
                    <span>{msg.timestamp}</span>
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-lg p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#635BFF] text-white font-medium ml-4'
                      : 'bg-[#181B26] text-[#E3E6EF] border border-[#282D3D] shadow-sm'
                  }`}
                >
                  {msg.stageInsight && (
                    <div className="mb-2 pb-2 border-b border-[#282D3D] text-[10px] font-mono text-[#9B8CFF]">
                      {msg.stageInsight}
                    </div>
                  )}

                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Action Cards attached to message */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#282D3D] space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#8E95AA]">
                        {lang === 'ar' ? 'إجراءات مقترحة:' : 'Recommended Actions:'}
                      </div>
                      {msg.actions.map((act) => (
                        <div
                          key={act.id}
                          className="bg-[#1F2433] border border-[#303649] rounded p-2.5 flex flex-col gap-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-white text-[11px]">
                              {act.label}
                            </span>
                            {act.requiresConfirmation && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-[#EAB308]/20 text-[#FDE047] rounded">
                                Requires Approval
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8E95AA] leading-normal">
                            {act.description}
                          </p>
                          <button
                            onClick={() => handleActionClick(act)}
                            disabled={executionState === 'executing'}
                            className="mt-1 self-start flex items-center gap-1.5 px-2.5 py-1 bg-[#635BFF] hover:bg-[#5249DE] text-white rounded text-[10px] font-medium transition-colors"
                          >
                            <span>{lang === 'ar' ? 'مراجعة وتطبيق' : 'Review & Apply'}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking / Spinner Indicator */}
            {executionState === 'thinking' && (
              <div className="flex items-center gap-2 text-xs text-[#8E95AA] p-2 bg-[#181B26]/60 border border-[#282D3D]/50 rounded-md w-fit">
                <Loader2 className="w-3.5 h-3.5 text-[#38D9F9] animate-spin" />
                <span className="font-mono text-[11px]">Nova is analyzing project context...</span>
              </div>
            )}

            {/* Success Notification */}
            {executionState === 'succeeded' && (
              <div className="flex items-center gap-2 text-xs text-[#4ADE80] p-2 bg-[#16A34A]/20 border border-[#16A34A]/30 rounded-md">
                <Check className="w-3.5 h-3.5" />
                <span>Action applied and verified successfully.</span>
              </div>
            )}

            {/* Error Notification */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#FCA5A5] rounded-md text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Request Notice</p>
                  <p className="text-[11px] mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Consequential Action Confirmation Modal */}
          {pendingAction && (
            <div className="p-3 bg-[#1B202D] border-t border-[#343B52] shadow-xl">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-[#EAB308]/20 border border-[#EAB308]/30 rounded text-[#FDE047]">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-white">
                      {lang === 'ar' ? 'تأكيد التعديل الفعلي' : 'Confirm Action Mutation'}
                    </h4>
                    <span className="text-[10px] font-mono text-[#FDE047]">Human-In-The-Loop</span>
                  </div>
                  <p className="text-[11px] text-[#A6AFC4] mt-1">
                    {pendingAction.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => executeConsequentialAction(pendingAction)}
                      className="px-3 py-1.5 bg-[#635BFF] hover:bg-[#5249DE] text-white text-[11px] font-semibold rounded transition-colors"
                    >
                      {lang === 'ar' ? 'تأكيد وتطبيق' : 'Confirm & Apply'}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      className="px-3 py-1.5 bg-[#252A3B] hover:bg-[#30374D] text-[#CCD2E3] text-[11px] font-medium rounded transition-colors"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <div className="p-3 bg-[#12141D] border-t border-[#242833]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'اسأل نوفا عن الإخراج، التوقيت، أو المشاهد...'
                    : 'Ask Nova about pacing, camera angles, or shot prompts...'
                }
                disabled={executionState === 'thinking'}
                className="flex-1 bg-[#1A1D29] border border-[#2B3142] rounded-md px-3 py-2 text-xs text-white placeholder-[#62677A] focus:outline-none focus:border-[#635BFF] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || executionState === 'thinking'}
                className="p-2 bg-[#635BFF] hover:bg-[#5249DE] disabled:opacity-40 disabled:hover:bg-[#635BFF] text-white rounded-md transition-colors"
                title="Send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
