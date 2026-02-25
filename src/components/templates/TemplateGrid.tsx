import { TemplateCard } from './TemplateCard';
import type { Template } from '../../types/template';

interface TemplateGridProps {
  templates: Template[];
  onSelect: (template: Template) => void;
}

export function TemplateGrid({ templates, onSelect }: TemplateGridProps) {
  return (
    <div className="template-grid">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onSelect={onSelect} />
      ))}
    </div>
  );
}
