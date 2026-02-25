export interface Placeholder {
  id: string;
  type: 'image' | 'text' | 'heading';
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
  style?: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  thumbnail: string;
  category: string;
  isBuiltIn: boolean;
  canvasJSON: string;
  placeholders: Placeholder[];
}
