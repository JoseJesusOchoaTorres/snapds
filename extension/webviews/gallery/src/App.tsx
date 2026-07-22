import { DRAG_MIME } from '@snapds/webview-shared';
import { type DragEvent, useEffect, useMemo, useState } from 'react';
import { ComponentRow } from './components/ComponentRow';
import { CollapseAllIcon, ExpandAllIcon, FolderIcon } from './components/icons';
import { SearchBar } from './components/SearchBar';
import type { ComponentMeta, ToGallery } from './types';
import { vscode } from './vscodeApi';

export default function App() {
  const [components, setComponents] = useState<ComponentMeta[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const toggleGroup = (pkg: string) => setCollapsed((prev) => ({ ...prev, [pkg]: !prev[pkg] }));

  const allPackages = useMemo(() => {
    const set = new Set<string>();
    for (const c of components) set.add(c.id.split('#')[0]);
    return [...set];
  }, [components]);

  const expandAll = () => setCollapsed({});
  const collapseAll = () => setCollapsed(Object.fromEntries(allPackages.map((p) => [p, true])));

  const hasQuery = query.trim().length > 0;

  const handleDragStart = (id: string, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ componentId: id }));
    e.dataTransfer.setData('text/plain', id);
  };

  return (
    <div className="root">
      <div className="toolbar-row">
        <SearchBar value={query} onChange={setQuery} />
        {components.length > 0 && (
          <>
            <button
              type="button"
              className="icon-btn"
              title="Expand all"
              aria-label="Expand all"
              disabled={hasQuery}
              onClick={expandAll}
            >
              <ExpandAllIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Collapse all"
              aria-label="Collapse all"
              disabled={hasQuery}
              onClick={collapseAll}
            >
              <CollapseAllIcon />
            </button>
            <span
              className="toolbar-total"
              title={`${filtered.length} component${filtered.length !== 1 ? 's' : ''} total`}
            >
              {filtered.length}
            </span>
          </>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="empty">
          {components.length === 0
            ? 'Import a Snapds package to see components.'
            : 'No components match your search.'}
        </div>
      ) : (
        <div className="tree" role="tree">
          {Object.entries(groupedComponents).map(([pkgName, pkgComponents]) => {
            const isOpen = hasQuery || !collapsed[pkgName];
            return (
              <div key={pkgName} className="tree-group">
                <div
                  className="tree-row tree-group-header"
                  role="treeitem"
                  aria-expanded={isOpen}
                  tabIndex={0}
                  onClick={() => toggleGroup(pkgName)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(pkgName);
                    } else if (e.key === 'ArrowRight' && !isOpen) {
                      e.preventDefault();
                      toggleGroup(pkgName);
                    } else if (e.key === 'ArrowLeft' && isOpen) {
                      e.preventDefault();
                      toggleGroup(pkgName);
                    }
                  }}
                >
                  <span className={`twisty${isOpen ? ' open' : ''}`} aria-hidden="true" />
                  <FolderIcon />
                  <span className="tree-label">{pkgName}</span>
                  <span className="tree-badge">{pkgComponents.length}</span>
                </div>
                {isOpen && (
                  // biome-ignore lint/a11y/useSemanticElements: role="group" is the correct ARIA tree subgroup; no HTML element maps to it here.
                  <div role="group">
                    {pkgComponents.map((c) => (
                      <ComponentRow
                        key={c.id}
                        meta={c}
                        selected={c.id === selectedId}
                        onClick={() => handleSelect(c.id)}
                        onDragStart={(e) => handleDragStart(c.id, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
