import { createContext, useContext } from 'react';
import type * as fabric from 'fabric';

const CanvasContext = createContext<fabric.Canvas | null>(null);

export const CanvasProvider = CanvasContext.Provider;

export function useCanvas(): fabric.Canvas | null {
  return useContext(CanvasContext);
}
