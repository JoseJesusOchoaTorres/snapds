import { useEffect, useRef, useState } from 'react';
import type {
  ComponentDetail,
  ConfigExportMode,
  ConfigImportPreviewPayload,
  ConfigStatusPayload,
  PackageMeta,
  SkillFileEntry,
  SkillFormat,
  SkillsConfig,
  ToSettings,
  UserOverride,
} from './types';
import { vscode } from './vscodeApi';

const DEFAULT_SKILLS: SkillsConfig = {
  enabled: false,
  formats: ['augment'],
  destination: 'workspace',
  autoGenerate: true,
};

type DetailTarget = { mode: 'eye' | 'gear'; pkg: string; component: string };

/**
 * Owns all Settings webview state, message wiring, and the handlers the view
 * dispatches. Keeping this out of `App` leaves the component as pure
 * composition and makes the controller logic independently testable.
 */
export function useSettingsController() {
  const [packages, setPackages] = useState<PackageMeta[]>([]);
  const [componentsByPkg, setComponentsByPkg] = useState<Record<string, string[]>>({});
  const [selectedByPkg, setSelectedByPkg] = useState<Record<string, string[]>>({});
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [skills, setSkills] = useState<SkillsConfig>(DEFAULT_SKILLS);
  const [skillFiles, setSkillFiles] = useState<SkillFileEntry[]>([]);
  const [showSkillsDir, setShowSkillsDir] = useState(false);
  const [query, setQuery] = useState('');
  const [scopeFilters, setScopeFilters] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [openPkg, setOpenPkg] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatusPayload | null>(null);
  const [configBannerDismissed, setConfigBannerDismissed] = useState(false);
  const [importPreview, setImportPreview] = useState<ConfigImportPreviewPayload | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const packagesRef = useRef<PackageMeta[]>(packages);
  packagesRef.current = packages;

  // Packages already asked to (re)scan this session, so we revalidate at most once
  // even when counts were seeded from cache.
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onMessage = (e: MessageEvent<ToSettings>) => {
      const msg = e.data;
      if (msg.type === 'packageList') {
        setPackages(msg.packages);
        setIsSaving(false);
        // Seed detected components + selection from cached names so counts show
        // immediately, without waiting for an expand-triggered scan.
        setComponentsByPkg((prev) => {
          const next = { ...prev };
          for (const p of msg.packages)
            if (p.components && next[p.name] === undefined) next[p.name] = p.components;
          return next;
        });
        // Seed selection for already-configured (enabled) packages so they land in
        // the Active section; others start empty in Available until the user picks.
        setSelectedByPkg((prev) => {
          const next = { ...prev };
          for (const p of msg.packages) {
            if (next[p.name] !== undefined) continue;
            if (!p.enabled) {
              next[p.name] = [];
              continue;
            }
            if (!p.components) continue;
            const excluded = new Set(p.excluded ?? []);
            const sel = p.components.filter((c) => !excluded.has(c));
            for (const m of p.manual ?? []) if (!sel.includes(m)) sel.push(m);
            next[p.name] = sel;
          }
          return next;
        });
      } else if (msg.type === 'componentNames') {
        setComponentsByPkg((prev) => ({ ...prev, [msg.pkg]: msg.components }));
        // Seed selection only for enabled (configured) packages; unconfigured
        // packages start empty so the user explicitly opts components in.
        setSelectedByPkg((prev) => {
          if (prev[msg.pkg] !== undefined) return prev;
          const pkg = packagesRef.current.find((p) => p.name === msg.pkg);
          if (!pkg?.enabled) return { ...prev, [msg.pkg]: [] };
          const excluded = new Set(pkg.excluded ?? []);
          const selected = msg.components.filter((c) => !excluded.has(c));
          for (const m of pkg.manual ?? []) if (!selected.includes(m)) selected.push(m);
          return { ...prev, [msg.pkg]: selected };
        });
      } else if (msg.type === 'skillsConfig') {
        setSkills({ ...DEFAULT_SKILLS, ...msg.config });
      } else if (msg.type === 'saving') {
        setIsSaving(true);
      } else if (msg.type === 'saved') {
        setIsSaving(false);
        setIsRegenerating(false);
      } else if (msg.type === 'customPathPicked') {
        setSkills((prev) => {
          const next = { ...prev, destination: 'custom' as const, customPath: msg.path };
          vscode.postMessage({ type: 'saveSkillsConfig', config: next });
          return next;
        });
      } else if (msg.type === 'skillsList') {
        setSkillFiles(msg.files);
      } else if (msg.type === 'componentDetail') {
        setComponentDetail(msg.detail);
      } else if (msg.type === 'scopeFilters') {
        setScopeFilters(msg.filters);
      } else if (msg.type === 'configStatus') {
        setConfigStatus(msg.payload);
        // If the status changes (e.g. after import), un-dismiss the banner.
        if (msg.payload.detected && msg.payload.hasConflicts) {
          setConfigBannerDismissed(false);
        }
      } else if (msg.type === 'configImportPreview') {
        setImportPreview(msg.payload);
      } else if (msg.type === 'configExported') {
        // Nothing to update in UI state — extension shows its own notification.
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Refresh the skills directory listing whenever it's visible and the
  // destination/formats change, so the list reflects what's on disk.
  // biome-ignore lint/correctness/useExhaustiveDependencies: destination/customPath/formats are intentional triggers even though not read in the effect body.
  useEffect(() => {
    if (activeTab === 'ai' && showSkillsDir) vscode.postMessage({ type: 'listSkills' });
  }, [activeTab, showSkillsDir, skills.destination, skills.customPath, skills.formats]);

  const requestComponents = (name: string) => {
    if (requestedRef.current.has(name)) return;
    requestedRef.current.add(name);
    vscode.postMessage({ type: 'requestComponents', pkg: name });
  };

  const toggleComponent = (pkg: string, comp: string) => {
    setSelectedByPkg((prev) => {
      const cur = prev[pkg] ?? [];
      const next = cur.includes(comp) ? cur.filter((c) => c !== comp) : [...cur, comp];
      return { ...prev, [pkg]: next };
    });
  };

  // Deactivate a package entirely: clearing its selection moves the card to
  // Available. Persisting on the next save disables it (all components excluded).
  const removePackage = (pkg: string) => {
    setSelectedByPkg((prev) => ({ ...prev, [pkg]: [] }));
  };

  const addManual = (pkg: string) => {
    const value = (manualInputs[pkg] || '').trim();
    if (!value) return;
    setSelectedByPkg((prev) => {
      const cur = prev[pkg] ?? [];
      return cur.includes(value) ? prev : { ...prev, [pkg]: [...cur, value] };
    });
    setManualInputs((prev) => ({ ...prev, [pkg]: '' }));
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    vscode.postMessage({ type: 'regenerateAllSkills' });
  };

  const handleSave = () => {
    setIsSaving(true);
    vscode.postMessage({
      type: 'savePackages',
      packages: packages
        .filter((p) => p.enabled || (selectedByPkg[p.name]?.length ?? 0) > 0)
        .map((p) => {
          const detected = componentsByPkg[p.name];
          if (detected === undefined) return { name: p.name };
          return { name: p.name, components: detected, selected: selectedByPkg[p.name] ?? [] };
        }),
    });
  };

  const updateSkills = (partial: Partial<SkillsConfig>) => {
    const next = { ...skills, ...partial };
    setSkills(next);
    vscode.postMessage({ type: 'saveSkillsConfig', config: next });
  };

  const toggleFormat = (fmt: SkillFormat) => {
    const has = skills.formats.includes(fmt);
    const formats = has ? skills.formats.filter((f) => f !== fmt) : [...skills.formats, fmt];
    updateSkills({ formats });
  };

  const toggleScope = (scope: string) =>
    setScopeFilters((prev) => {
      const next = prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope];
      vscode.postMessage({ type: 'setScopeFilters', filters: next });
      return next;
    });

  const setManualInput = (pkg: string, value: string) =>
    setManualInputs((prev) => ({ ...prev, [pkg]: value }));

  const openPackage = (name: string) => {
    setOpenPkg(name);
    requestComponents(name);
  };

  const reloadPackage = (name: string) => {
    setComponentsByPkg((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    requestedRef.current.delete(name);
    vscode.postMessage({ type: 'reloadPackage', pkg: name });
  };

  const openComponentModal = (mode: 'eye' | 'gear', component: string) => {
    if (!openPkg) return;
    setComponentDetail(null);
    setDetail({ mode, pkg: openPkg, component });
    vscode.postMessage({ type: 'requestComponentDetail', pkg: openPkg, component });
  };

  const saveOverride = (override: UserOverride) => {
    if (!detail) return;
    vscode.postMessage({
      type: 'saveUserOverride',
      pkg: detail.pkg,
      component: detail.component,
      override,
    });
    setDetail(null);
    setComponentDetail(null);
  };

  const resetOverride = () => {
    if (!detail) return;
    vscode.postMessage({ type: 'resetUserOverride', pkg: detail.pkg, component: detail.component });
    setDetail(null);
    setComponentDetail(null);
  };

  const activeDetail =
    detail &&
    componentDetail &&
    componentDetail.pkg === detail.pkg &&
    componentDetail.component === detail.component
      ? componentDetail
      : null;

  const openImportConfig = (filePath?: string) => {
    vscode.postMessage({ type: 'importConfig', filePath });
  };

  const confirmImport = (applyOverrides: boolean) => {
    vscode.postMessage({ type: 'confirmImportConfig', applyOverrides });
    setImportPreview(null);
  };

  const exportConfig = (opts: {
    includeOverrides: boolean;
    mode: ConfigExportMode;
    outputPath?: string;
  }) => {
    // Include current UI selection state so the serializer can compute excluded
    // from detected−selected without requiring a "Save Preferences" first.
    const packageSelections = packages
      .filter((p) => componentsByPkg[p.name] !== undefined)
      .map((p) => ({
        name: p.name,
        detected: componentsByPkg[p.name] ?? [],
        selected: selectedByPkg[p.name] ?? [],
      }));
    vscode.postMessage({ type: 'exportConfig', ...opts, packageSelections });
  };

  const dismissConfigBanner = () => setConfigBannerDismissed(true);
  const clearImportPreview = () => setImportPreview(null);

  return {
    packages,
    componentsByPkg,
    selectedByPkg,
    manualInputs,
    skills,
    skillFiles,
    showSkillsDir,
    query,
    scopeFilters,
    isSaving,
    isRegenerating,
    activeTab,
    openPkg,
    detail,
    activeDetail,
    setShowSkillsDir,
    setQuery,
    setActiveTab,
    setOpenPkg,
    setDetail,
    setManualInput,
    toggleComponent,
    addManual,
    removePackage,
    handleSave,
    handleRegenerate,
    updateSkills,
    toggleFormat,
    toggleScope,
    openPackage,
    reloadPackage,
    openComponentModal,
    saveOverride,
    resetOverride,
    configStatus,
    configBannerDismissed,
    importPreview,
    showExportModal,
    setShowExportModal,
    openImportConfig,
    confirmImport,
    exportConfig,
    dismissConfigBanner,
    clearImportPreview,
  };
}
