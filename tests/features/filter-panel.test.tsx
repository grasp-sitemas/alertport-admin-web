/**
 * Behavioral tests for the shared FilterPanel.
 *
 * Locks in the three UX invariants from the recent redesign:
 *  1. The primary button label is "Buscar" (was "Filtrar" - the old
 *     label suggested opening a drawer, not running the query).
 *  2. Clicking Buscar must NOT auto-close the drawer. Live-filter
 *     pages used to see the drawer collapse with nothing visibly
 *     happening, which looked broken.
 *  3. When the drawer is closed, the Buscar button is always visible
 *     so fast refreshes don't require an open-then-click dance.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import ptMessages from '@/messages/pt.json';
import { FilterPanel } from '@/components/shared/filter-panel';

afterEach(() => cleanup());

function renderPanel(props: Partial<Parameters<typeof FilterPanel>[0]>) {
  const onChange = vi.fn();
  const onSearch = vi.fn();
  const onClear = vi.fn();
  const defaults = {
    fields: [{ key: 'name', labelKey: 'common.name', type: 'text' as const }],
    values: {},
    onChange,
    onSearch,
    onClear,
    ...props,
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages as Record<string, unknown>}>
      <FilterPanel {...defaults} />
    </NextIntlClientProvider>,
  );
  return { onChange, onSearch, onClear };
}

describe('FilterPanel', () => {
  it('renders the primary search button with the "Buscar" label (not "Filtrar")', () => {
    renderPanel({});
    expect(screen.getByRole('button', { name: /^Buscar$/ })).toBeInTheDocument();
    // "Filtrar" used to be the button label; make sure we didn't regress it.
    expect(screen.queryByRole('button', { name: /^Filtrar$/ })).not.toBeInTheDocument();
  });

  it('calls onSearch when Buscar is clicked', () => {
    const { onSearch } = renderPanel({});
    fireEvent.click(screen.getByRole('button', { name: /^Buscar$/ }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('keeps Buscar visible when the drawer is collapsed', () => {
    renderPanel({});
    // Filters toggle is visible with "Filtros" label; drawer is closed
    // by default; Buscar must still be clickable.
    expect(screen.getByRole('button', { name: /^Filtros$/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /^Buscar$/ })).toBeEnabled();
  });

  it('does NOT auto-close the drawer after a search', () => {
    renderPanel({ defaultOpen: true });
    const filtersToggle = screen.getByRole('button', { name: /^Filtros$/ });
    expect(filtersToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Buscar$/ }));
    // Drawer should remain open - the operator stays in context.
    expect(filtersToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the Clear button when there are no active filters', () => {
    renderPanel({});
    expect(screen.queryByRole('button', { name: /Limpar filtros/i })).not.toBeInTheDocument();
  });

  it('shows the Clear button when an active filter is set', () => {
    renderPanel({ values: { name: 'Alice' } });
    expect(screen.getByRole('button', { name: /Limpar filtros/i })).toBeInTheDocument();
  });

  it('renders the active-count badge based on set filters', () => {
    renderPanel({ values: { name: 'Alice', email: 'a@b.com' } });
    // Badge shows the number 2 inside the Filtros button.
    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveTextContent('2');
  });

  it('forwards Enter key submissions from text inputs to onSearch', () => {
    const { onSearch } = renderPanel({ defaultOpen: true });
    const input = screen.getByPlaceholderText(/Nome/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the Clear button is clicked', () => {
    const { onClear } = renderPanel({ values: { name: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('in alwaysOpen mode, renders a bottom-right action row with both buttons', () => {
    renderPanel({ alwaysOpen: true });
    // There's no collapsible toggle in alwaysOpen mode.
    expect(screen.queryByRole('button', { name: /^Filtros$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Buscar$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpar filtros/i })).toBeInTheDocument();
  });

  it('respects an explicit activeFilterCount override', () => {
    renderPanel({ values: { name: 'x' }, activeFilterCount: 7 });
    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveTextContent('7');
  });
});
