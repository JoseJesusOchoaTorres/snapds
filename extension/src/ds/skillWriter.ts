import * as fs from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ComponentMeta, SkillFileEntry, SkillFormat, SkillsConfig } from '../util/messaging';
import { splitComponentId } from './codegen';
import { AGENT_ORDER, AGENTS } from './skillAgents';
import {
  buildArtifacts,
  type ComponentSkillFile,
  expectedSkillRelPath,
  resolveGuidance,
  type SkillArtifact,
} from './skillGen';

type Destination = 'workspace' | 'subfolder' | 'custom';

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

/** Resolves the destination root for a config (before the agent's baseDir is appended). */
export function resolveDestinationRootFromConfig(
  config: SkillsConfig,
  wsRoot: string | undefined,
): string | undefined {
  if (config.destination === 'custom') return config.customPath || undefined;
  if (config.destination === 'subfolder') {
    if (!wsRoot) return undefined;
    const subPath = config.subPath ?? '';
    // Allow empty/. (workspace root), but reject absolute paths and .. traversal.
    if (subPath && (path.isAbsolute(subPath) || subPath.includes('..'))) return undefined;
    return resolveWithinBase(wsRoot, subPath);
  }
  return wsRoot;
}

/** Resolves the base directory for a given config and format. */
export function resolveBaseDirFromConfig(
  config: SkillsConfig,
  format: SkillFormat,
  wsRoot: string | undefined,
): string | undefined {
  const root = resolveDestinationRootFromConfig(config, wsRoot);
  if (!root) return undefined;
  const { baseDir } = AGENTS[format];
  return baseDir ? path.join(root, baseDir) : root;
}

/** Recursively collects `.md`/`.mdc` files under `dir`, returning absolute paths. */
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
    else if (/\.mdc?$/i.test(e.name)) out.push(full);
  }
  return out;
}

/**
 * Reads the leading lines of a skill file to extract a display title/description.
 * Augment files carry YAML-ish frontmatter (`name:`/`description:`); generic files
 * fall back to the first `# ` heading and the first meaningful body line.
 */
