import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { vscode } from './vscodeApi';
import { SearchBar } from './components/SearchBar';
import { ComponentCard } from './components/ComponentCard';
import type { ComponentMeta, ToGallery } from './types';

const DRAG_MIME = 'application/vnd.code.tree.snapds.component';

export default function App() {
  const [components, setComponents] = useState<ComponentMeta[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToGallery>) => {
      const msg = e.data;
      if (msg.type === 'componentList') setComponents(msg.components);
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => vscode.postMessage({ type: 'search', query }), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(
    () => components.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [components, query],
  );

  const groupedComponents = useMemo(() => {
    const groups: Record<string, ComponentMeta[]> = {};
    for (const c of filtered) {
      const pkgName = c.id.split('#')[0];
      if (!groups[pkgName]) groups[pkgName] = [];
      groups[pkgName].push(c);
    }
    return groups;
  }, [filtered]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    vscode.postMessage({ type: 'componentSelected', componentId: id });
  };

  const handleDragStart = (id: string, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ componentId: id }));
    e.dataTransfer.setData('text/plain', id);
  };

  return (
    <div className="root">
      <SearchBar value={query} onChange={setQuery} />
      {filtered.length === 0 ? (
        <div className="empty">
          {components.length === 0
            ? 'Import a Snapds package to see components.'
            : 'No components match your search.'}
        </div>
      ) : (
        <div className="groups">
          {Object.entries(groupedComponents).map(([pkgName, pkgComponents]) => (
            <details key={pkgName} className="package-group" open>
              <summary>{pkgName}</summary>
              <div className="grid">
                {pkgComponents.map((c) => (
                  <ComponentCard
                    key={c.id}
                    meta={c}
                    selected={c.id === selectedId}
                    onClick={() => handleSelect(c.id)}
                    onDragStart={(e) => handleDragStart(c.id, e)}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
