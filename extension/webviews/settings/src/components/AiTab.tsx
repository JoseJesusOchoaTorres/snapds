import {
  AGENT_LABEL,
  AGENT_META,
  CONSOLIDATED_AGENTS,
  ROOT_ONLY_AGENTS,
  vscode,
} from '@snapds/webview-shared';
import { type ReactNode, useState } from 'react';
import type { SkillFileEntry, SkillFormat, SkillsConfig } from '../types';
import { SkillCard } from './SkillCard';
import { Tabs } from './Tabs';

interface Props {
  skills: SkillsConfig;
  skillFiles: SkillFileEntry[];
  showSkillsDir: boolean;
  onToggleShowDir: () => void;
  updateSkills: (partial: Partial<SkillsConfig>) => void;
  toggleFormat: (fmt: SkillFormat) => void;
  activePackages: string[];
  snippets?: { id: string; name: string }[];
}

interface SelectItem {
  id: string;
  label: string;
}

/**
 * Shared "select all → hide list, otherwise show the full list to pick a subset"
 * control used by BOTH the packages and the snippets skill-selection sections so
 * they follow the same UX pattern.
 */
function SkillSelect({
  legend,
  items,
  selectedIds,
  onToggle,
  onToggleAll,
  emptyLabel,
  help,
}: {
  legend: string;
  items: SelectItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  emptyLabel: string;
  help?: ReactNode;
}) {
  const allSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));
  return (
    <fieldset className="fieldset">
      <legend>{legend}</legend>
      {items.length === 0 ? (
        <p className="muted skill-select-empty">{emptyLabel}</p>
      ) : (
        <>
          <label className="row-checkbox">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onToggleAll(!allSelected)}
            />
            <span>
              Select all <span className="muted">({items.length})</span>
            </span>
          </label>
          {!allSelected && (
            <div className="skill-select-list">
              {items.map((it) => (
                <label key={it.id} className="row-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(it.id)}
                    onChange={() => onToggle(it.id)}
                  />
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {help}
    </fieldset>
  );
}

/** Router first, then alphabetical — matches how the host lists files per agent. */
function sortForDisplay(files: SkillFileEntry[]): SkillFileEntry[] {
  return [...files].sort(
    (a, b) =>
      Number(b.isRouter ?? false) - Number(a.isRouter ?? false) || a.label.localeCompare(b.label),
  );
}

/** AI tab: agent selection + generated-skills directory grouped by agent as cards. */
export function AiTab({
  skills,
  skillFiles,
  showSkillsDir,
  onToggleShowDir,
  updateSkills,
  toggleFormat,
  activePackages,
  snippets = [],
}: Props) {
  const [activeAgentTab, setActiveAgentTab] = useState<SkillFormat | null>(null);

  // ── Packages (exclude model: everything included by default) ──
  const packageSelectedIds = new Set(
    activePackages.filter((p) => !(skills.excludedPackages ?? []).includes(p)),
  );
  const togglePackageExclusion = (pkg: string) => {
    const excluded = skills.excludedPackages ?? [];
    const next = excluded.includes(pkg) ? excluded.filter((p) => p !== pkg) : [...excluded, pkg];
    updateSkills({ excludedPackages: next });
  };
  const setAllPackages = (all: boolean) =>
    updateSkills({ excludedPackages: all ? [] : [...activePackages] });

  // ── Snippets (include model: nothing included by default — opt-in) ──
  const snippetIds = new Set(snippets.map((s) => s.id));
  const snippetSelectedIds = new Set(
    (skills.skillSnippetIds ?? []).filter((id) => snippetIds.has(id)),
  );
  const toggleSnippetSkill = (id: string) => {
    const current = snippetSelectedIds;
    const next = current.has(id) ? [...current].filter((x) => x !== id) : [...current, id];
    updateSkills({ skillSnippetIds: next });
  };
  const setAllSnippets = (all: boolean) =>
    updateSkills({ skillSnippetIds: all ? snippets.map((s) => s.id) : [] });

  // Selected agents that only read config from the repo root — warn if the
  // destination points elsewhere (they'd be written where the agent can't see them).
  const rootOnlySelected = skills.formats.filter((f) => ROOT_ONLY_AGENTS.includes(f));

  // Selected consolidated agents — the compact toggle only affects these.
  const consolidatedSelected = skills.formats.filter((f) => CONSOLIDATED_AGENTS.includes(f));

  // One group per selected agent that actually has files on disk, in display order.
  const groups = AGENT_META.map((a) => a.id)
    .filter((id) => skills.formats.includes(id))
    .map((id) => ({ id, files: sortForDisplay(skillFiles.filter((f) => f.format === id)) }))
    .filter((g) => g.files.length > 0);

  const renderGrid = (files: SkillFileEntry[]) => (
    <div className="skill-card-grid">
      {files.map((f) => (
        <SkillCard
          key={f.path}
          file={f}
          onOpen={(path) => vscode.postMessage({ type: 'openSkill', path })}
        />
      ))}
    </div>
  );

  const activeId = groups.some((g) => g.id === activeAgentTab) ? activeAgentTab : groups[0]?.id;

  return (
    <div className="tab-content">
      <p className="muted ai-tab-desc">
        Generate skill docs so coding agents can use your components without reading source or{' '}
        <code>.d.ts</code> files.
      </p>

      <div className="ai-config">
        <fieldset className="fieldset">
          <legend>Agents</legend>
          {AGENT_META.map((a) => (
            <label key={a.id} className="row-checkbox">
              <input
                type="checkbox"
                checked={skills.formats.includes(a.id)}
                onChange={() => toggleFormat(a.id)}
              />
              <span>
                {a.label} <code className="agent-hint">{a.hint}</code>
              </span>
            </label>
          ))}
        </fieldset>

        {consolidatedSelected.length > 0 && (
          <div className="option-with-help">
            <label className="row-checkbox">
              <input
                type="checkbox"
                checked={skills.compactConsolidated ?? false}
                onChange={(e) => updateSkills({ compactConsolidated: e.target.checked })}
              />
              <span>
                Compact {consolidatedSelected.map((id) => AGENT_LABEL[id]).join(' / ')}{' '}
                {consolidatedSelected.length === 1 ? 'catalog' : 'catalogs'}
              </span>
            </label>
            <p className="option-help">
              {consolidatedSelected.map((id) => AGENT_LABEL[id]).join(' and ')} write a single file
              that's loaded on every request (no per-component lazy loading). By default it includes
              each component's full props table; enable this to drop the tables (keeping import +
              usage only) so the always-loaded file stays small in large design systems.
            </p>
          </div>
        )}

        <fieldset className="fieldset">
          <legend>Destination</legend>
          <label className="row-checkbox">
            <input
              type="radio"
              name="skills-destination"
              checked={skills.destination === 'workspace'}
              onChange={() => updateSkills({ destination: 'workspace' })}
            />
            <span>Workspace root (team-shared)</span>
          </label>
          <label className="row-checkbox">
            <input
              type="radio"
              name="skills-destination"
              checked={skills.destination === 'subfolder'}
              onChange={() => updateSkills({ destination: 'subfolder' })}
            />
            <span>Workspace subfolder (monorepo)</span>
          </label>
          {skills.destination === 'subfolder' && (
            <div className="manual-add">
              <input
                type="text"
                className="filter-input"
                placeholder="apps/web (relative to the repo root)"
                value={skills.subPath ?? ''}
                onChange={(e) => updateSkills({ subPath: e.target.value })}
              />
            </div>
          )}
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
          {skills.destination !== 'workspace' && rootOnlySelected.length > 0 && (
            <p className="dest-warning" role="note">
              ⚠ {rootOnlySelected.map((id) => AGENT_LABEL[id]).join(', ')}{' '}
              {rootOnlySelected.length === 1 ? 'is' : 'are'} only detected at the repository root.
              Use <strong>Workspace root</strong> for{' '}
              {rootOnlySelected.length === 1 ? 'it' : 'them'}, or generate them separately.
            </p>
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
          <SkillSelect
            legend="Components — generate skills for"
            items={activePackages.map((p) => ({ id: p, label: p }))}
            selectedIds={packageSelectedIds}
            onToggle={togglePackageExclusion}
            onToggleAll={setAllPackages}
            emptyLabel="No packages enabled."
          />
        )}

        <SkillSelect
          legend="Custom snippets — generate skills for"
          items={snippets.map((s) => ({ id: s.id, label: s.name }))}
          selectedIds={snippetSelectedIds}
          onToggle={toggleSnippetSkill}
          onToggleAll={setAllSnippets}
          emptyLabel="No custom snippets yet — capture some to include them in skills."
          help={
            <p className="option-help">
              Selected snippets (private and team-shared) are appended to the generated skill files
              so coding agents know your patterns. Private snippet code is written into files that
              are usually committed — include only what's intended.
            </p>
          }
        />

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
            (groups.length === 0 ? (
              <div className="muted">
                No skill files found yet. Generate skills to populate this list.
              </div>
            ) : groups.length === 1 ? (
              renderGrid(groups[0].files)
            ) : (
              <div className="agent-subtabs">
                <Tabs
                  active={activeId ?? groups[0].id}
                  onChange={(id) => setActiveAgentTab(id as SkillFormat)}
                  tabs={groups.map((g) => ({
                    id: g.id,
                    label: AGENT_LABEL[g.id],
                    panel: renderGrid(g.files),
                  }))}
                />
              </div>
            ))}
        </fieldset>
      </div>
    </div>
  );
}
