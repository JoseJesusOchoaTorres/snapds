interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="search">
      <input
        type="text"
        placeholder="Search components…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
