interface VsCodeApi {
  postMessage(message: unknown): void;
  setState(state: unknown): void;
  getState<T = unknown>(): T | undefined;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

const fallback: VsCodeApi = {
  postMessage: () => {},
  setState: () => {},
  getState: () => undefined,
};

export const vscode: VsCodeApi =
  typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
    ? window.acquireVsCodeApi()
    : fallback;
