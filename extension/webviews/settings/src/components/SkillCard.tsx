import type { SkillFileEntry } from '../types';

interface Props {
  file: SkillFileEntry;
  onOpen: (path: string) => void;
}

/**
 * AI-tab card for a generated skill file. Cards are already segmented by agent
 * (sub-tabs), so the badge just reads `skill` — or `router` for the agent's main
 * dictionary file, which the list sorts into the first grid position.
 */
export function SkillCard({ file, onOpen }: Props) {
  const title = file.title?.trim() || file.label;
  return (
    <button
      type="button"
      className="skill-card"
      onClick={() => onOpen(file.path)}
      title={file.path}
    >
      <div className="skill-card-head">
        <span className="skill-card-title">{title}</span>
        <span className="badge">{file.isRouter ? 'router' : 'skill'}</span>
      </div>
      {file.description && <span className="skill-card-desc">{file.description}</span>}
    </button>
  );
}
