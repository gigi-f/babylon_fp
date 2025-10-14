import PhotoStack, { addPhotoToStack } from "../ui/photoStack";
import { Logger } from "../utils/logger";

const log = Logger.create('PhotoSystem');

export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: number;
}

const STORAGE_KEY = "polaroid_photos_v1";

/**
 * Validate that a string is a valid data URL
 */
function isValidDataUrl(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return false;
  }
  // Basic check: should start with data: and contain base64
  return dataUrl.startsWith('data:') && dataUrl.includes('base64');
}

function safeParse(raw: string | null): Photo[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      log.warn('Photo storage contained invalid data (not an array)');
      return [];
    }
    return parsed;
  } catch (error) {
    log.error('Failed to parse photo storage', error);
    return [];
  }
}

function readStore(): Photo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return safeParse(raw);
  } catch (error) {
    log.error('Failed to read photo storage', error);
    return [];
  }
}

function writeStore(photos: Photo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    log.debug(`Wrote ${photos.length} photos to storage`);
  } catch (error) {
    log.error('Failed to write photo storage', error);
  }
}

export function savePhoto(dataUrl: string): Photo {
  // Input validation
  if (!isValidDataUrl(dataUrl)) {
    const error = new Error('Invalid dataUrl provided to savePhoto: must be a valid data URL with base64 encoding');
    log.error('Photo save failed', error);
    throw error;
  }

  try {
    const photo: Photo = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
      dataUrl,
      timestamp: Date.now(),
    };
    const photos = readStore();
    photos.push(photo);
    writeStore(photos);
    
    // update UI immediately
    try {
      addPhotoToStack(dataUrl);
      log.info('Photo saved successfully', { id: photo.id });
    } catch (error) {
      log.warn('Photo saved but UI update failed', error);
    }
    
    return photo;
  } catch (error) {
    log.error('Failed to save photo', error);
    // On failure, return minimal fallback and still attempt UI update
    const fallback: Photo = { id: `fail_${Date.now()}`, dataUrl, timestamp: Date.now() };
    try { addPhotoToStack(dataUrl); } catch {}
    return fallback;
  }
}

export function getPhotos(): Photo[] {
  log.debug('Retrieving photos from storage');
  return readStore();
}

export function removePhoto(id: string): boolean {
  if (!id || typeof id !== 'string') {
    log.warn('Invalid photo ID provided to removePhoto', { id });
    return false;
  }

  try {
    const photos = readStore();
    const idx = photos.findIndex((p) => p.id === id);
    if (idx < 0) {
      log.warn('Photo not found for removal', { id });
      return false;
    }
    photos.splice(idx, 1);
    writeStore(photos);
    log.info('Photo removed successfully', { id });
    return true;
  } catch (error) {
    log.error('Failed to remove photo', error);
    return false;
  }
}

export function clearPhotos(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    log.info('All photos cleared');
  } catch (error) {
    log.error('Failed to clear photos', error);
  }
}

export function restorePhotos(): void {
  try {
    const photos = readStore();
    log.info(`Restoring ${photos.length} photos to UI`);
    
    // Append in chronological order so oldest at top, newest bottom (matches panel)
    for (const p of photos) {
      try {
        addPhotoToStack(p.dataUrl);
      } catch (error) {
        log.warn('Failed to restore photo to UI', { photoId: p.id, error });
      }
    }
  } catch (error) {
    log.error('Failed to restore photos', error);
  }
}

// expose for quick debugging in browser console
try {
  (window as any).photoSystem = { savePhoto, getPhotos, removePhoto, clearPhotos, restorePhotos };
  log.debug('PhotoSystem exposed to window for debugging');
} catch {
  // Silently fail if window is not available (e.g., in tests)
}

export default { savePhoto, getPhotos, removePhoto, clearPhotos, restorePhotos };