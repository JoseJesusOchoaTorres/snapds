/**
 * Minimal VS Code API stand-in for `node --test` unit tests. The real `vscode`
 * module is only provided by the Extension Host, so the test bundle aliases
 * `vscode` to this stub (see esbuild.test.mjs). It implements just enough of the
 * surface that modules touch when imported and lets tests exercise pure logic.
 */

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export const workspace = {
  workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
  getConfiguration: () => ({
    get: () => undefined,
    update: async () => undefined,
  }),
  findFiles: async () => [] as unknown[],
};

export const window = {
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showQuickPick: async () => undefined,
  showOpenDialog: async () => undefined,
  withProgress: async (_opts: unknown, task: () => Promise<unknown>) => task(),
};

export const commands = {
  executeCommand: async () => undefined,
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
};
