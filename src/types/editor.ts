export type ActiveTool = 'select' | 'text' | 'image' | 'pan';

export interface SelectedObjectProps {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fill?: string;
  textAlign?: string;
  fontWeight?: string;
  fontStyle?: string;
}
