import { useEffect, useState } from 'react';
import { vscode } from './vscodeApi';
import type { ComponentMeta, PropMeta, ToProps } from './types';
import { BooleanControl } from './controls/BooleanControl';
import { StringControl } from './controls/StringControl';
import { NumberControl } from './controls/NumberControl';
import { EnumControl } from './controls/EnumControl';
import { ChildrenControl } from './controls/ChildrenControl';

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
        <div className="empty">This component has no documented props.</div>
      ) : (
        comp.props.map((p) => (
          <Control key={p.name} prop={p} value={values[p.name]} onChange={(v) => update(p.name, v)} />
        ))
      )}
    </form>
  );
}

function Control({ prop, value, onChange }: { prop: PropMeta; value: unknown; onChange: (v: unknown) => void }) {
  if (prop.name === 'children') return <ChildrenControl prop={prop} value={value} onChange={onChange} />;
  switch (prop.type) {
    case 'boolean':
      return <BooleanControl prop={prop} value={value} onChange={onChange} />;
    case 'number':
      return <NumberControl prop={prop} value={value} onChange={onChange} />;
    case 'enum':
      return <EnumControl prop={prop} value={value} onChange={onChange} />;
    case 'ReactNode':
      return <ChildrenControl prop={prop} value={value} onChange={onChange} />;
    case 'function':
      return (
        <label>
          <span className="name">{prop.name}</span>
          <code>{'() => {}'}</code>
        </label>
      );
    case 'string':
    default:
      return <StringControl prop={prop} value={value} onChange={onChange} />;
  }
}
