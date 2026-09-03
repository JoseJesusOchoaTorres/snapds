/** Public surface of the shared webview package. */

export type { AgentMeta } from './agents';
export { AGENT_LABEL, AGENT_META, CONSOLIDATED_AGENTS, ROOT_ONLY_AGENTS } from './agents';
export { BooleanControl } from './controls/BooleanControl';
export { ChildrenControl } from './controls/ChildrenControl';
export { Control } from './controls/Control';
export { EnumControl } from './controls/EnumControl';
export { NumberControl } from './controls/NumberControl';
export { StringControl } from './controls/StringControl';
export { mountApp } from './mountApp';
export type {
  AddedProp,
  ComponentDetail,
  ComponentMeta,
  ConfigExportMode,
  ConfigImportPreviewPayload,
  ConfigStatusPayload,
  CustomSnippet,
  ImportSpec,
  PackageMeta,
  PropMeta,
  PropOverride,
  SkillFileEntry,
  SkillFormat,
  SkillsConfig,
  SnippetDraft,
  SnippetSaveResult,
  UserOverride,
} from './types';
export { vscode } from './vscodeApi';

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
