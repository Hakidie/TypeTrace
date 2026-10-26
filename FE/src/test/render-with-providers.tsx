import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

interface Options {
  /** URL the test starts at. */
  route?: string;
  /** History state of that URL, as a page passes it with `navigate(to, { state })`. */
  state?: unknown;
  /** Route pattern the UI is mounted on (defaults to `route`). */
  path?: string;
  /** Extra routes, e.g. `{ '/logout': 'logout route' }` to assert redirects; an element instead of a text can read the location. */
  otherRoutes?: Record<string, ReactNode>;
  /** Pre-filled client, for tests that need cached data before the first render. */
  queryClient?: QueryClient;
}

/** A fresh client per test: no retries, no shared cache between tests. */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

/** Renders `ui` inside a QueryClientProvider and a MemoryRouter. */
export const renderWithProviders = (
  ui: ReactElement,
  { route = '/', state, path, otherRoutes = {}, queryClient = createTestQueryClient() }: Options = {},
) => {
  const [pathname, search] = route.split('?');
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname, search: search ? `?${search}` : '', state }]}>
        <Routes>
          <Route path={path ?? pathname} element={ui} />
          {Object.entries(otherRoutes).map(([otherPath, page]) => (
            <Route key={otherPath} path={otherPath} element={typeof page === 'string' ? <div>{page}</div> : page} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};
