import React, { useState } from 'react';
import { Project, WorkflowStage } from '../../types';
import { storage } from '../../services/storage';
import { WorkspaceHeader } from './WorkspaceHeader';
import { BriefStage } from './BriefStage';
import { ScriptStage } from './ScriptStage';
import { ScenesStage } from './ScenesStage';
import { ShotListStage } from './ShotListStage';
import { StoryboardStage } from './StoryboardStage';
import { PromptsStage } from './PromptsStage';
import { AssetsStage } from './AssetsStage';
import { GenerationStage } from './GenerationStage';
import { EditorStage } from './EditorStage';
import { ExportStage } from './ExportStage';
import { NovaAssistant } from '../nova/NovaAssistant';

interface WorkspaceProps {
  project: Project;
  onBackToDashboard: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project, onBackToDashboard }) => {
  const [activeProject, setActiveProject] = useState<Project>(project);
  const [currentStage, setCurrentStage] = useState<WorkflowStage>(project.currentStage || 'brief');
  const [isNovaOpen, setIsNovaOpen] = useState(false);

  const handleSelectStage = (stage: WorkflowStage) => {
    setCurrentStage(stage);
    storage.setWorkflowStage(activeProject.id, stage);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col bg-[#F6F7FB] relative">
      <WorkspaceHeader
        project={activeProject}
        currentStage={currentStage}
        onSelectStage={handleSelectStage}
        onBackToDashboard={onBackToDashboard}
        isNovaOpen={isNovaOpen}
        onToggleNova={() => setIsNovaOpen(!isNovaOpen)}
      />

      <main className="flex-1 px-4 sm:px-6 py-8">
        {/* Stage 1: Strategic Brief */}
        {currentStage === 'brief' && (
          <BriefStage
            project={activeProject}
            onProceedToScript={() => handleSelectStage('script')}
          />
        )}

        {/* Stage 2: Narrative Script & Pacing */}
        {currentStage === 'script' && (
          <ScriptStage
            project={activeProject}
            onProceedToScenes={() => handleSelectStage('scenes')}
            onProceedToStoryboard={() => handleSelectStage('scenes')}
          />
        )}

        {/* Stage 3: Narrative Scenes Architecture */}
        {currentStage === 'scenes' && (
          <ScenesStage
            project={activeProject}
            onProceedToShots={() => handleSelectStage('shots')}
          />
        )}

        {/* Stage 4: Shot List & Cinematography */}
        {currentStage === 'shots' && (
          <ShotListStage
            project={activeProject}
            onProceedToStoryboard={() => handleSelectStage('storyboard')}
          />
        )}

        {/* Stage 5: Storyboard Panels & Visual Continuity */}
        {currentStage === 'storyboard' && (
          <StoryboardStage
            project={activeProject}
            onProceedToPrompts={() => handleSelectStage('prompts')}
          />
        )}

        {/* Stage 6: Shot Prompt Engineering */}
        {currentStage === 'prompts' && (
          <PromptsStage
            project={activeProject}
            onProceedToAssets={() => handleSelectStage('assets')}
            onProceedToGeneration={() => handleSelectStage('assets')}
          />
        )}

        {/* Stage 7: Assets & Media Repository */}
        {currentStage === 'assets' && (
          <AssetsStage
            project={activeProject}
            onProceedToGeneration={() => handleSelectStage('generation')}
            onProceedToEditing={() => handleSelectStage('generation')}
          />
        )}

        {/* Stage 8: Shot Video Generation & Take Simulation */}
        {currentStage === 'generation' && (
          <GenerationStage
            project={activeProject}
            onProceedToEditing={() => handleSelectStage('editing')}
            onProceedToAssets={() => handleSelectStage('editing')}
            onNavigateToPrompts={() => handleSelectStage('prompts')}
          />
        )}

        {/* Stage 9: Multi-Track Timeline Studio */}
        {currentStage === 'editing' && (
          <EditorStage
            project={activeProject}
            onProceedToExport={() => handleSelectStage('export')}
          />
        )}

        {/* Stage 10: Master Export & Production Package */}
        {currentStage === 'export' && <ExportStage project={activeProject} />}
      </main>

      <NovaAssistant
        project={activeProject}
        currentStage={currentStage}
        isOpen={isNovaOpen}
        onToggle={() => setIsNovaOpen(!isNovaOpen)}
        onSelectStage={handleSelectStage}
        onProjectUpdated={setActiveProject}
      />
    </div>
  );
};
