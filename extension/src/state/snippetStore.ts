import { randomUUID } from 'node:crypto';
import type * as vscode from 'vscode';
import type { CustomSnippet } from '../util/messaging';

const KEY = 'snapds.customSnippets';

/** Reserved group for snippets with no category. Never a real user category. */
export const UNCATEGORIZED = 'Uncategorized';

/** Reserved id namespace so snippet ids never collide with the `pkg#Name` space. */
export function newSnippetId(): string {
  return `snippet:${randomUUID()}`;
}

/** Normalizes a category: trims, and treats empty / the reserved label as "no category". */
export function normalizeCategory(category: string | undefined): string | undefined {
  const trimmed = category?.trim();
  if (!trimmed || trimmed.toLowerCase() === UNCATEGORIZED.toLowerCase()) return undefined;
  return trimmed;
}

/** The display bucket a snippet belongs to (its category, or the reserved fallback). */
export function categoryOf(snippet: CustomSnippet): string {
  return normalizeCategory(snippet.category) ?? UNCATEGORIZED;
}

/**
 * Persists USER-LOCAL custom snippets in `workspaceState` so they stay on the
 * machine and are never committed. Snippets shared with the team live in
 * `snapds.config.json` instead (see the config layer); this store only owns the
 * `scope: 'local'` ones. Mirrors {@link UserOverridesStore}.
 */
export class SnippetStore {
  constructor(private ctx: vscode.ExtensionContext) {}

  /** All local snippets, newest first (stable order for the gallery). */
  all(): CustomSnippet[] {
    const list = this.ctx.workspaceState.get<CustomSnippet[]>(KEY) ?? [];
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): CustomSnippet | undefined {
    return this.all().find((s) => s.id === id);
  }

  /** Inserts a new snippet or replaces the existing one with the same id. */
  async save(snippet: CustomSnippet): Promise<void> {
    const list = this.all().filter((s) => s.id !== snippet.id);
    list.push({ ...snippet, scope: 'local' });
    await this.write(list);
  }

  async remove(id: string): Promise<void> {
    await this.write(this.all().filter((s) => s.id !== id));
  }

  /** Sets a snippet's category (undefined / reserved label → uncategorized). */
  async recategorize(id: string, category: string | undefined): Promise<void> {
    await this.mutate(id, (s) => ({ ...s, category: normalizeCategory(category) }));
  }

  /** Renames every local snippet in `from` to `to` (reserved label clears it). */
  async renameCategory(from: string, to: string | undefined): Promise<void> {
    const fromKey = normalizeCategory(from) ?? UNCATEGORIZED;
    const next = normalizeCategory(to);
    const list = this.all().map((s) => (categoryOf(s) === fromKey ? { ...s, category: next } : s));
    await this.write(list);
  }

  /** Moves every snippet in `category` to uncategorized. */
  async deleteCategory(category: string): Promise<void> {
    await this.renameCategory(category, undefined);
  }

  /** Distinct real categories present among local snippets, alphabetically. */
  categories(): string[] {
    const set = new Set<string>();
    for (const s of this.all()) {
      const c = normalizeCategory(s.category);
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  private async mutate(id: string, fn: (s: CustomSnippet) => CustomSnippet): Promise<void> {
    const list = this.all().map((s) => (s.id === id ? fn(s) : s));
    await this.write(list);
  }

  private async write(list: CustomSnippet[]): Promise<void> {
    await this.ctx.workspaceState.update(KEY, list.length > 0 ? list : undefined);
  }
}
