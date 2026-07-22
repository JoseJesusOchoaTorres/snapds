/** Public surface of the shared webview package. */

export { BooleanControl } from './controls/BooleanControl';
export { ChildrenControl } from './controls/ChildrenControl';
export { Control } from './controls/Control';
export { EnumControl } from './controls/EnumControl';
export { NumberControl } from './controls/NumberControl';
export { StringControl } from './controls/StringControl';
export type {
  AddedProp,
  ComponentDetail,
  ComponentMeta,
  ConfigExportMode,
  ConfigImportPreviewPayload,
  ConfigStatusPayload,
  PackageMeta,
  PropMeta,
  PropOverride,
  SkillFileEntry,
  SkillFormat,
  SkillsConfig,
  UserOverride,
} from './types';
export { vscode } from './vscodeApi';

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
