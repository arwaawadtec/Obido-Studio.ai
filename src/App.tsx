/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project } from './types';
import { storage } from './services/storage';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './components/dashboard/Dashboard';
import { Workspace } from './components/workspace/Workspace';
import { TemplatesView } from './components/templates/TemplatesView';
import { CreateProjectModal } from './components/creation/CreateProjectModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { HelpModal } from './components/help/HelpModal';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(storage.getProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(storage.getActiveProjectId());
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'templates'>('dashboard');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    // Sync storage updates
    const unsubscribe = storage.subscribe(() => {
      setProjects(storage.getProjects());
      setActiveProjectId(storage.getActiveProjectId());
    });

    // Initialize document direction from saved language preference
    const initialLang = storage.getLanguagePreference();
    document.documentElement.setAttribute('dir', initialLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', initialLang);

    return unsubscribe;
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleSelectProject = (projectId: string) => {
    storage.setActiveProjectId(projectId);
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

  const handleProjectCreated = (newProjectId: string) => {
    handleSelectProject(newProjectId);
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#171A2B] flex flex-col font-sans selection:bg-[#635BFF]/20 selection:text-[#11152B]">
      {/* Top Application Shell Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'workspace' && !activeProject) {
            setIsCreateModalOpen(true);
            return;
          }
          setCurrentView(view);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        activeProjectTitle={activeProject?.title}
      />

      {/* Main Content Area */}
      <div className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            projects={projects}
            onSelectProject={handleSelectProject}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        )}

        {currentView === 'workspace' && activeProject && (
          <Workspace
            project={activeProject}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'templates' && (
          <TemplatesView onSelectProject={handleSelectProject} />
        )}
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
