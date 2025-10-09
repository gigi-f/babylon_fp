import PhotoStack, { addPhotoToStack } from "../ui/photoStack";

export interface Photo {
  id: string;
  dataUrl: string;
  timestamp: number;
}

const STORAGE_KEY = "polaroid_photos_v1";

function safeParse(raw: string | null): Photo[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function readStore(): Photo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return safeParse(raw);
  } catch {
    return [];
  }
}

function writeStore(photos: Photo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {}
}

export function savePhoto(dataUrl: string): Photo {
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
    try { addPhotoToStack(dataUrl); } catch {}
    return photo;
  } catch {
    // On failure, return minimal fallback and still attempt UI update
    const fallback: Photo = { id: `fail_${Date.now()}`, dataUrl, timestamp: Date.now() };
    try { addPhotoToStack(dataUrl); } catch {}
    return fallback;
  }
}

export function getPhotos(): Photo[] {
  return readStore();
}

export function removePhoto(id: string): boolean {
  try {
    const photos = readStore();
    const idx = photos.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    photos.splice(idx, 1);
    writeStore(photos);
    return true;
  } catch {
    return false;
  }
}

export function clearPhotos(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function restorePhotos(): void {
  try {
    const photos = readStore();
    // Append in chronological order so oldest at top, newest bottom (matches panel)
    for (const p of photos) {
      try { addPhotoToStack(p.dataUrl); } catch {}
    }
  } catch {}
}

// expose for quick debugging in browser console
try { (window as any).photoSystem = { savePhoto, getPhotos, removePhoto, clearPhotos, restorePhotos }; } catch {}

export default { savePhoto, getPhotos, removePhoto, clearPhotos, restorePhotos };