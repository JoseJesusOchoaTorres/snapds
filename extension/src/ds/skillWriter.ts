import * as fs from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ComponentMeta, SkillFileEntry, SkillFormat, SkillsConfig } from '../util/messaging';
import {
  buildArtifacts,
  type ComponentSkillFile,
  expectedSkillRelPaths,
  resolveGuidance,
  type SkillArtifact,
} from './skillGen';

type Destination = 'workspace' | 'custom';

const SKILLS_CONFIG_KEY = 'skills';
const DEFAULT_SKILLS_CONFIG: SkillsConfig = {
  enabled: false,
  formats: ['augment'],
  destination: 'workspace',
  autoGenerate: true,
};

/** Reads the persisted skills configuration, falling back to sane defaults. */
export function getSkillsConfig(): SkillsConfig {
  const raw = vscode.workspace
    .getConfiguration('snapds')
    .get<Partial<SkillsConfig>>(SKILLS_CONFIG_KEY);
  return { ...DEFAULT_SKILLS_CONFIG, ...(raw ?? {}) };
}

/** Persists the skills configuration to workspace settings. */
export async function setSkillsConfig(config: SkillsConfig): Promise<void> {
  await vscode.workspace
    .getConfiguration('snapds')
    .update(SKILLS_CONFIG_KEY, config, vscode.ConfigurationTarget.Workspace);
}

function resolveBaseDirFromConfig(
  config: SkillsConfig,
  format: SkillFormat,
  wsRoot: string | undefined,
): string | undefined {
  const root = config.destination === 'custom' ? config.customPath : wsRoot;
  if (!root) return undefined;
  return format === 'augment' ? path.join(root, '.augment', 'skills') : root;
}

/** Recursively collects `.md` files under `dir`, returning absolute paths. */
function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMarkdown(full));
    else if (e.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Reads the leading lines of a skill file to extract a display title/description.
 * Augment files carry YAML-ish frontmatter (`name:`/`description:`); generic files
 * fall back to the first `# ` heading and the first meaningful body line.
 */
export function parseSkillMeta(full: string): { title?: string; description?: string } {
  let text = '';
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch {
    return {};
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (fm) {
    const name = /(^|\n)name:\s*(.+)/.exec(fm[1])?.[2]?.trim();
    const desc = /(^|\n)description:\s*(.+)/.exec(fm[1])?.[2]?.trim();
    return { title: name, description: desc };
  }
  const title = /(^|\n)#\s+(.+)/.exec(text)?.[2]?.trim();
  let description: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('<!--')) continue;
    description = t;
    break;
  }
  return { title, description };
}

/**
 * Enumerates the skill files snapds writes for the configured formats/destination,
 * so the Settings panel can list them and open them on click. Only snapds-owned
 * artifacts are listed (never the entire workspace root).
 */
