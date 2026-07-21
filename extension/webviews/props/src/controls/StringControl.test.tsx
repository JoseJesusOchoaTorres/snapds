import type { PropMeta } from '@snapds/webview-shared';
import { StringControl } from '@snapds/webview-shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const prop: PropMeta = { name: 'label', type: 'string', raw: 'string', required: false };

afterEach(cleanup);

describe('StringControl', () => {
  it('shows the prop name and current value', () => {
    render(<StringControl prop={prop} value="Hi" onChange={() => {}} />);
    expect(screen.getByText('label')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Hi');
  });

  it('renders an empty string for undefined or null values', () => {
    render(<StringControl prop={prop} value={undefined} onChange={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('emits the new value on change', () => {
    const onChange = vi.fn();
    render(<StringControl prop={prop} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
