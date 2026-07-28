import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkillFileEntry, SkillsConfig } from '../types';
import { AiTab } from './AiTab';

afterEach(cleanup);

const baseSkills: SkillsConfig = {
  enabled: true,
  formats: ['claude', 'cursor'],
  destination: 'workspace',
  autoGenerate: true,
};

const files: SkillFileEntry[] = [
  {
    path: '/w/.claude/skills/snapds-button/SKILL.md',
    label: 'snapds-button',
    format: 'claude',
    title: 'Button',
  },
  {
    path: '/w/.claude/skills/snapds/SKILL.md',
    label: 'snapds',
    format: 'claude',
    title: 'Claude Router',
    isRouter: true,
  },
  {
    path: '/w/.cursor/rules/snapds-button.mdc',
    label: 'snapds-button',
    format: 'cursor',
    title: 'Button',
  },
  {
    path: '/w/.cursor/rules/snapds-index.mdc',
    label: 'snapds-index',
    format: 'cursor',
    title: 'Cursor Router',
    isRouter: true,
  },
];

function renderTab(overrides: Partial<Parameters<typeof AiTab>[0]> = {}) {
  return render(
    <AiTab
      skills={baseSkills}
      skillFiles={files}
      showSkillsDir
      onToggleShowDir={() => {}}
      updateSkills={vi.fn()}
      toggleFormat={vi.fn()}
      activePackages={[]}
      {...overrides}
    />,
  );
}

describe('AiTab', () => {
  it('lists every supported agent as a checkbox', () => {
    renderTab({ showSkillsDir: false });
    for (const label of [
      'Claude Code',
      'Augment',
      'Cursor',
      'GitHub Copilot',
      'Windsurf',
      'Cline',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('shows per-agent sub-tabs (agent name only, no redundant count) when multiple agents have files', () => {
    renderTab();
    expect(screen.getByRole('tablist')).toBeTruthy();
    const claudeTab = screen.getByRole('tab', { name: 'Claude Code' });
    expect(claudeTab).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cursor' })).toBeTruthy();
    // The tab label carries no count suffix.
    expect(claudeTab.textContent).not.toMatch(/\(\d+\)/);
  });

  it('renders only the active agent tab content, router card first', () => {
    renderTab();
    // Default active tab is the first selected agent (claude).
    expect(screen.getByText('Claude Router')).toBeTruthy();
    expect(screen.queryByText('Cursor Router')).toBeNull();
    // The router card shows a distinct "router" badge.
    expect(screen.getByText('router')).toBeTruthy();

    // Switching sub-tabs reveals the other agent's files.
    fireEvent.click(screen.getByRole('tab', { name: 'Cursor' }));
    expect(screen.getByText('Cursor Router')).toBeTruthy();
    expect(screen.queryByText('Claude Router')).toBeNull();
  });

  it('shows the compact-catalog toggle only when a consolidated agent is selected', () => {
    // No consolidated agent (claude/cursor) → no toggle.
    const { rerender } = render(
      <AiTab
        skills={baseSkills}
        skillFiles={[]}
        showSkillsDir={false}
        onToggleShowDir={() => {}}
        updateSkills={vi.fn()}
        toggleFormat={vi.fn()}
        activePackages={[]}
      />,
    );
    expect(screen.queryByText(/Compact/)).toBeNull();

    // With Copilot selected → toggle + explanatory help appear.
    rerender(
      <AiTab
        skills={{ ...baseSkills, formats: ['claude', 'copilot'] }}
        skillFiles={[]}
        showSkillsDir={false}
        onToggleShowDir={() => {}}
        updateSkills={vi.fn()}
        toggleFormat={vi.fn()}
        activePackages={[]}
      />,
    );
    expect(screen.getByText(/Compact GitHub Copilot/)).toBeTruthy();
    expect(screen.getByText(/loaded on every request/)).toBeTruthy();
  });

  it('shows a workspace-relative input when destination is subfolder', () => {
    renderTab({
      showSkillsDir: false,
      skills: { ...baseSkills, destination: 'subfolder', subPath: 'apps/web' },
    });
    const input = screen.getByPlaceholderText(/relative to the repo root/i) as HTMLInputElement;
    expect(input.value).toBe('apps/web');
  });

  it('warns when a root-only agent is paired with a non-root destination', () => {
    renderTab({
      showSkillsDir: false,
      skills: { ...baseSkills, formats: ['claude', 'copilot'], destination: 'subfolder' },
    });
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('GitHub Copilot');
  });

  it('does not warn for root-only agents when destination is the workspace root', () => {
    renderTab({
      showSkillsDir: false,
      skills: { ...baseSkills, formats: ['copilot'], destination: 'workspace' },
    });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('renders a single grid without sub-tabs for one agent', () => {
    renderTab({
      skills: { ...baseSkills, formats: ['generic'] },
      skillFiles: [
        {
          path: '/w/AGENTS.md',
          label: 'AGENTS',
          format: 'generic',
          title: 'Index',
          isRouter: true,
        },
        { path: '/w/snapds-skills/button.md', label: 'button', format: 'generic', title: 'Button' },
      ],
    });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText('Index')).toBeTruthy();
    expect(screen.getByText('Button')).toBeTruthy();
  });
});
