import { AiTab } from './AiTab';
import { ComponentDetailModal } from './ComponentDetailModal';
import { ComponentsTab } from './ComponentsTab';
import { ConfigDetectedBanner } from './ConfigDetectedBanner';
import { ExportConfigModal } from './ExportConfigModal';
import { ImportPreviewModal } from './ImportPreviewModal';
import { OverrideEditorModal } from './OverrideEditorModal';
import { PackageDetailModal } from './PackageDetailModal';
import { Tabs } from './Tabs';
import { useSettingsController } from './useSettingsController';
import { vscode } from './vscodeApi';

export default function App() {
  const {
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
  } = useSettingsController();

  const renderPackageModal = () => {
    const name = openPkg;
    if (!name) return null;
    return (
      <PackageDetailModal
        pkg={name}
        detected={componentsByPkg[name] ?? []}
        selected={selectedByPkg[name] ?? []}
        loaded={componentsByPkg[name] !== undefined}
        manualValue={manualInputs[name] ?? ''}
        onManualChange={(v) => setManualInput(name, v)}
        onToggle={(comp) => toggleComponent(name, comp)}
        onAddManual={() => addManual(name)}
        onOpenEye={(comp) => openComponentModal('eye', comp)}
        onOpenGear={(comp) => openComponentModal('gear', comp)}
        onClose={() => setOpenPkg(null)}
        onReload={() => name && reloadPackage(name)}
      />
    );
  };

  const busy = isSaving || isRegenerating;

  // Save persists preferences across every tab, so it is shared; Regenerate is
  // AI-only. Each tab declares its own `actions` (see Tabs) to stay scalable.
  const saveAction = (
    <button type="button" className="btn-primary" onClick={handleSave} disabled={busy}>
      {isSaving ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          Saving…
        </>
      ) : (
        'Save Preferences'
      )}
    </button>
  );

  const regenerateAction = (
    <button
      type="button"
      className="btn-secondary"
      onClick={handleRegenerate}
      disabled={busy}
      title="Writes every selected component using the formats and destination chosen above."
    >
      {isRegenerating ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          Regenerating…
        </>
      ) : (
        'Regenerate skills'
      )}
    </button>
  );

  const showBanner = configStatus?.detected && configStatus.hasConflicts && !configBannerDismissed;

  return (
    <div className="root">
      <div className="settings-header">
        <h2>Snapds Settings</h2>
        <div className="config-actions">
          <button
            type="button"
            className="btn-small"
            onClick={() => openImportConfig()}
            disabled={busy}
            title="Load a snapds.config.json into your settings"
          >
            Load config
          </button>
          <button
            type="button"
            className="btn-small"
            onClick={() => setShowExportModal(true)}
            disabled={busy}
            title="Export current settings to snapds.config.json"
          >
            Export config
          </button>
        </div>
      </div>

      {showBanner && configStatus?.configPath && (
        <ConfigDetectedBanner
          configPath={configStatus.configPath}
          onLoad={() => openImportConfig()}
          onDismiss={dismissConfigBanner}
        />
      )}

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: 'components',
            label: 'Components',
            icon: 'components' as const,
            panel: (
              <ComponentsTab
                packages={packages}
                componentsByPkg={componentsByPkg}
                selectedByPkg={selectedByPkg}
                query={query}
                onQueryChange={setQuery}
                scopeFilters={scopeFilters}
                onToggleScope={toggleScope}
                onOpenPackage={openPackage}
                onRemovePackage={removePackage}
              />
            ),
            actions: saveAction,
          },
          {
            id: 'ai',
            label: 'AI',
            icon: 'sparkle' as const,
            panel: (
              <AiTab
                skills={skills}
                skillFiles={skillFiles}
                showSkillsDir={showSkillsDir}
                onToggleShowDir={() => setShowSkillsDir((v) => !v)}
                updateSkills={updateSkills}
                toggleFormat={toggleFormat}
              />
            ),
            actions: (
              <>
                {regenerateAction}
                {saveAction}
              </>
            ),
          },
        ]}
      />

      {renderPackageModal()}

      {detail?.mode === 'eye' && activeDetail && (
        <ComponentDetailModal
          detail={activeDetail}
          onClose={() => setDetail(null)}
          onOpenSkill={(path) => vscode.postMessage({ type: 'openSkill', path })}
        />
      )}

      {detail?.mode === 'gear' && activeDetail && (
        <OverrideEditorModal
          detail={activeDetail}
          onClose={() => setDetail(null)}
          onSave={saveOverride}
          onResetAll={resetOverride}
        />
      )}

      {showExportModal && (
        <ExportConfigModal
          defaultPath="snapds.config.json"
          existingConfig={configStatus?.detected ?? false}
          onExport={exportConfig}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          onConfirm={confirmImport}
          onClose={clearImportPreview}
        />
      )}
    </div>
  );
}
