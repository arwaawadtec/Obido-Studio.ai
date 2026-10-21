import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { cloudStorage, isFirebaseAvailable } from './firebase';

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  filesizeBytes: number;
}

export class CloudStorageService {
  isAvailable(): boolean {
    return isFirebaseAvailable && !!cloudStorage;
  }

  /**
   * Uploads binary media (File, Blob, or base64 data URL) to Cloud Object Storage.
   * Path: users/{userId}/projects/{projectId}/assets/{assetId}_{filename}
   */
  async uploadMedia(
    userId: string,
    projectId: string,
    assetId: string,
    fileOrData: File | Blob | string,
    filename: string,
    contentType?: string
  ): Promise<UploadResult> {
    if (!this.isAvailable()) {
      throw new Error('Cloud Object Storage is not configured.');
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `users/${userId}/projects/${projectId}/assets/${assetId}_${sanitizedFilename}`;
    const storageRef = ref(cloudStorage, storagePath);

    if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
      // Data URL upload
      await uploadString(storageRef, fileOrData, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      // Estimate size from base64 length
      const filesizeBytes = Math.round((fileOrData.length * 3) / 4);
      return { downloadUrl, storagePath, filesizeBytes };
    } else {
      // Blob or File upload
      let blob: Blob;
      if (typeof fileOrData === 'string') {
        blob = new Blob([fileOrData], { type: contentType || 'text/plain' });
      } else {
        blob = fileOrData;
      }
      const metadata = contentType ? { contentType } : undefined;
      const snapshot = await uploadBytes(storageRef, blob, metadata);
      const downloadUrl = await getDownloadURL(storageRef);
      return {
        downloadUrl,
        storagePath,
        filesizeBytes: snapshot.metadata.size || blob.size,
      };
    }
  }

  /**
   * Deletes a media file from Cloud Object Storage given its storage path.
   */
  async deleteMedia(storagePath: string): Promise<boolean> {
    if (!this.isAvailable() || !storagePath) return false;
    try {
      const storageRef = ref(cloudStorage, storagePath);
      await deleteObject(storageRef);
      return true;
    } catch (err) {
      console.warn('[CloudStorage] Failed to delete file at path:', storagePath, err);
      return false;
    }
  }
}

export const cloudStorageService = new CloudStorageService();
