import { create } from 'zustand';
import type { InputImage, InputText } from '../types/project';

interface ProjectState {
  projectId: string | null;
  projectName: string;
  templateId: string;
  orientation: 'portrait' | 'landscape';
  inputImages: InputImage[];
  inputTexts: InputText[];
  canvasJSON: string | null;

  setProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setTemplate: (
    templateId: string,
    orientation: 'portrait' | 'landscape',
    canvasJSON?: string | null
  ) => void;
  addInputImage: (image: InputImage) => void;
  removeInputImage: (id: string) => void;
  addInputText: (text: InputText) => void;
  updateInputText: (id: string, updates: Partial<InputText>) => void;
  removeInputText: (id: string) => void;
  setCanvasJSON: (json: string) => void;
  reset: () => void;
}

const initialState = {
  projectId: null,
  projectName: '無題のチラシ',
  templateId: '',
  orientation: 'portrait' as const,
  inputImages: [] as InputImage[],
  inputTexts: [] as InputText[],
  canvasJSON: null,
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,
  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setTemplate: (templateId, orientation, canvasJSON = null) =>
    set({ templateId, orientation, canvasJSON }),
  addInputImage: (image) => set((s) => ({ inputImages: [...s.inputImages, image] })),
  removeInputImage: (id) => set((s) => ({ inputImages: s.inputImages.filter((i) => i.id !== id) })),
  addInputText: (text) => set((s) => ({ inputTexts: [...s.inputTexts, text] })),
  updateInputText: (id, updates) =>
    set((s) => ({
      inputTexts: s.inputTexts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeInputText: (id) => set((s) => ({ inputTexts: s.inputTexts.filter((t) => t.id !== id) })),
  setCanvasJSON: (json) => set({ canvasJSON: json }),
  reset: () => set(initialState),
}));
