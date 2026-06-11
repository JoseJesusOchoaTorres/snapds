import type { PropMeta } from '../types';

interface Props {
  prop: PropMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function StringControl({ prop, value, onChange }: Props) {
  return (
    <label>
      <span className="name">{prop.name}</span>
      <input
        type="text"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
