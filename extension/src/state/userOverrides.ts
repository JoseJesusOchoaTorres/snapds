import type * as vscode from 'vscode';

export interface PropOverride {
  hidden?: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface AddedProp {
  name: string;
  type: string;
  description?: string;
}

export interface UserOverride {
  snippet?: string;
  props?: Record<string, PropOverride>;
  addedProps?: AddedProp[];
}

/** pkgName -> compName -> override */
export type UserOverrides = Record<string, Record<string, UserOverride>>;

const KEY = 'snapds.userOverrides';

/**
 * Persists per-project USER overrides in `workspaceState` so they stay local to the
 * machine (never committed) and take precedence over the git-shared company config.
 */
export class UserOverridesStore {
  constructor(private ctx: vscode.ExtensionContext) {}

  all(): UserOverrides {
    return this.ctx.workspaceState.get<UserOverrides>(KEY) ?? {};
  }

  get(pkg: string, comp: string): UserOverride | undefined {
    return this.all()[pkg]?.[comp];
  }

  async set(pkg: string, comp: string, ov: UserOverride): Promise<void> {
    const all = this.all();
    if (!all[pkg]) all[pkg] = {};
    all[pkg][comp] = ov;
    await this.ctx.workspaceState.update(KEY, all);
  }

  async reset(pkg: string, comp: string): Promise<void> {
    const all = this.all();
    if (all[pkg]) {
      delete all[pkg][comp];
      if (!Object.keys(all[pkg]).length) delete all[pkg];
    }
    await this.ctx.workspaceState.update(KEY, all);
  }
}
