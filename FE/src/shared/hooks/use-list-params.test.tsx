import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useListParams } from './use-list-params';

const renderAt = (url: string) => {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...useListParams({ sort: '-createdAt' }), location: useLocation() }), { wrapper });
};

describe('useListParams', () => {
  it('reads page, sort, search and filters from the URL with defaults', () => {
    const { result } = renderAt('/admin/users?q=lan&role=admin&page=2');
    expect(result.current).toMatchObject({ page: 2, sort: '-createdAt', q: 'lan' });
    expect(result.current.get('role')).toBe('admin');
    expect(result.current.get('verified')).toBe('');
  });

  it('goes back to page 1 when a filter changes, and drops default values', () => {
    const { result } = renderAt('/admin/users?page=3');

    act(() => result.current.set('role', 'admin'));
    expect(result.current.location.search).toBe('?role=admin');

    act(() => result.current.set('sort', 'email'));
    expect(result.current.location.search).toBe('?role=admin&sort=email');

    act(() => result.current.set('sort', '-createdAt'));
    act(() => result.current.set('role', ''));
    expect(result.current.location.search).toBe('');
  });

  it('changes the page without touching the filters', () => {
    const { result } = renderAt('/admin/users?q=lan');
    act(() => result.current.setPage(2));
    expect(result.current.location.search).toBe('?q=lan&page=2');
    act(() => result.current.setPage(1));
    expect(result.current.location.search).toBe('?q=lan');
  });

  it('keeps a second list on the same page apart with a prefix', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/admin/passages?page=3&q=bank']}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => ({ ...useListParams({ sort: 'updatedAt', prefix: 'pending' }), location: useLocation() }), { wrapper });

    // The other list's `page` and `q` are not this list's.
    expect(result.current).toMatchObject({ page: 1, sort: 'updatedAt', q: '' });

    act(() => result.current.set('q', 'song'));
    act(() => result.current.setPage(2));
    expect(result.current).toMatchObject({ page: 2, q: 'song' });
    expect(result.current.location.search).toBe('?page=3&q=bank&pending-q=song&pending-page=2');

    // A new search goes back to its own page 1 only.
    act(() => result.current.set('q', ''));
    expect(result.current.location.search).toBe('?page=3&q=bank');
  });
});
