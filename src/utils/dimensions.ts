export const A4 = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
  printPortrait: { width: 2480, height: 3508 },
  printLandscape: { width: 3508, height: 2480 },
} as const;

export const CANVAS_PADDING = 40;

export function getCanvasDimensions(orientation: 'portrait' | 'landscape') {
  return orientation === 'portrait' ? A4.portrait : A4.landscape;
}

export function scaleToFit(
  containerWidth: number,
  containerHeight: number,
  orientation: 'portrait' | 'landscape'
) {
  const dims = getCanvasDimensions(orientation);
  const scaleX = containerWidth / dims.width;
  const scaleY = containerHeight / dims.height;
  return Math.min(scaleX, scaleY, 1);
}
