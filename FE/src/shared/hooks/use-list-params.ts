import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** The name of `key` in the URL: `key` itself, or `<prefix>-<key>` for a list with a `prefix`. */
const paramName = (key: string, prefix?: string) => (prefix ? `${prefix}-${key}` : key);

/**
 * State of a list page kept in the URL: `?q=lan&role=admin&sort=-createdAt&page=2`.
 * Reload, back button and shared links keep the same view. Changing anything
 * except the page goes back to page 1. Default values are left out of the URL.
 *
 *   const list = useListParams({ sort: '-createdAt' });
 *   list.get('role')            // '' when not set
 *   list.set('role', 'admin')   // '' removes it
 *
 * Two lists on one page: give one a `prefix`, and its values get their own names in the URL
 * (`useListParams({ sort: 'updatedAt', prefix: 'pending' })` keeps `?pending-q=lan&pending-page=2`).
 */
export const useListParams = ({ sort: defaultSort, prefix }: { sort: string; prefix?: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedPage = Number(searchParams.get(paramName('page', prefix)));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const sort = searchParams.get(paramName('sort', prefix)) || defaultSort;
  const q = searchParams.get(paramName('q', prefix)) ?? '';

  const get = useCallback((key: string) => searchParams.get(paramName(key, prefix)) ?? '', [searchParams, prefix]);

  const set = useCallback(
    (key: string, value: string) => {
      setSearchParams((params) => {
        const isDefault = value === '' || (key === 'sort' && value === defaultSort) || (key === 'page' && value === '1');
        if (isDefault) params.delete(paramName(key, prefix));
        else params.set(paramName(key, prefix), value);
        if (key !== 'page') params.delete(paramName('page', prefix));
        return params;
      });
    },
    [setSearchParams, defaultSort, prefix],
  );

  const setPage = useCallback((next: number) => set('page', String(next)), [set]);

  return { page, sort, q, get, set, setPage };
};
