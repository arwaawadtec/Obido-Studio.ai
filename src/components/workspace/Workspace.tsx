import React, { useState } from 'react';
import { Project, WorkflowStage } from '../../types';
import { storage } from '../../services/storage';
import { WorkspaceHeader } from './WorkspaceHeader';
import { BriefStage } from './BriefStage';
import { ScriptStage } from './ScriptStage';
import { StoryboardStage } from './StoryboardStage';
import { PromptsStage } from './PromptsStage';
import { AssetsStage } from './AssetsStage';
import { GenerationStage } from './GenerationStage';
import { EditorStage } from './EditorStage';
import { ExportStage } from './ExportStage';

interface WorkspaceProps {
  project: Project;
  onBackToDashboard: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project, onBackToDashboard }) => {
  const [currentStage, setCurrentStage] = useState<WorkflowStage>(project.currentStage || 'brief');

  const handleSelectStage = (stage: WorkflowStage) => {
    setCurrentStage(stage);
    storage.setWorkflowStage(project.id, stage);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col bg-[#F6F7FB]">
      <WorkspaceHeader
        project={project}
        currentStage={currentStage}
        onSelectStage={handleSelectStage}
        onBackToDashboard={onBackToDashboard}
      />

      <main className="flex-1 px-4 sm:px-6 py-8">
        {currentStage === 'brief' && (
          <BriefStage
            project={project}
            onProceedToScript={() => handleSelectStage('script')}
          />
        )}

        {currentStage === 'script' && (
          <ScriptStage
            project={project}
            onProceedToStoryboard={() => handleSelectStage('storyboard')}
          />
        )}

        {currentStage === 'storyboard' && (
          <StoryboardStage
            project={project}
            onProceedToPrompts={() => handleSelectStage('prompts')}
          />
        )}

        {currentStage === 'prompts' && (
          <PromptsStage
            project={project}
            onProceedToGeneration={() => handleSelectStage('generation')}
          />
        )}

        {currentStage === 'generation' && (
          <GenerationStage
            project={project}
            onProceedToAssets={() => handleSelectStage('assets')}
          />
        )}

        {currentStage === 'assets' && (
          <AssetsStage
            project={project}
            onProceedToEditing={() => handleSelectStage('editing')}
          />
        )}

        {currentStage === 'editing' && (
          <EditorStage
            project={project}
            onProceedToExport={() => handleSelectStage('export')}
          />
        )}

        {currentStage === 'export' && <ExportStage project={project} />}
      </main>
    </div>
  );
};
