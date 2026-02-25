import type { Template } from '../../types/template';

interface TemplateCardProps {
  template: Template;
  onSelect: (template: Template) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const isPortrait = template.orientation === 'portrait';

  return (
    <div className="template-card" onClick={() => onSelect(template)}>
      <div
        className="template-card-preview"
        style={{
          aspectRatio: isPortrait ? '210 / 297' : '297 / 210',
        }}
      >
        {template.thumbnail ? (
          <img src={template.thumbnail} alt={template.name} />
        ) : (
          <div className="template-placeholder">
            <span>{isPortrait ? 'A4 縦' : 'A4 横'}</span>
          </div>
        )}
      </div>
      <p className="template-card-name">{template.name}</p>
    </div>
  );
}
