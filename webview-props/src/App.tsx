import { Control } from '@snapds/webview-shared';
import { useEffect, useState } from 'react';
import type { ComponentMeta, ToProps } from './types';
import { vscode } from './vscodeApi';

export default function App() {
  const [comp, setComp] = useState<ComponentMeta | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});

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
      }
      if (m.type === 'restoreProps') setValues(m.props);
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

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h1>{comp.name}</h1>
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
