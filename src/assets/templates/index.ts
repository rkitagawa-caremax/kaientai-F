import type { Template } from '../../types/template';
import blankPortrait from './blank-portrait.json';
import blankLandscape from './blank-landscape.json';
import kaientaiNewsFoodOrangeTemplate from './kaientai-news-food-orange';

export const builtInTemplates: Template[] = [
  kaientaiNewsFoodOrangeTemplate,
  blankPortrait as Template,
  blankLandscape as Template,
];

const builtInTemplateMap = new Map<string, Template>(
  builtInTemplates.map((template) => [template.id, template])
);

export function getBuiltInTemplateById(templateId: string): Template | null {
  return builtInTemplateMap.get(templateId) ?? null;
}