export function listSkillFiles(config: SkillsConfig): SkillFileEntry[] {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const out: SkillFileEntry[] = [];
  const seen = new Set<string>();
  const push = (full: string, format: SkillFormat, label: string) => {
    if (seen.has(full)) return;
    seen.add(full);
    const meta = parseSkillMeta(full);
    out.push({ path: full, label, format, title: meta.title, description: meta.description });
  };

  for (const format of config.formats) {
    const base = resolveBaseDirFromConfig(config, format, wsRoot);
    if (!base) continue;
    if (format === 'augment') {
      // .augment/skills/<skill>/SKILL.md — label with the skill folder name.
      for (const full of walkMarkdown(base)) {
        const rel = path.relative(base, full);
        const dir = path.dirname(rel);
        const label = /SKILL\.md$/i.test(rel) && dir !== '.' ? dir : rel.replace(/\.md$/i, '');
        push(full, format, label);
      }
    } else {
      // Generic: AGENTS.md index at the root + per-component snapds-skills/*.md.
      const agents = path.join(base, 'AGENTS.md');
      if (fs.existsSync(agents)) push(agents, format, 'AGENTS.md');
      const skillsDir = path.join(base, 'snapds-skills');
      for (const full of walkMarkdown(skillsDir)) {
        push(full, format, path.relative(skillsDir, full).replace(/\.md$/i, ''));
      }
    }
  }

  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

/**
 * Returns the skill files that currently exist on disk for a single component,
 * across the configured formats. `all` MUST be the full component set so the
 * deduped slug matches what `skillGen` writes. Empty when none exist yet.
 */
export function listComponentSkillFiles(
  all: ComponentMeta[],
  meta: ComponentMeta | undefined,
  config: SkillsConfig,
): ComponentSkillFile[] {
  if (!meta) return [];
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const rel = expectedSkillRelPaths(all, meta.id);
  const out: ComponentSkillFile[] = [];
  for (const format of config.formats) {
    const root = config.destination === 'custom' ? config.customPath : wsRoot;
    if (!root) continue;
    const full = format === 'augment' ? path.join(root, rel.augment) : path.join(root, rel.generic);
    if (fs.existsSync(full)) {
      out.push({
        path: full,
        label: path.basename(path.dirname(full)) || path.basename(full),
        format,
      });
    }
  }
  return out;
}

/**
 * Generates skills non-interactively from a persisted config. In `full` mode every
 * detail file is (re)written; in `incremental` mode only the index and the detail
 * files for `changedIds` are written. Pre-existing files are overwritten silently.
 */
export async function generateSkillsToConfig(
  allComponents: ComponentMeta[],
  config: SkillsConfig,
  opts: { mode: 'full' | 'incremental'; changedIds?: Set<string> } = { mode: 'full' },
): Promise<number> {
  if (!allComponents.length || !config.formats.length) return 0;
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const changedIds = opts.mode === 'incremental' ? opts.changedIds : undefined;

  const guidance = resolveGuidance(
    config,
    allComponents.map((c) => c.id),
  );

  let total = 0;
  for (const format of config.formats) {
    const base = resolveBaseDirFromConfig(config, format, wsRoot);
    if (!base) {
      vscode.window.showWarningMessage(
        'Snapds: skills destination is not configured. Set it in Settings.',
      );
      continue;
    }
    const artifacts = buildArtifacts(allComponents, format, changedIds, guidance);
    // Auto-overwrite: no modal prompt on the automated path.
    const count = await writeArtifacts(base, artifacts, { value: true });
    if (count > 0) total += count;
  }
  return total;
}

async function resolveBaseDir(
  kind: Destination,
  format: SkillFormat,
  wsRoot: string | undefined,
): Promise<string | undefined> {
  if (kind === 'workspace') {
    if (!wsRoot) {
      vscode.window.showWarningMessage(
        'Snapds: open a workspace folder to use the workspace destination.',
      );
      return undefined;
    }
    return format === 'augment' ? path.join(wsRoot, '.augment', 'skills') : wsRoot;
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select destination folder',
  });
  if (!picked || !picked.length) return undefined;
  const chosen = picked[0].fsPath;
  const base = format === 'augment' ? path.join(chosen, '.augment', 'skills') : chosen;
  vscode.window.showInformationMessage(`Snapds: writing ${format} skills to ${base}`);
  return base;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves `relativePath` under `base` and guarantees the result stays within
 * `base`, guarding against path-traversal (e.g. `../`) in generated relative
 * paths. Returns undefined when the target would escape the base directory.
 */
export function resolveWithinBase(base: string, relativePath: string): string | undefined {
  const resolvedBase = path.resolve(base);
  const full = path.resolve(resolvedBase, relativePath);
  const rel = path.relative(resolvedBase, full);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  return full;
}

/**
 * Writes artifacts under `base`. Prompts once (batch) before overwriting any
 * pre-existing files. Returns the number of files written, or -1 if aborted.
 */
async function writeArtifacts(
  base: string,
  artifacts: SkillArtifact[],
  confirmedOverwrite: { value: boolean },
): Promise<number> {
  let written = 0;
  for (const artifact of artifacts) {
    const full = resolveWithinBase(base, artifact.relativePath);
    if (!full) {
      vscode.window.showWarningMessage(
        `Snapds: skipped a skill file with an unsafe path (${artifact.relativePath}).`,
      );
      continue;
    }
    if (!confirmedOverwrite.value && (await exists(full))) {
      const choice = await vscode.window.showWarningMessage(
        'Snapds: some skill files already exist. Overwrite them?',
        { modal: true },
        'Overwrite',
      );
      if (choice !== 'Overwrite') return -1;
      confirmedOverwrite.value = true;
    }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, artifact.contents, 'utf8');
    written++;
  }
  return written;
}

export async function runGenerateSkills(components: ComponentMeta[]): Promise<void> {
  if (!components.length) {
    vscode.window.showWarningMessage(
      'Snapds: no components found. Configure packages in Settings first.',
    );
    return;
  }

  const fmtPick = await vscode.window.showQuickPick(
    [
      {
        label: 'Augment skills',
        detail: 'Directory per skill with SKILL.md + frontmatter',
        value: 'augment',
      },
      {
        label: 'Generic AGENTS.md',
        detail: 'Assistant-agnostic index + per-component files',
        value: 'generic',
      },
      { label: 'Both', detail: 'Generate both formats', value: 'both' },
    ],
    { placeHolder: 'Choose skill output format' },
  );
  if (!fmtPick) return;
  const formats: SkillFormat[] =
    fmtPick.value === 'both' ? ['augment', 'generic'] : [fmtPick.value as SkillFormat];

  const guidance = resolveGuidance(
    getSkillsConfig(),
    components.map((c) => c.id),
  );

  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const destPick = await vscode.window.showQuickPick(
    [
      {
        label: 'Workspace (team-shared)',
        detail: wsRoot ?? '(no workspace open)',
        value: 'workspace',
      },
      { label: 'Custom folder…', detail: 'Pick any folder outside the repo', value: 'custom' },
    ],
    { placeHolder: 'Choose destination' },
  );
  if (!destPick) return;

  let totalWritten = 0;
  let revealDir: string | undefined;
  let aborted = false;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Snapds: Generating skills…' },
    async () => {
      const confirmedOverwrite = { value: false };
      for (const format of formats) {
        const base = await resolveBaseDir(destPick.value as Destination, format, wsRoot);
        if (!base) {
          aborted = true;
          return;
        }
        const artifacts = buildArtifacts(components, format, undefined, guidance);
        const count = await writeArtifacts(base, artifacts, confirmedOverwrite);
        if (count < 0) {
          aborted = true;
          return;
        }
        totalWritten += count;
        revealDir = base;
      }
    },
  );

  if (aborted || !revealDir) return;

  const action = await vscode.window.showInformationMessage(
    `Snapds: generated ${totalWritten} skill file${totalWritten === 1 ? '' : 's'}.`,
    'Reveal',
  );
  if (action === 'Reveal') {
    void vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(revealDir));
  }
}
