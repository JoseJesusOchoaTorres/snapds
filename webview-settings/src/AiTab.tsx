import { SkillCard } from './SkillCard';
import type { SkillFileEntry, SkillFormat, SkillsConfig } from './types';
import { vscode } from './vscodeApi';

interface Props {
  skills: SkillsConfig;
  skillFiles: SkillFileEntry[];
  showSkillsDir: boolean;
  onToggleShowDir: () => void;
  updateSkills: (partial: Partial<SkillsConfig>) => void;
  toggleFormat: (fmt: SkillFormat) => void;
}

/** AI tab: skills config controls + generated-skills directory as cards. */
export function AiTab({
  skills,
  skillFiles,
  showSkillsDir,
  onToggleShowDir,
  updateSkills,
  toggleFormat,
}: Props) {
  return (
    <div className="tab-content">
      <label className="row-checkbox">
        <input
          type="checkbox"
          checked={skills.enabled}
          onChange={(e) => updateSkills({ enabled: e.target.checked })}
        />
        <span className="name">Enable skill generation</span>
      </label>

      {!skills.enabled ? (
        <p className="muted">
          Enable to generate skill docs so coding agents can use your components without reading
          source.
        </p>
      ) : (
        <div className="ai-config">
          <fieldset className="fieldset">
            <legend>Formats</legend>
            {(['augment', 'generic'] as SkillFormat[]).map((f) => (
              <label key={f} className="row-checkbox">
                <input
                  type="checkbox"
                  checked={skills.formats.includes(f)}
                  onChange={() => toggleFormat(f)}
                />
                <span>{f === 'augment' ? 'Augment skills' : 'Generic AGENTS.md'}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="fieldset">
            <legend>Destination</legend>
            <label className="row-checkbox">
              <input
                type="radio"
                checked={skills.destination === 'workspace'}
                onChange={() => updateSkills({ destination: 'workspace' })}
              />
              <span>Workspace (team-shared)</span>
            </label>
            <label className="row-checkbox">
              <input
                type="radio"
                checked={skills.destination === 'custom'}
                onChange={() => updateSkills({ destination: 'custom' })}
              />
              <span>Custom path</span>
            </label>
            {skills.destination === 'custom' && (
              <div className="manual-add">
                <input
                  type="text"
                  className="filter-input"
                  placeholder="/absolute/path/to/folder"
                  value={skills.customPath ?? ''}
                  onChange={(e) => updateSkills({ customPath: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => vscode.postMessage({ type: 'pickCustomPath' })}
                >
                  Browse…
                </button>
              </div>
            )}
          </fieldset>

          <label className="row-checkbox">
            <input
              type="checkbox"
              checked={skills.autoGenerate}
              onChange={(e) => updateSkills({ autoGenerate: e.target.checked })}
            />
            <span>Auto-generate skills when components are added</span>
          </label>

          <fieldset className="fieldset">
            <div className="dir-head">
              <button
                type="button"
                className="link-btn"
                onClick={onToggleShowDir}
                aria-expanded={showSkillsDir}
              >
                {showSkillsDir ? '▾' : '▸'} Skills directory
              </button>
              <span className="badge">{skillFiles.length}</span>
              {showSkillsDir && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => vscode.postMessage({ type: 'listSkills' })}
                  title="Refresh list"
                >
                  ↻
                </button>
              )}
            </div>
            {showSkillsDir &&
              (skillFiles.length === 0 ? (
                <div className="muted">
                  No skill files found yet. Generate skills to populate this list.
                </div>
              ) : (
                <div className="skill-card-grid">
                  {skillFiles.map((f) => (
                    <SkillCard
                      key={f.path}
                      file={f}
                      onOpen={(path) => vscode.postMessage({ type: 'openSkill', path })}
                    />
                  ))}
                </div>
              ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