export function parseSkillMeta(full: string): {
  title?: string;
  description?: string;
} {
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

  for (const format of config.formats) {
    const agent = AGENTS[format];
    if (!agent) continue;
    const base = resolveBaseDirFromConfig(config, format, wsRoot);
    if (!base) continue;
    for (const full of walkMarkdown(base)) {
      if (seen.has(full)) continue;
      const relPosix = path.relative(base, full).split(path.sep).join('/');
      // Keep listing scoped to files snapds owns (skip the user's other rules).
      if (!agent.owns(relPosix)) continue;
      seen.add(full);
      const isRouter = relPosix === agent.routerRelPath;
      const dir = path.posix.dirname(relPosix);
      // Folder-per-skill agents read best labeled by their folder name.
      const label =
        /SKILL\.md$/i.test(relPosix) && dir !== '.'
          ? dir
          : path.posix.basename(relPosix).replace(/\.mdc?$/i, '');
      const meta = parseSkillMeta(full);
      out.push({
        path: full,
        label,
        format,
        title: meta.title,
        description: meta.description,
        isRouter,
      });
    }
  }

  // Routers first, then alphabetical; the UI regroups per agent.
  out.sort((a, b) => Number(b.isRouter) - Number(a.isRouter) || a.label.localeCompare(b.label));
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
  const root = resolveDestinationRootFromConfig(config, wsRoot);
  const out: ComponentSkillFile[] = [];
  if (!root) return out;
  for (const format of config.formats) {
    // Consolidated agents (copilot/cline) have no per-component file → skip.
    const rel = expectedSkillRelPath(all, meta.id, format);
    if (!rel) continue;
    const full = path.join(root, rel);
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

function applyPackageExclusion(
  components: ComponentMeta[],
  excludedPackages: string[] | undefined,
): ComponentMeta[] {
  if (!excludedPackages?.length) return components;
  const excluded = new Set(excludedPackages);
  return components.filter((c) => !excluded.has(splitComponentId(c.id).pkg));
}

/**
 * Generates skills non-interactively from a persisted config. In `full` mode every
 * detail file is (re)written; in `incremental` mode only the index and the detail
 * files for `changedIds` are written. Pre-existing files are overwritten silently.
 */
export async function generateSkillsToConfig(
  allComponents: ComponentMeta[],
  config: SkillsConfig,
  opts: { mode: 'full' | 'incremental'; changedIds?: Set<string> } = {
    mode: 'full',
  },
): Promise<number> {
  const skillComponents = applyPackageExclusion(allComponents, config.excludedPackages);
  if (!skillComponents.length || !config.formats.length) return 0;
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const changedIds = opts.mode === 'incremental' ? opts.changedIds : undefined;

  const guidance = resolveGuidance(
    config,
    skillComponents.map((c) => c.id),
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
    const artifacts = buildArtifacts(
      skillComponents,
      format,
      changedIds,
      guidance,
      config.compactConsolidated,
    );
    // Auto-overwrite: no modal prompt on the automated path.
    const count = await writeArtifacts(base, artifacts, { value: true });
    if (count > 0) total += count;
  }
  return total;
}

/**
 * Resolves the destination root interactively (once per run, not per agent) so a
 * multi-agent generation prompts for a folder/subpath a single time.
 */
async function resolveDestinationRoot(
  kind: Destination,
  wsRoot: string | undefined,
): Promise<string | undefined> {
  if (kind === 'workspace') {
    if (!wsRoot) {
      vscode.window.showWarningMessage(
        'Snapds: open a workspace folder to use the workspace destination.',
      );
      return undefined;
    }
    return wsRoot;
  }

  if (kind === 'subfolder') {
    if (!wsRoot) {
      vscode.window.showWarningMessage('Snapds: open a workspace folder to use a subfolder.');
      return undefined;
    }
    const sub = await vscode.window.showInputBox({
      prompt: 'Subfolder relative to the workspace root',
      placeHolder: 'apps/web',
      validateInput: (v) => {
        const trimmed = v.trim();
        if (path.isAbsolute(trimmed)) return 'Use a path relative to the workspace root.';
        if (trimmed.includes('..')) return 'Path cannot contain .. segments.';
        return undefined;
      },
    });
    if (sub === undefined) return undefined;
    const trimmed = sub.trim();
    return resolveWithinBase(wsRoot, trimmed);
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select destination folder',
  });
  if (!picked?.length) return undefined;
  return picked[0].fsPath;
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

  const skillComponents = applyPackageExclusion(components, getSkillsConfig().excludedPackages);

  const agentPicks = await vscode.window.showQuickPick(
    AGENT_ORDER.map((id) => ({
      label: AGENTS[id].label,
      detail: AGENTS[id].hint,
      value: id,
      picked: id === 'augment',
    })),
    { placeHolder: 'Choose agents to generate skills for', canPickMany: true },
  );
  if (!agentPicks?.length) return;
  const formats: SkillFormat[] = agentPicks.map((p) => p.value);

  const guidance = resolveGuidance(
    getSkillsConfig(),
    skillComponents.map((c) => c.id),
  );

  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const destPick = await vscode.window.showQuickPick(
    [
      {
        label: 'Workspace (team-shared)',
        detail: wsRoot ?? '(no workspace open)',
        value: 'workspace',
      },
      {
        label: 'Workspace subfolder…',
        detail: 'A path relative to the repo root, e.g. apps/web (monorepos)',
        value: 'subfolder',
      },
      {
        label: 'Custom folder…',
        detail: 'Pick any absolute folder, e.g. ~ for personal agent skills',
        value: 'custom',
      },
    ],
    { placeHolder: 'Choose destination' },
  );
  if (!destPick) return;

  // Resolve the root once so multi-agent runs prompt for a folder/subpath a single time.
  const root = await resolveDestinationRoot(destPick.value as Destination, wsRoot);
  if (!root) return;

  let totalWritten = 0;
  let revealDir: string | undefined;
  let aborted = false;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Snapds: Generating skills…',
    },
    async () => {
      const confirmedOverwrite = { value: false };
      for (const format of formats) {
        const { baseDir } = AGENTS[format];
        const base = baseDir ? path.join(root, baseDir) : root;
        const artifacts = buildArtifacts(
          skillComponents,
          format,
          undefined,
          guidance,
          getSkillsConfig().compactConsolidated,
        );
        const count = await writeArtifacts(base, artifacts, confirmedOverwrite);
        if (count < 0) {
          aborted = true;
          return;
        }
        totalWritten += count;
        revealDir = root;
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
