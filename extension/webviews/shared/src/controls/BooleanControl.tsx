import type { PropMeta } from '../types';

interface Props {
  prop: PropMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function BooleanControl({ prop, value, onChange }: Props) {
  return (
    <label className="row-checkbox">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span className="name">{prop.name}</span>
    </label>
  );
}
