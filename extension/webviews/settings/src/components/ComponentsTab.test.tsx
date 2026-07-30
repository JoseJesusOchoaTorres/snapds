import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackageMeta } from '../types';
import { ComponentsTab } from './ComponentsTab';

afterEach(cleanup);

const noop = () => {};

const baseProps = {
  packages: [] as PackageMeta[],
  componentsByPkg: {} as Record<string, string[]>,
  selectedByPkg: {} as Record<string, string[]>,
  query: '',
  onQueryChange: noop,
  scopeFilters: [] as string[],
  onToggleScope: noop,
  onOpenPackage: noop,
  onRemovePackage: noop,
  onAddLocalSource: noop,
  hiddenPackages: [] as string[],
  showHidden: false,
  onToggleShowHidden: noop,
  onHidePackage: noop,
  onUnhidePackage: noop,
  onRemoveLocalSource: noop,
};

describe('ComponentsTab source guidance', () => {
  it('always shows a hint contrasting npm packages and local folders', () => {
    const packages: PackageMeta[] = [{ name: 'lucide-react', enabled: false, kind: 'npm' }];
    const { container } = render(<ComponentsTab {...baseProps} packages={packages} />);

    const hint = container.querySelector('.tab-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('npm packages');
    expect(hint?.textContent).toContain('local folders');
  });

  it('shows a guided empty state explaining both source kinds when nothing is active', () => {
    const packages: PackageMeta[] = [
      { name: 'lucide-react', enabled: false, kind: 'npm' },
      { name: '@starlight/ui', enabled: false, kind: 'npm' },
    ];
    const { container } = render(<ComponentsTab {...baseProps} packages={packages} />);

    const guide = container.querySelector('.empty-guide');
    expect(guide).not.toBeNull();
    expect(guide?.querySelector('ul')).not.toBeNull();
    expect(guide?.textContent).toContain('npm packages');
    expect(guide?.textContent).toContain('local folders');
  });

  it('gives the LOCAL and UNSCOPED meta chips and real scopes descriptive tooltips', () => {
    const packages: PackageMeta[] = [
      { name: 'src/components/ui', enabled: false, kind: 'local', importAlias: '@/components/ui' },
      { name: 'lucide-react', enabled: false, kind: 'npm' },
      { name: '@radix-ui/react-dialog', enabled: false, kind: 'npm' },
    ];
    render(<ComponentsTab {...baseProps} packages={packages} />);

    expect(screen.getByRole('button', { name: 'LOCAL' }).getAttribute('title')).toContain(
      'In-repo component sources',
    );
    expect(screen.getByRole('button', { name: 'UNSCOPED' }).getAttribute('title')).toContain(
      'without an @scope',
    );
    expect(screen.getByRole('button', { name: '@radix-ui' }).getAttribute('title')).toBe(
      'Show only @radix-ui packages',
    );
  });

  it('wires an active local package to its LOCAL badge and import alias', () => {
    const packages: PackageMeta[] = [
      {
        name: 'src/components/ui',
        enabled: true,
        kind: 'local',
        importAlias: '@/components/ui',
        components: ['Button'],
      },
    ];
    const { container } = render(
      <ComponentsTab
        {...baseProps}
        packages={packages}
        componentsByPkg={{ 'src/components/ui': ['Button'] }}
        selectedByPkg={{ 'src/components/ui': ['Button'] }}
      />,
    );

    expect(container.querySelector('.pkg-card-badge-local')).not.toBeNull();
    expect(container.querySelector('.pkg-card-alias')?.textContent).toContain('@/components/ui');
  });

  it('invokes onAddLocalSource when the + Local folder button is clicked', () => {
    const onAddLocalSource = vi.fn();
    const packages: PackageMeta[] = [{ name: 'lucide-react', enabled: false, kind: 'npm' }];
    render(
      <ComponentsTab {...baseProps} packages={packages} onAddLocalSource={onAddLocalSource} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Local folder' }));
    expect(onAddLocalSource).toHaveBeenCalledOnce();
  });
});

describe('ComponentsTab hide & remove', () => {
  it('hides hidden packages from Available and offers a Show hidden toggle', () => {
    const packages: PackageMeta[] = [
      { name: 'lucide-react', enabled: false, kind: 'npm' },
      { name: 'cmdk', enabled: false, kind: 'npm' },
    ];
    render(<ComponentsTab {...baseProps} packages={packages} hiddenPackages={['cmdk']} />);

    expect(screen.queryByText('cmdk')).toBeNull();
    expect(screen.getByText('lucide-react')).not.toBeNull();
    expect(screen.getByRole('button', { name: /show hidden \(1\)/i })).not.toBeNull();
  });

  it('calls onHidePackage when a discovered Available card is hidden', () => {
    const onHidePackage = vi.fn();
    const packages: PackageMeta[] = [{ name: 'lucide-react', enabled: false, kind: 'npm' }];
    render(<ComponentsTab {...baseProps} packages={packages} onHidePackage={onHidePackage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide lucide-react' }));
    expect(onHidePackage).toHaveBeenCalledWith('lucide-react');
  });

  it('renders hidden packages in a Hidden group with an Unhide action', () => {
    const onUnhidePackage = vi.fn();
    const packages: PackageMeta[] = [{ name: 'cmdk', enabled: false, kind: 'npm' }];
    render(
      <ComponentsTab
        {...baseProps}
        packages={packages}
        hiddenPackages={['cmdk']}
        showHidden
        onUnhidePackage={onUnhidePackage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show cmdk' }));
    expect(onUnhidePackage).toHaveBeenCalledWith('cmdk');
  });

  it('lets a manually-added local folder be removed and never hides it', () => {
    const onRemoveLocalSource = vi.fn();
    const packages: PackageMeta[] = [
      {
        name: 'src/components/ui-v2',
        enabled: false,
        kind: 'local',
        autoDetected: false,
        importAlias: '@/components/ui-v2',
      },
    ];
    render(
      <ComponentsTab
        {...baseProps}
        packages={packages}
        // Even if it somehow lands in hiddenPackages, a manual folder stays visible.
        hiddenPackages={['src/components/ui-v2']}
        onRemoveLocalSource={onRemoveLocalSource}
      />,
    );

    expect(screen.getByText('src/components/ui-v2')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide src/components/ui-v2' })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove folder src/components/ui-v2 from Snapds' }),
    );
    expect(onRemoveLocalSource).toHaveBeenCalledWith('src/components/ui-v2');
  });

  it('treats an auto-detected local source as hideable, not removable', () => {
    const packages: PackageMeta[] = [
      {
        name: 'src/components/ui',
        enabled: false,
        kind: 'local',
        autoDetected: true,
        importAlias: '@/components/ui',
      },
    ];
    render(<ComponentsTab {...baseProps} packages={packages} />);

    expect(screen.getByRole('button', { name: 'Hide src/components/ui' })).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Remove folder src/components/ui from Snapds' }),
    ).toBeNull();
  });
});
