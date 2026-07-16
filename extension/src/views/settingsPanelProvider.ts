import * as vscode from 'vscode';
import type {
  ComponentDetail,
  FromSettings,
  PackageMeta,
  SkillFileEntry,
  SkillsConfig,
  ToSettings,
  UserOverride,
} from '../util/messaging';
import { getWebviewHtml, webviewResourceRoots } from '../util/webviewHtml';

export interface SettingsHandlers {
  onReady: () => void | Promise<void>;
  onSavePackages: (
    packages: { name: string; components?: string[]; selected?: string[] }[],
  ) => void | Promise<void>;
  onRequestComponents?: (pkg: string) => void | Promise<void>;
  onSaveSkillsConfig?: (config: SkillsConfig) => void | Promise<void>;
  onRegenerateAllSkills?: () => void | Promise<void>;
  onGenerateSkills?: () => void | Promise<void>;
  onPickCustomPath?: () => void | Promise<void>;
  onListSkills?: () => void | Promise<void>;
  onOpenSkill?: (path: string) => void | Promise<void>;
  onRequestComponentDetail?: (args: { pkg: string; component: string }) => void | Promise<void>;
  onSaveUserOverride?: (args: {
    pkg: string;
    component: string;
    override: UserOverride;
  }) => void | Promise<void>;
  onResetUserOverride?: (args: { pkg: string; component: string }) => void | Promise<void>;
  onRequestUserOverrides?: () => void | Promise<void>;
  onSetScopeFilters?: (filters: string[]) => void | Promise<void>;
}

export class SettingsPanelProvider {
  public static readonly viewType = 'snapds.settings';
  public panel: vscode.WebviewPanel | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private handlers: SettingsHandlers,
  ) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      SettingsPanelProvider.viewType,
      'Snapds Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: webviewResourceRoots(this.ctx, 'settings'),
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.ctx, 'settings');

    this.panel.webview.onDidReceiveMessage((msg: FromSettings) => {
      switch (msg.type) {
        case 'ready':
          void this.handlers.onReady();
          break;
        case 'savePackages':
          void this.handlers.onSavePackages(msg.packages);
          break;
        case 'requestComponents':
          void this.handlers.onRequestComponents?.(msg.pkg);
          break;
        case 'saveSkillsConfig':
          void this.handlers.onSaveSkillsConfig?.(msg.config);
          break;
        case 'regenerateAllSkills':
          void this.handlers.onRegenerateAllSkills?.();
          break;
        case 'generateSkills':
          void this.handlers.onGenerateSkills?.();
          break;
        case 'pickCustomPath':
          void this.handlers.onPickCustomPath?.();
          break;
        case 'listSkills':
          void this.handlers.onListSkills?.();
          break;
        case 'openSkill':
          void this.handlers.onOpenSkill?.(msg.path);
          break;
        case 'requestComponentDetail':
          void this.handlers.onRequestComponentDetail?.({ pkg: msg.pkg, component: msg.component });
          break;
        case 'saveUserOverride':
          void this.handlers.onSaveUserOverride?.({
            pkg: msg.pkg,
            component: msg.component,
            override: msg.override,
          });
          break;
        case 'resetUserOverride':
          void this.handlers.onResetUserOverride?.({ pkg: msg.pkg, component: msg.component });
          break;
        case 'requestUserOverrides':
          void this.handlers.onRequestUserOverrides?.();
          break;
        case 'setScopeFilters':
          void this.handlers.onSetScopeFilters?.(msg.filters);
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  postPackageList(packages: PackageMeta[]): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'packageList', packages } satisfies ToSettings);
    }
  }

  postComponentNames(pkg: string, components: string[]): void {
    if (this.panel) {
      void this.panel.webview.postMessage({
        type: 'componentNames',
        pkg,
        components,
      } satisfies ToSettings);
    }
  }

  postSkillsConfig(config: SkillsConfig): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'skillsConfig', config } satisfies ToSettings);
    }
  }

  postSaving(): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'saving' } satisfies ToSettings);
    }
  }

  postSaved(): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'saved' } satisfies ToSettings);
    }
  }

  postSkillsGenerated(ok: boolean): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'skillsGenerated', ok } satisfies ToSettings);
    }
  }

  postCustomPathPicked(path: string): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'customPathPicked', path } satisfies ToSettings);
    }
  }

  postSkillsList(files: SkillFileEntry[]): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'skillsList', files } satisfies ToSettings);
    }
  }

  postComponentDetail(detail: ComponentDetail): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'componentDetail', detail } satisfies ToSettings);
    }
  }

  postUserOverrides(overrides: Record<string, Record<string, UserOverride>>): void {
    if (this.panel) {
      void this.panel.webview.postMessage({
        type: 'userOverrides',
        overrides,
      } satisfies ToSettings);
    }
  }

  postScopeFilters(filters: string[]): void {
    if (this.panel) {
      void this.panel.webview.postMessage({ type: 'scopeFilters', filters } satisfies ToSettings);
    }
  }
}
