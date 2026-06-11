import { useEffect, useMemo, useState } from 'react';
import { vscode } from './vscodeApi';
import type { PackageMeta, ToSettings } from './types';

export default function App() {
  const [packages, setPackages] = useState<PackageMeta[]>([]);
  const [blacklistInputs, setBlacklistInputs] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToSettings>) => {
      const msg = e.data;
      if (msg.type === 'packageList') {
        setPackages(msg.packages);
        const inputs: Record<string, string> = {};
        msg.packages.forEach(p => {
          inputs[p.name] = p.blacklist?.join(', ') || '';
        });
        setBlacklistInputs(inputs);
        setIsSaving(false);
      } else if (msg.type === 'saving') {
        setIsSaving(true);
      } else if (msg.type === 'saved') {
        setIsSaving(false);
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const filtered = useMemo(
    () => packages.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [packages, query]
  );

  const handleToggle = (name: string, enabled: boolean) => {
    setPackages(packages.map(p => p.name === name ? { ...p, enabled } : p));
  };

  const handleBlacklistChange = (name: string, value: string) => {
    setBlacklistInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    vscode.postMessage({
      type: 'savePackages',
      packages: packages.filter(p => p.enabled).map(p => ({
        name: p.name,
        blacklist: (blacklistInputs[p.name] || '').split(',').map(s => s.trim()).filter(Boolean)
      }))
    });
  };

  return (
    <div className="root" style={{ padding: '16px' }}>
      <h2>Snapds Settings</h2>
      <p style={{ marginBottom: '16px', opacity: 0.8 }}>
        Select which Snapds packages to enable for the current workspace.
      </p>

      <input
        type="text"
        placeholder="Filter packages..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', marginBottom: '16px', padding: '8px' }}
        disabled={isSaving}
      />

      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          padding: '8px 16px',
          marginBottom: '16px',
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          cursor: isSaving ? 'wait' : 'pointer'
        }}
      >
        {isSaving ? 'Saving & Loading Components...' : 'Save Preferences'}
      </button>

      {isSaving && (
        <progress style={{ width: '100%', marginBottom: '16px' }} />
      )}

      {filtered.length === 0 ? (
        <div className="empty">No packages found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: isSaving ? 0.5 : 1, pointerEvents: isSaving ? 'none' : 'auto' }}>
          {filtered.map((p) => (
            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', background: 'var(--vscode-editor-inactiveSelectionBackground)', borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => handleToggle(p.name, e.target.checked)}
                />
                <span style={{ fontFamily: 'monospace' }}>{p.name}</span>
              </label>
              {p.enabled && (
                <div style={{ paddingLeft: '24px' }}>
                  <input
                    type="text"
                    placeholder="Ignored components (comma separated) e.g. Button, Icon"
                    value={blacklistInputs[p.name] !== undefined ? blacklistInputs[p.name] : (p.blacklist?.join(', ') || '')}
                    onChange={(e) => handleBlacklistChange(p.name, e.target.value)}
                    style={{ width: '100%', padding: '4px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
