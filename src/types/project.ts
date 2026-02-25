import { Timestamp } from 'firebase/firestore';

export interface InputImage {
  id: string;
  file?: File;
  url: string;
  originalName: string;
  width: number;
  height: number;
  storageRef?: string;
}

export interface InputText {
  id: string;
  content: string;
  role: 'heading' | 'subheading' | 'body';
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  templateId: string;
  orientation: 'portrait' | 'landscape';
  canvasJSON: string;
  inputImages: Omit<InputImage, 'file'>[];
  inputTexts: InputText[];
  thumbnailRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
