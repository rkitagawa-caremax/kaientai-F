import { create } from 'zustand';
import type { ActiveTool } from '../types/editor';

interface EditorState {
  selectedObjectId: string | null;
  activeTool: ActiveTool;
  zoom: number;
  canvasReady: boolean;

  setSelectedObject: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setZoom: (zoom: number) => void;
  setCanvasReady: (ready: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedObjectId: null,
  activeTool: 'select',
  zoom: 1,
  canvasReady: false,

  setSelectedObject: (id) => set({ selectedObjectId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom }),
  setCanvasReady: (ready) => set({ canvasReady: ready }),
}));
