import { AiTab } from './AiTab';
import { ComponentDetailModal } from './ComponentDetailModal';
import { ComponentsTab } from './ComponentsTab';
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
    handleSave,
    updateSkills,
    toggleFormat,
    toggleScope,
    openPackage,
    openComponentModal,
    saveOverride,
    resetOverride,
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
      />
    );
  };

  // Save persists preferences across every tab, so it is shared; Regenerate is
  // AI-only. Each tab declares its own `actions` (see Tabs) to stay scalable.
  const saveAction = (
    <>
      {isSaving && <progress className="action-progress" />}
      <button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save Preferences'}
      </button>
    </>
  );

  const regenerateAction = skills.enabled ? (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => vscode.postMessage({ type: 'regenerateAllSkills' })}
      title="Writes every selected component using the formats and destination chosen above."
    >
      Regenerate skills
    </button>
  ) : null;

  return (
    <div className="root">
      <h2>Snapds Settings</h2>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: 'components',
            label: 'Components',
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
              />
            ),
            actions: saveAction,
          },
          {
            id: 'ai',
            label: 'AI',
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
    </div>
  );
}
