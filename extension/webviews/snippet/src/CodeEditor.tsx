/**
 * CodeEditor — CodeMirror 6 wrapper for the snippet Code field.
 *
 * Themed entirely via VS Code CSS variables so it adapts to any VS Code color
 * theme without any extra JavaScript. The syntax token colors are declared in
 * styles.css on the `body.vscode-dark` / `body.vscode-light` selectors (the
 * classes VS Code injects into every webview body) and referenced here via
 * `var(--syn-*)` custom properties.
 */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

// ── VS Code–aware highlight style ────────────────────────────────────────────
// Colors are CSS variables defined in styles.css per vscode-dark / vscode-light.
const vsHighlight = HighlightStyle.define([
  // control-flow & declaration keywords
  { tag: tags.keyword, color: 'var(--syn-keyword)' },
  { tag: tags.controlKeyword, color: 'var(--syn-keyword)' },
  { tag: tags.definitionKeyword, color: 'var(--syn-keyword)' },
  { tag: tags.moduleKeyword, color: 'var(--syn-keyword)' },
  // literals
  { tag: tags.string, color: 'var(--syn-string)' },
  { tag: tags.special(tags.string), color: 'var(--syn-string)' },
  { tag: tags.number, color: 'var(--syn-number)' },
  { tag: tags.bool, color: 'var(--syn-keyword)' },
  { tag: tags.null, color: 'var(--syn-keyword)' },
  // comments
  { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.lineComment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.blockComment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.docComment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  // functions & calls
  { tag: tags.function(tags.variableName), color: 'var(--syn-function)' },
  { tag: tags.function(tags.propertyName), color: 'var(--syn-function)' },
  // types, classes, interfaces — also used for JSX component names (PascalCase)
  { tag: [tags.className, tags.typeName, tags.namespace], color: 'var(--syn-type)' },
  // JSX tag names (<div>, <span>)
  { tag: tags.tagName, color: 'var(--syn-tag)' },
  // JSX attribute names
  { tag: tags.attributeName, color: 'var(--syn-attr)' },
  // variables & parameters
  { tag: tags.variableName, color: 'var(--syn-variable)' },
  { tag: tags.definition(tags.variableName), color: 'var(--syn-variable)' },
  { tag: tags.local(tags.variableName), color: 'var(--syn-variable)' },
  // object properties
  { tag: tags.propertyName, color: 'var(--syn-property)' },
  // operators & punctuation — use default foreground (no override)
  { tag: tags.operator, color: 'var(--syn-operator)' },
  { tag: tags.punctuation, color: 'var(--vscode-foreground)' },
  { tag: tags.bracket, color: 'var(--vscode-foreground)' },
  // template literal punctuation
  { tag: tags.special(tags.brace), color: 'var(--syn-keyword)' },
]);

// ── Editor shell theme ───────────────────────────────────────────────────────
// Structural styles (layout, cursor, selection, gutters) — colors via VS Code vars.
const vsTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--vscode-editor-foreground, var(--vscode-foreground))',
      backgroundColor: 'var(--vscode-input-background)',
      border: '1px solid var(--vscode-input-border, transparent)',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily:
        "var(--vscode-editor-font-family, 'JetBrains Mono', Consolas, 'Courier New', monospace)",
    },
    '&.cm-focused': {
      outline: '1px solid var(--vscode-focusBorder)',
      outlineOffset: '-1px',
    },
    '.cm-content': {
      padding: '6px 0',
      caretColor:
        'var(--vscode-editorCursor-foreground, var(--vscode-editor-foreground, var(--vscode-foreground)))',
      lineHeight: '1.55',
    },
    '.cm-line': { padding: '0 8px 0 4px' },
    // Active line — subtle highlight, same as VS Code's default
    '.cm-activeLine': {
      backgroundColor: 'var(--vscode-editor-lineHighlightBackground, transparent)',
    },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    // Selection
    '.cm-selectionBackground': {
      backgroundColor: 'var(--vscode-editor-selectionBackground, rgba(38,79,120,0.6)) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--vscode-editor-selectionBackground, rgba(38,79,120,0.6)) !important',
    },
    // Cursor
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--vscode-editorCursor-foreground, var(--vscode-foreground)) !important',
    },
    // Gutters (line numbers)
    '.cm-gutters': {
      backgroundColor: 'var(--vscode-editorGutter-background, var(--vscode-input-background))',
      color: 'var(--vscode-editorLineNumber-foreground, #858585)',
      border: 'none',
      borderRight: '1px solid var(--vscode-editorGutter-border, rgba(128,128,128,0.15))',
      borderRadius: '5px 0 0 5px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 8px',
      minWidth: '28px',
    },
    // Scrollbar
    '.cm-scroller': { overflowX: 'auto' },
  },
  { dark: false }, // base theme (applied in both light & dark)
);

// ── React component ──────────────────────────────────────────────────────────
interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Keep a stable ref to onChange so the updateListener never stales.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize once on mount. `value` intentionally excluded from deps: it is
  // used only as the initial document content. External value changes are handled
  // by the second useEffect below via view.dispatch(), which avoids tearing down
  // and recreating the full editor on every keystroke.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        // History (undo / redo)
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        // Language: JSX + TypeScript so TSX is fully highlighted
        javascript({ jsx: true, typescript: true }),
        // Syntax colors
        syntaxHighlighting(vsHighlight),
        // Shell styling
        vsTheme,
        // Editor chrome
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        // 2-space indent
        indentUnit.of('  '),
        // Change listener
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // Sync external value changes (e.g. when the draft loads / draft.id changes).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // No aria-label needed: the containing <div class="field"> has a visible
  // <span class="field-label"> that labels this control in App.tsx.
  return <div ref={containerRef} className="code-editor-cm" />;
}
