import type { PropMeta } from '../types';
import { BooleanControl } from './BooleanControl';
import { ChildrenControl } from './ChildrenControl';
import { EnumControl } from './EnumControl';
import { NumberControl } from './NumberControl';
import { StringControl } from './StringControl';

interface Props {
  prop: PropMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}

/** Renders the type-appropriate editor for a prop's `defaultValue`. */
export function Control({ prop, value, onChange }: Props) {
  if (prop.name === 'children')
    return <ChildrenControl prop={prop} value={value} onChange={onChange} />;
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
        <div className="field">
          <span className="name">{prop.name}</span>
          <code>{'() => {}'}</code>
        </div>
      );
    case 'string':
    default:
      return <StringControl prop={prop} value={value} onChange={onChange} />;
  }
}
