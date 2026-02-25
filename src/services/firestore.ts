import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Project } from '../types/project';

const PROJECTS = 'projects';

export async function saveProject(
  project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, PROJECTS), {
    ...project,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, PROJECTS, projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS, projectId));
}

export async function getProject(projectId: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, PROJECTS, projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Project;
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  // Avoid requiring a composite index by sorting client-side.
  const q = query(collection(db, PROJECTS), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Project))
    .sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
}
