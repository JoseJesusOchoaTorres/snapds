import type { SkillFileEntry } from '../types';

interface Props {
  file: SkillFileEntry;
  onOpen: (path: string) => void;
}

/**
 * AI-tab card for a generated skill file. The badge reflects the file's role:
 * - `router`          — the component dictionary/router (always-loaded index)
 * - `snippet router`  — the snippets index/router (links to per-snippet detail files)
 * - `snippet`         — a per-snippet detail file
 * - `skill`           — a per-component detail file
 */
export function SkillCard({ file, onOpen }: Props) {
  const title = file.title?.trim() || file.label;
  const badge = file.isRouter
    ? 'router'
    : file.isSnippetsRouter
      ? 'snippet router'
      : file.isSnippets
        ? 'snippet'
        : 'skill';
  const extraClass = file.isSnippetsRouter
    ? ' skill-card--snippets-router'
    : file.isSnippets
      ? ' skill-card--snippets'
      : '';
  return (
    <button
      type="button"
      className={`skill-card${extraClass}`}
      onClick={() => onOpen(file.path)}
      title={file.path}
    >
      <div className="skill-card-head">
        <span className="skill-card-title">{title}</span>
        <span className="badge">{badge}</span>
      </div>
      {file.description && <span className="skill-card-desc">{file.description}</span>}
    </button>
  );
}
