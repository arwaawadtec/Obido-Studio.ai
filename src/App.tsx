/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project } from './types';
import { storage } from './services/storage';
import { auth } from './services/auth';
import { router, AppRoute } from './services/router';
import { Navbar } from './components/layout/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { SignInPage } from './components/auth/SignInPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { OnboardingPage } from './components/onboarding/OnboardingPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { Workspace } from './components/workspace/Workspace';
import { TemplatesView } from './components/templates/TemplatesView';
import { CreateProjectModal } from './components/creation/CreateProjectModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { HelpModal } from './components/help/HelpModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(auth.getCurrentUser());
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(router.getRoute());
  const [projects, setProjects] = useState<Project[]>(storage.getProjects(auth.getCurrentUser()?.id));
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectQueryError, setProjectQueryError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const loadProjects = async (userId?: string) => {
    setIsLoadingProjects(true);
    setProjectQueryError(null);
    try {
      const list = await storage.queryProjects(userId);
      setProjects(list);
    } catch (err: any) {
      setProjectQueryError(err?.message || 'Failed to query user projects');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    // Initial project query
    loadProjects(auth.getCurrentUser()?.id);

    // Subscribe to router
    const unsubRouter = router.subscribe((route) => {
      setCurrentRoute(route);
    });

    // Subscribe to auth
    const unsubAuth = auth.subscribe(() => {
      const user = auth.getCurrentUser();
      setCurrentUser(user);
      loadProjects(user?.id);
    });

    // Subscribe to storage
    const unsubStorage = storage.subscribe(() => {
      const user = auth.getCurrentUser();
      setProjects(storage.getProjects(user?.id));
    });

    // Initialize document direction from saved language preference
    const initialLang = storage.getLanguagePreference();
    document.documentElement.setAttribute('dir', initialLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', initialLang);

    return () => {
      unsubRouter();
      unsubAuth();
      unsubStorage();
    };
  }, []);

  const handleSelectProject = (projectId: string) => {
    storage.setActiveProjectId(projectId);
    router.navigate(`/app/workspace/${projectId}`);
  };

  const handleProjectCreated = (newProjectId: string) => {
    handleSelectProject(newProjectId);
  };

  // Determine active project for workspace
  let workspaceProjectId: string | undefined;
  if (currentRoute.path === '/app/workspace') {
    workspaceProjectId = (currentRoute as any).projectId;
  }
  const activeWorkspaceProject = workspaceProjectId
    ? projects.find((p) => p.id === workspaceProjectId) || storage.getProject(workspaceProjectId, currentUser?.id)
    : projects[0];

  // Route 1: Public Marketing Landing Page
  if (currentRoute.path === '/') {
    return (
      <>
        <LandingPage onOpenHelp={() => setIsHelpOpen(true)} />
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </>
    );
  }

  // Route 2: Sign In
  if (currentRoute.path === '/sign-in') {
    return <SignInPage />;
  }

  // Route 3: Sign Up
  if (currentRoute.path === '/sign-up') {
    return <SignUpPage />;
  }

  // Route 4: Forgot Password
  if (currentRoute.path === '/forgot-password') {
    return <ForgotPasswordPage />;
  }

  // Route 4b: Password Reset Completion
  if (currentRoute.path === '/reset-password') {
    return <ResetPasswordPage oobCode={(currentRoute as any).oobCode} />;
  }

  // Route 5: Onboarding
  if (currentRoute.path === '/onboarding') {
    return <OnboardingPage />;
  }

  // Authenticated Studio App Shell (`/app`, `/app/projects`, `/app/workspace/:projectId`, `/app/templates`)
  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#171A2B] flex flex-col font-sans selection:bg-[#635BFF]/20 selection:text-[#11152B]">
      {/* Top Application Shell Navbar */}
      <Navbar
        currentPath={router.getPath()}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        activeProjectTitle={activeWorkspaceProject?.title}
      />

      {/* Main Authenticated View Content */}
      <div className="flex-1">
        {(currentRoute.path === '/app' || currentRoute.path === '/app/projects') && (
          <Dashboard
            projects={projects}
            onSelectProject={handleSelectProject}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            isLoading={isLoadingProjects}
            queryError={projectQueryError}
            onRetryQuery={() => loadProjects(currentUser?.id)}
          />
        )}

        {currentRoute.path === '/app/workspace' && activeWorkspaceProject && (
          <Workspace
            project={activeWorkspaceProject}
            onBackToDashboard={() => router.navigate('/app')}
          />
        )}

        {currentRoute.path === '/app/templates' && (
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
