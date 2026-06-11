import type { PropMeta } from '../types';

interface Props {
  prop: PropMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function NumberControl({ prop, value, onChange }: Props) {
  return (
    <label>
      <span className="name">{prop.name}</span>
      <input
        type="number"
        value={value === undefined || value === null || value === '' ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? undefined : Number(raw));
        }}
      />
    </label>
  );
}
