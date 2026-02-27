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

const UPLOAD_TIMEOUT_MS = 45_000;
const DOWNLOAD_URL_TIMEOUT_MS = 15_000;
const SAVE_TEMPLATES_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function stripLocalOnlySources(templates: LayoutTemplate[]): LayoutTemplate[] {
  return templates.map((template) => ({
    ...template,
    elements: template.elements.map((element) => {
      if (element.kind !== 'image' || !element.src) return element;
      if (!element.src.startsWith('data:') && !element.src.startsWith('blob:')) return element;
      const { src: _removed, ...rest } = element;
      return rest;
    }),
  }));
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
  const cloudTemplates = stripLocalOnlySources(templates);
  await withTimeout(
    setDoc(
      studioRef,
      {
        templates: cloudTemplates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    SAVE_TEMPLATES_TIMEOUT_MS,
    'saveStudioTemplates'
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
  await withTimeout(uploadBytes(storageRef, file), UPLOAD_TIMEOUT_MS, 'uploadBytes');
  return withTimeout(getDownloadURL(storageRef), DOWNLOAD_URL_TIMEOUT_MS, 'getDownloadURL');
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
