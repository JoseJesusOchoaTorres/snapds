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

  it('hides the clear button when the query is empty', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('shows a clear button when there is text, and clicking it clears the query', () => {
    const onChange = vi.fn();
    render(<SearchBar value="button" onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear search' });
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears the query when Escape is pressed with text present', () => {
    const onChange = vi.fn();
    render(<SearchBar value="button" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Search components' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not fire onChange on Escape when the query is already empty', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Search components' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
