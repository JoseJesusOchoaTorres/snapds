import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

afterEach(cleanup);

describe('SearchBar', () => {
  it('exposes an accessible, labelled search input', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'Search components' });
    expect(input).toBeTruthy();
  });

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Search components' });
    fireEvent.change(input, { target: { value: 'button' } });
    expect(onChange).toHaveBeenCalledWith('button');
  });
});
