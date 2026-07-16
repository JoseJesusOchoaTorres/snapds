import { Control } from '@snapds/webview-shared';
import { useEffect, useState } from 'react';
import type { ComponentMeta, ToProps } from './types';
import { vscode } from './vscodeApi';

type VersionsInfo = {
  pkg: string;
  versions: string[];
  activeVersion: string;
  isAutoResolved: boolean;
  inPackageJson: boolean;
  hasFileContext: boolean;
  resolvedFrom?: string;
};

export default function App() {
  const [comp, setComp] = useState<ComponentMeta | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [versionsInfo, setVersionsInfo] = useState<VersionsInfo | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToProps>) => {
      const m = e.data;
      if (m.type === 'componentSchema') {
        setComp(m.component);
        const defaults: Record<string, unknown> = {};
        for (const p of m.component.props) {
          if (p.defaultValue !== undefined) defaults[p.name] = p.defaultValue;
        }
        setValues(defaults);
      } else if (m.type === 'restoreProps') {
        setValues(m.props);
      } else if (m.type === 'versionsAvailable') {
        setVersionsInfo(m.versions.length > 0 ? m : null);
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const update = (name: string, v: unknown) => {
    const next = { ...values, [name]: v };
    setValues(next);
    if (comp) {
      vscode.postMessage({ type: 'propsUpdated', componentId: comp.id, props: next });
    }
  };

  if (!comp) return <p className="empty">Select a component in the sidebar.</p>;

  const showVersionBar =
    versionsInfo && (versionsInfo.versions.length > 1 || !versionsInfo.inPackageJson);
  const noFileHint = versionsInfo && !versionsInfo.hasFileContext;

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h1>{comp.name}</h1>
      {showVersionBar && (
        <div className={`version-bar${noFileHint ? ' version-bar--no-file' : ''}`}>
          <div className="version-bar-left">
            {versionsInfo.versions.length > 1 ? (
              noFileHint ? (
                <span
                  className="version-bar-hint"
                  title={`This monorepo has ${versionsInfo.versions.length} versions of ${versionsInfo.pkg}. Open a source file so Snapds can detect which one your app uses.`}
                >
                  Open a source file to detect your app's version
                </span>
              ) : (
                <>
                  {versionsInfo.isAutoResolved && (
                    <span
                      className="badge-auto"
                      title={
                        versionsInfo.resolvedFrom
                          ? `Auto-detected: ${versionsInfo.pkg} version resolved from ${versionsInfo.resolvedFrom}/node_modules`
                          : `Auto-detected: version resolved from your app's node_modules`
                      }
                    >
                      auto
                      {versionsInfo.resolvedFrom && (
                        <span className="badge-auto-from"> · {versionsInfo.resolvedFrom}</span>
                      )}
                    </span>
                  )}
                  <select
                    className="version-select"
                    value={versionsInfo.activeVersion}
                    title={`This monorepo has ${versionsInfo.versions.length} versions of ${versionsInfo.pkg} installed across apps. Snapds detected the one used by your current file's app.`}
                    onChange={(e) =>
                      vscode.postMessage({
                        type: 'switchVersion',
                        pkg: versionsInfo.pkg,
                        version: e.target.value,
                      })
                    }
                  >
                    {versionsInfo.versions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </>
              )
            ) : (
              <span className="version-badge">{versionsInfo.activeVersion}</span>
            )}
          </div>
          {!versionsInfo.inPackageJson && !noFileHint && (
            <button
              type="button"
              className="add-pkg-btn"
              title={`Add ${versionsInfo.pkg}@^${versionsInfo.activeVersion} to the nearest package.json`}
              onClick={() =>
                vscode.postMessage({
                  type: 'addToPackageJson',
                  pkg: versionsInfo.pkg,
                  version: versionsInfo.activeVersion,
                })
              }
            >
              + Add to this app
            </button>
          )}
        </div>
      )}
      {comp.props.length === 0 ? (
        <div className="empty">
          {comp.standardPropsOnly
            ? 'This component only accepts standard DOM/SVG props.'
            : 'This component has no documented props.'}
        </div>
      ) : (
        comp.props.map((p) => (
          <Control
            key={p.name}
            prop={p}
            value={values[p.name]}
            onChange={(v) => update(p.name, v)}
          />
        ))
      )}
    </form>
  );
}
