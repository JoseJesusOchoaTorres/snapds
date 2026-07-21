import type { PropMeta } from '../types';

interface Props {
  prop: PropMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function EnumControl({ prop, value, onChange }: Props) {
  const options = prop.enumValues ?? [];
  return (
    <label>
      <span className="name">{prop.name}</span>
      <select
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">(unset)</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}
