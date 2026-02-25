import type { Template } from '../../types/template';
import excelFrameFull from '../template-images/excel-frame-full.png';

const canvas = {
  version: '6.0.0',
  objects: [
    {
      type: 'image',
      version: '6.0.0',
      originX: 'left',
      originY: 'top',
      left: 15.89,
      top: 0,
      width: 805,
      height: 1186,
      scaleX: 0.94688,
      scaleY: 0.94688,
      src: excelFrameFull,
      selectable: false,
      evented: false,
      id: 'excel-full-frame',
      elementName: 'Excel Frame',
    },
  ],
};

const kaientaiNewsFoodOrangeTemplate: Template = {
  id: 'kaientai-news-202601-food-orange',
  name: 'Kaientai News 2026.01 Food Orange',
  orientation: 'portrait',
  thumbnail: excelFrameFull,
  category: 'kaientai-news',
  isBuiltIn: true,
  canvasJSON: JSON.stringify(canvas),
  placeholders: [
    {
      id: 'main-visual-zone',
      type: 'image',
      left: 42,
      top: 176,
      width: 710,
      height: 836,
      zIndex: 1,
    },
  ],
};

export default kaientaiNewsFoodOrangeTemplate;
