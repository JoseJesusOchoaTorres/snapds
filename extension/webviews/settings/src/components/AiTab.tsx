import { vscode } from '@snapds/webview-shared';
import type { SkillFileEntry, SkillFormat, SkillsConfig } from '../types';
import { SkillCard } from './SkillCard';

interface Props {
  skills: SkillsConfig;
  skillFiles: SkillFileEntry[];
  showSkillsDir: boolean;
  onToggleShowDir: () => void;
  updateSkills: (partial: Partial<SkillsConfig>) => void;
  toggleFormat: (fmt: SkillFormat) => void;
  activePackages: string[];
}

/** AI tab: skills config controls + generated-skills directory as cards. */
export function AiTab({
  skills,
  skillFiles,
  showSkillsDir,
  onToggleShowDir,
  updateSkills,
  toggleFormat,
  activePackages,
}: Props) {
  const togglePackageExclusion = (pkg: string) => {
    const excluded = skills.excludedPackages ?? [];
    const next = excluded.includes(pkg) ? excluded.filter((p) => p !== pkg) : [...excluded, pkg];
    updateSkills({ excludedPackages: next });
  };
  return (
    <div className="tab-content">
      <p className="muted ai-tab-desc">
        Generate skill docs so coding agents can use your components without reading source or{' '}
        <code>.d.ts</code> files.
      </p>

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
              name="skills-destination"
              checked={skills.destination === 'workspace'}
              onChange={() => updateSkills({ destination: 'workspace' })}
            />
            <span>Workspace (team-shared)</span>
          </label>
          <label className="row-checkbox">
            <input
              type="radio"
              name="skills-destination"
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
          <span>Auto-generate when components change</span>
        </label>

        {activePackages.length > 0 && (
          <fieldset className="fieldset">
            <legend>Generate skills for</legend>
            {activePackages.map((pkg) => {
              const excluded = skills.excludedPackages?.includes(pkg) ?? false;
              return (
                <label key={pkg} className="row-checkbox">
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => togglePackageExclusion(pkg)}
                  />
                  <span>{pkg}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        <fieldset className="fieldset">
          <div className="dir-head">
            <button
              type="button"
              className="link-btn"
              onClick={onToggleShowDir}
              aria-expanded={showSkillsDir}
            >
              <span
                aria-hidden="true"
                className={`accordion-twisty${showSkillsDir ? ' open' : ''}`}
              />{' '}
              Skills directory
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
    </div>
  );
}
