import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PackageCard } from './PackageCard';

afterEach(cleanup);

const baseProps = {
  name: 'src/components/ui',
  selectedCount: 2,
  totalCount: 4,
  preview: ['Button', 'Card'],
  onOpen: () => {},
};

describe('PackageCard local vs npm source affordances', () => {
  it('shows a LOCAL badge and the import alias for a local source', () => {
    const { container } = render(
      <PackageCard {...baseProps} local importAlias="@/components/ui" />,
    );

    const badge = container.querySelector('.pkg-card-badge-local');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toContain('not from node_modules');

    const alias = container.querySelector('.pkg-card-alias');
    expect(alias).not.toBeNull();
    expect(alias?.textContent).toContain('@/components/ui');
    expect(alias?.getAttribute('title')).toContain('path alias');
  });

  it('renders no LOCAL badge or alias for an npm package', () => {
    const { container } = render(<PackageCard {...baseProps} name="@radix-ui/react-dialog" />);

    expect(container.querySelector('.pkg-card-badge-local')).toBeNull();
    expect(container.querySelector('.pkg-card-alias')).toBeNull();
  });

  it('shows the badge but no alias line when a local source has no alias yet', () => {
    // A manually-added folder whose alias could not be derived from tsconfig.
    const { container } = render(<PackageCard {...baseProps} local />);

    expect(container.querySelector('.pkg-card-badge-local')).not.toBeNull();
    expect(container.querySelector('.pkg-card-alias')).toBeNull();
  });
});
