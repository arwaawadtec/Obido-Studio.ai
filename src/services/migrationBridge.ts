import { Project, Asset } from '../types';
import { firestoreService } from './firestoreService';
import { cloudStorageService } from './cloudStorageService';

const LOCAL_STORAGE_KEY = 'obido_studio_projects_v1';

export interface MigrationItemStatus {
  projectId: string;
  projectTitle: string;
  status: 'pending' | 'uploading_media' | 'saving_document' | 'verifying' | 'succeeded' | 'failed';
  error?: string;
  assetsMigratedCount: number;
}

export interface MigrationSummary {
  total: number;
  succeeded: number;
  failed: number;
  items: MigrationItemStatus[];
  inProgress: boolean;
  completedAt?: string;
}

export class MigrationBridge {
  private inProgress = false;
  private listeners: Array<(summary: MigrationSummary) => void> = [];

  subscribe(listener: (summary: MigrationSummary) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(summary: MigrationSummary) {
    this.listeners.forEach((l) => l(summary));
  }

  /**
   * Scans local browser storage to find existing projects.
   * Returns all local projects, including those flagged as migrated.
   */
  getLocalProjects(): Project[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[MigrationBridge] Failed to read local projects:', e);
      return [];
    }
  }

  /**
   * Returns local projects that have not yet been marked as migrated to the cloud.
   */
  getPendingProjects(): Project[] {
    const all = this.getLocalProjects();
    return all.filter((p) => p.isLocalOnly !== false || !p.migratedFromLocal);
  }

  /**
   * Idempotently migrates all or specified local projects to Firestore and Cloud Storage.
   * - Preserves project IDs, scene numbers, prompt history, and timeline clips.
   * - Uploads embedded/local media to Cloud Storage.
   * - Verifies successful write before marking project as migrated.
   * - Never deletes the local copy.
   */
  async migrateProjects(
    userId: string,
    targetProjectIds?: string[]
  ): Promise<MigrationSummary> {
    if (this.inProgress) {
      throw new Error('A migration is already in progress.');
    }
    if (!userId) {
      throw new Error('Authentication required: A valid user ID is needed to associate migrated projects.');
    }

    this.inProgress = true;
    const allLocal = this.getLocalProjects();
    const toMigrate = targetProjectIds
      ? allLocal.filter((p) => targetProjectIds.includes(p.id))
      : allLocal;

    const summary: MigrationSummary = {
      total: toMigrate.length,
      succeeded: 0,
      failed: 0,
      items: toMigrate.map((p) => ({
        projectId: p.id,
        projectTitle: p.title,
        status: 'pending',
        assetsMigratedCount: 0,
      })),
      inProgress: true,
    };

    this.notify(summary);

    for (let i = 0; i < toMigrate.length; i++) {
      const project = toMigrate[i];
      const item = summary.items[i];

      try {
        // Step 1: Upload media files if any asset has local data or URLs
        item.status = 'uploading_media';
        this.notify(summary);

        const updatedAssets: Asset[] = [];
        for (const asset of project.assets || []) {
          // If asset contains inline base64 or blob URL that requires cloud object storage
          if (asset.url && (asset.url.startsWith('data:') || asset.url.startsWith('blob:'))) {
            try {
              const uploadRes = await cloudStorageService.uploadMedia(
                userId,
                project.id,
                asset.id,
                asset.url,
                asset.name || 'asset',
                asset.format ? `video/${asset.format}` : undefined
              );
              updatedAssets.push({
                ...asset,
                url: uploadRes.downloadUrl,
                filesizeBytes: uploadRes.filesizeBytes,
                metadata: {
                  ...asset.metadata,
                  cloudStoragePath: uploadRes.storagePath,
                },
              });
              item.assetsMigratedCount++;
            } catch (mediaErr: any) {
              console.warn(`[MigrationBridge] Media upload warning for asset ${asset.id}:`, mediaErr);
              // Fallback: keep asset metadata intact with local note
              updatedAssets.push({
                ...asset,
                metadata: {
                  ...asset.metadata,
                  migrationWarning: 'Media binary upload failed; metadata preserved.',
                },
              });
            }
          } else {
            updatedAssets.push(asset);
          }
        }

        // Step 2: Prepare sanitized cloud project with strict ownership
        item.status = 'saving_document';
        this.notify(summary);

        const cloudProject: Project = {
          ...project,
          userId, // Cloud ownership assigned to authenticated user
          isLocalOnly: false,
          migratedFromLocal: true,
          migratedAt: new Date().toISOString(),
          assets: updatedAssets,
          updatedAt: new Date().toISOString(),
        };

        // Write to Firestore
        await firestoreService.saveProject(cloudProject, userId);

        // Step 3: Verification (Read-after-write confirmation)
        item.status = 'verifying';
        this.notify(summary);

        const verified = await firestoreService.getProject(cloudProject.id, userId);
        if (!verified || verified.id !== cloudProject.id) {
          throw new Error('Write verification failed: Document was not retrievable from Firestore.');
        }

        // Step 4: Mark local copy as migrated (never delete it!)
        item.status = 'succeeded';
        summary.succeeded++;

        this.markLocalProjectMigrated(project.id, cloudProject.migratedAt!);
      } catch (err: any) {
        console.error(`[MigrationBridge] Failed to migrate project ${project.id}:`, err);
        item.status = 'failed';
        item.error = err.message || 'Unknown migration error';
        summary.failed++;
      }

      this.notify(summary);
    }

    summary.inProgress = false;
    summary.completedAt = new Date().toISOString();
    this.inProgress = false;
    this.notify(summary);
    return summary;
  }

  private markLocalProjectMigrated(projectId: string, migratedAt: string) {
    try {
      const all = this.getLocalProjects();
      const updated = all.map((p) =>
        p.id === projectId
          ? { ...p, isLocalOnly: false, migratedFromLocal: true, migratedAt }
          : p
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[MigrationBridge] Failed to update local migration status flag:', e);
    }
  }
}

export const migrationBridge = new MigrationBridge();
