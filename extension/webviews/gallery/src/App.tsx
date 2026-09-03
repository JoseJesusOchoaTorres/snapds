import { DRAG_MIME, vscode } from '@snapds/webview-shared';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ComponentRow } from './components/ComponentRow';
import { CollapseAllIcon, ExpandAllIcon, FolderIcon, TagIcon } from './components/icons';
import { SearchBar, type SearchBarHandle } from './components/SearchBar';
import { SnippetRow } from './components/SnippetRow';
import type { ComponentMeta, CustomSnippet, ToGallery } from './types';

const UNCATEGORIZED = 'Uncategorized';
type Tab = 'components' | 'snippets';

/** True when running on macOS — used to show platform-appropriate shortcut labels. */
const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');
/** Returns the Mac or Win/Linux shortcut string. */
const kb = (mac: string, win: string) => (isMac ? mac : win);

export default function App() {
  const [components, setComponents] = useState<ComponentMeta[]>([]);
  const [snippets, setSnippets] = useState<CustomSnippet[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('components');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Category groups get their OWN collapse map so category names can't collide
  // with package names in the components tab.
  const [snippetCollapsed, setSnippetCollapsed] = useState<Record<string, boolean>>({});
  const [pendingPackages, setPendingPackages] = useState<Set<string>>(new Set());
  const [totalIndexing, setTotalIndexing] = useState(0);
  const pendingRef = useRef<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number; pkg: string } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<SearchBarHandle>(null);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const root = rootRef.current;
    if (!toolbar || !root) return;
    const setVar = () => root.style.setProperty('--snapds-toolbar-h', `${toolbar.offsetHeight}px`);
    setVar();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(setVar);
    ro.observe(toolbar);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToGallery>) => {
      const msg = e.data;
      if (msg.type === 'componentList') {
        setComponents(msg.components);
      } else if (msg.type === 'snippetList') {
        setSnippets(msg.snippets);
      } else if (msg.type === 'indexing') {
        pendingRef.current = new Set(msg.packages);
        setProgress(null);
        setPendingPackages(new Set(msg.packages));
        if (msg.packages.length > 0) setTotalIndexing(msg.packages.length);
      } else if (msg.type === 'indexingProgress') {
        setProgress({ done: msg.done, total: msg.total, pkg: msg.pkg });
        if (pendingRef.current.has(msg.pkg)) {
          const next = new Set(pendingRef.current);
          next.delete(msg.pkg);
          pendingRef.current = next;
          setPendingPackages(next);
        }
      } else if (msg.type === 'switchTab') {
        setActiveTab(msg.tab);
      } else if (msg.type === 'focusSearch') {
        // Small delay so VS Code can finish bringing the view into focus first.
        setTimeout(() => searchBarRef.current?.focus(), 80);
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => vscode.postMessage({ type: 'search', query }), 200);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = query.trim().length > 0;
  const q = query.toLowerCase();

  // ── Components (tab 1) ──
  const filtered = useMemo(
    () => components.filter((c) => c.name.toLowerCase().includes(q)),
    [components, q],
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
  const allPackages = useMemo(() => {
    const set = new Set<string>();
    for (const c of components) set.add(c.id.split('#')[0]);
    return [...set];
  }, [components]);

  // ── Snippets (tab 2) ──
  const filteredSnippets = useMemo(
    () =>
      snippets.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q),
      ),
    [snippets, q],
  );
  const groupedSnippets = useMemo(() => {
    const groups: Record<string, CustomSnippet[]> = {};
    for (const s of filteredSnippets) {
      const cat = s.category?.trim() || UNCATEGORIZED;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [filteredSnippets]);
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of snippets) set.add(s.category?.trim() || UNCATEGORIZED);
    return [...set];
  }, [snippets]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    vscode.postMessage({ type: 'componentSelected', componentId: id });
  };
  const handleSnippetSelect = (id: string) => {
    setSelectedId(id);
    vscode.postMessage({ type: 'snippetSelected', snippetId: id });
  };

  const toggleGroup = (key: string) => {
    if (activeTab === 'components') setCollapsed((p) => ({ ...p, [key]: !p[key] }));
    else setSnippetCollapsed((p) => ({ ...p, [key]: !p[key] }));
  };

  const expandAll = () => (activeTab === 'components' ? setCollapsed({}) : setSnippetCollapsed({}));
  const collapseAll = () => {
    if (activeTab === 'components') {
      setCollapsed(Object.fromEntries([...allPackages, ...pendingPackages].map((p) => [p, true])));
    } else {
      setSnippetCollapsed(Object.fromEntries(allCategories.map((c) => [c, true])));
    }
  };

  const handleDragStart = (id: string, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ componentId: id }));
    e.dataTransfer.setData('text/plain', id);
  };
  const handleSnippetDragStart = (snip: CustomSnippet, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ snippetId: snip.id }));
    e.dataTransfer.setData('text/plain', snip.code);
  };

  const isIndexing = pendingPackages.size > 0;
  const indexingDone = progress ? progress.done : totalIndexing - pendingPackages.size;
  const indexingTotal = progress ? progress.total : totalIndexing;
  const indexingName = progress?.pkg || [...pendingPackages][0];
  const pendingList = [...pendingPackages].filter((p) => !groupedComponents[p]);

  const showComponents = activeTab === 'components';
  const activeCount = showComponents ? filtered.length : filteredSnippets.length;
  const showComponentTree = filtered.length > 0 || pendingList.length > 0;
  const showSnippetTree = filteredSnippets.length > 0;
  const hasNoSnippetsAtAll = snippets.length === 0;
  const hasSnippetsButNoMatch = snippets.length > 0 && filteredSnippets.length === 0;

  return (
    <div className="root" ref={rootRef}>
      <div className="tabs" role="tablist" aria-label="Gallery sections">
        <button
          type="button"
          role="tab"
          aria-selected={showComponents}
          className={`tab${showComponents ? ' active' : ''}`}
          title={`Open Components (${kb('⌃⌥⌘C', 'Ctrl+Shift+Alt+C')})`}
          onClick={() => setActiveTab('components')}
        >
          Components
          {components.length > 0 && <span className="tab-count">{components.length}</span>}
          <kbd className="tab-shortcut">{kb('⌃⌥⌘C', '⌃⇧⎇C')}</kbd>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!showComponents}
          className={`tab${!showComponents ? ' active' : ''}`}
          title={`Open Custom Snippets (${kb('⌃⌥⌘S', 'Ctrl+Shift+Alt+S')})`}
          onClick={() => setActiveTab('snippets')}
        >
          Custom Snippets
          {snippets.length > 0 && <span className="tab-count">{snippets.length}</span>}
          <kbd className="tab-shortcut">{kb('⌃⌥⌘S', '⌃⇧⎇S')}</kbd>
        </button>
      </div>

      <div className="toolbar-row" ref={toolbarRef}>
        <SearchBar
          ref={searchBarRef}
          value={query}
          onChange={setQuery}
          shortcutHint={kb('⌃⌥⌘F', '⌃⇧⎇F')}
          ariaLabel={showComponents ? 'Search components' : 'Search snippets'}
          placeholder={showComponents ? 'Search components…' : 'Search snippets…'}
        />
        {activeCount > 0 && (
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
            <span className="toolbar-total" title={`${activeCount} total`}>
              {activeCount}
            </span>
          </>
        )}
      </div>

      {showComponents && isIndexing && (
        <div className="indexing-bar" role="status" aria-live="polite">
          <div className="indexing-row">
            <span className="indexing-spinner" aria-hidden="true" />
            <span className="indexing-pkg-name">{indexingName}</span>
            <span className="indexing-progress">
              {indexingDone} / {indexingTotal}
            </span>
          </div>
          <p className="indexing-hint">
            First run parses component types — subsequent loads use cache and are instant.
          </p>
        </div>
      )}

      {showComponents ? (
        showComponentTree ? (
          <div className="tree" role="tree">
            {Object.entries(groupedComponents).map(([pkgName, pkgComponents]) => {
              const isOpen = hasQuery || !collapsed[pkgName];
              return (
                <div key={pkgName} className="tree-group">
                  <div
                    className="tree-row tree-group-header"
                    role="treeitem"
                    aria-level={1}
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
                    // biome-ignore lint/a11y/useSemanticElements: role="group" is the correct ARIA tree subgroup.
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
            {pendingList.map((pkg) => {
              const isOpen = hasQuery || !collapsed[pkg];
              return (
                <div key={`loading-${pkg}`} className="tree-group">
                  <div
                    className="tree-row tree-group-header tree-group-loading"
                    role="treeitem"
                    aria-level={1}
                    aria-busy="true"
                    aria-expanded={isOpen}
                    aria-label={`Loading ${pkg}`}
                    tabIndex={0}
                    onClick={() => toggleGroup(pkg)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleGroup(pkg);
                      }
                    }}
                  >
                    <span className={`twisty${isOpen ? ' open' : ''}`} aria-hidden="true" />
                    <FolderIcon />
                    <span className="tree-label">{pkg}</span>
                    <span className="tree-loading-spinner" aria-hidden="true" />
                  </div>
                  {isOpen && (
                    // biome-ignore lint/a11y/useSemanticElements: role="group" is the correct ARIA tree subgroup.
                    <div role="group" aria-label={`Loading components for ${pkg}`}>
                      <div className="skeleton-row">
                        <div className="skeleton-bar" style={{ width: '55%' }} />
                      </div>
                      <div className="skeleton-row">
                        <div
                          className="skeleton-bar"
                          style={{ width: '72%', animationDelay: '0.2s' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            {components.length === 0
              ? 'Import a Snapds package to see components.'
              : 'No components match your search.'}
          </div>
        )
      ) : showSnippetTree ? (
        <div className="tree" role="tree">
          {Object.entries(groupedSnippets).map(([category, catSnippets]) => {
            const isOpen = hasQuery || !snippetCollapsed[category];
            return (
              <div key={category} className="tree-group">
                <div
                  className="tree-row tree-group-header"
                  role="treeitem"
                  aria-level={1}
                  aria-expanded={isOpen}
                  tabIndex={0}
                  onClick={() => toggleGroup(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(category);
                    } else if (e.key === 'ArrowRight' && !isOpen) {
                      e.preventDefault();
                      toggleGroup(category);
                    } else if (e.key === 'ArrowLeft' && isOpen) {
                      e.preventDefault();
                      toggleGroup(category);
                    }
                  }}
                >
                  <span className={`twisty${isOpen ? ' open' : ''}`} aria-hidden="true" />
                  <TagIcon />
                  <span className="tree-label">{category}</span>
                  <span className="tree-badge">{catSnippets.length}</span>
                </div>
                {isOpen && (
                  // biome-ignore lint/a11y/useSemanticElements: role="group" is the correct ARIA tree subgroup.
                  <div role="group">
                    {catSnippets.map((s) => (
                      <SnippetRow
                        key={s.id}
                        snippet={s}
                        selected={s.id === selectedId}
                        onClick={() => handleSnippetSelect(s.id)}
                        onDragStart={(e) => handleSnippetDragStart(s, e)}
                        onEdit={() => vscode.postMessage({ type: 'editSnippet', snippetId: s.id })}
                        onDelete={() =>
                          vscode.postMessage({ type: 'deleteSnippet', snippetId: s.id })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : hasNoSnippetsAtAll ? (
        <div className="empty snippet-onboarding">
          <p className="snippet-onboarding-title">No custom snippets yet</p>
          <p className="snippet-onboarding-body">
            Select code in any React file and press <kbd>⌃⌥⌘S</kbd> (macOS) /{' '}
            <kbd>Ctrl+Shift+Alt+S</kbd> (Win/Linux), or right-click →{' '}
            <strong>Save Selection as Snippet</strong>.
          </p>
          <p className="snippet-onboarding-body">
            Snippets are injected with their imports — drag them into a file or use <kbd>⌃⌥⌘I</kbd>{' '}
            to search and insert.
          </p>
        </div>
      ) : hasSnippetsButNoMatch ? (
        <div className="empty">No snippets match your search.</div>
      ) : null}
    </div>
  );
}
