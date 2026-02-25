import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImage(
  userId: string,
  projectId: string,
  file: File,
  imageId: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const storageRef = ref(storage, `users/${userId}/projects/${projectId}/images/${imageId}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteImage(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

export async function uploadThumbnail(
  userId: string,
  projectId: string,
  blob: Blob
): Promise<string> {
  const storageRef = ref(storage, `users/${userId}/projects/${projectId}/thumbnail.png`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
