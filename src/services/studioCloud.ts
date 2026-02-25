import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import type { LayoutTemplate, StudioProjectSummary } from '../types/studio';

const STUDIO_ROOT = 'admin';
const STUDIO_DOC = 'templateStudio';
const PROJECTS = 'projects';

interface StudioDocument {
  templates?: unknown;
}

function toIsoDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
  }

  return undefined;
}

export function subscribeStudioTemplates(
  onTemplates: (templates: LayoutTemplate[]) => void,
  onError?: (error: Error) => void
): () => void {
  const studioRef = doc(db, STUDIO_ROOT, STUDIO_DOC);

  return onSnapshot(
    studioRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onTemplates([]);
        return;
      }

      const data = snapshot.data() as StudioDocument;
      const templates = Array.isArray(data.templates) ? (data.templates as LayoutTemplate[]) : [];
      onTemplates(templates);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function saveStudioTemplates(templates: LayoutTemplate[]): Promise<void> {
  const studioRef = doc(db, STUDIO_ROOT, STUDIO_DOC);
  await setDoc(
    studioRef,
    {
      templates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function sanitizeFileName(name: string): string {
  const replaced = name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return replaced.length > 0 ? replaced : 'asset';
}

export async function uploadTemplateImage(
  templateId: string,
  imageId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const safeName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
  const storageRef = ref(
    storage,
    `studio/templates/${templateId}/images/${imageId}-${safeName}.${ext}`
  );
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function subscribeStudioProjects(
  onProjects: (projects: StudioProjectSummary[]) => void,
  onError?: (error: Error) => void
): () => void {
  const projectsRef = collection(db, PROJECTS);

  return onSnapshot(
    projectsRef,
    (snapshot) => {
      const projects: StudioProjectSummary[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const orientation: 'portrait' | 'landscape' =
            data.orientation === 'landscape' ? 'landscape' : 'portrait';

          return {
            id: docSnap.id,
            userId: typeof data.userId === 'string' ? data.userId : '-',
            name: typeof data.name === 'string' ? data.name : 'Untitled',
            templateId: typeof data.templateId === 'string' ? data.templateId : '-',
            orientation,
            thumbnailRef: typeof data.thumbnailRef === 'string' ? data.thumbnailRef : undefined,
            createdAt: toIsoDate(data.createdAt),
            updatedAt: toIsoDate(data.updatedAt),
          };
        })
        .sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });

      onProjects(projects);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}
