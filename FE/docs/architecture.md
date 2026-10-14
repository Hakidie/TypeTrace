# Frontend Architecture & Conventions

> Instruction doc for AI agents and developers. Read this before adding or changing frontend code. Follow these patterns exactly — do not introduce new architectural styles without reason. The reference feature is `src/modules/notes/`; the reference admin page is `src/modules/admin/pages/AdminUsersPage.tsx`. This is a base project for students: keep code simple, reuse what exists, and update this file when a convention changes.

## Stack

- **Framework**: React 19 + TypeScript (strict)
- **Build**: Vite 8
- **Routing**: React Router 7 (`react-router-dom`)
- **Server state**: TanStack Query 5 (`@tanstack/react-query`)
- **HTTP**: Axios (single shared `http` instance with interceptors)
- **Forms**: React Hook Form 7 + Zod 4 (`@hookform/resolvers`)
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS 4
- **Icons**: `lucide-react` · **Toasts**: `sonner`
- **Dev**: `vite` · **Build**: `tsc -b && vite build` · **Lint**: `eslint .` · **Test**: Vitest + Testing Library

## Feature-Module Architecture

Code is organized by **feature module**, not by file type. Each module is self-contained and owns its pages, components, hooks, api and types.

```
src/
├── main.tsx                 # QueryClientProvider + BrowserRouter + App + Toaster; applyTheme()
├── App.tsx                  # auth routes + protected shell; feature routes come from app/modules.ts
├── app/
│   ├── module.types.ts      # AppModule, ModuleRoute, NavItem
│   └── modules.ts           # registry: the list of feature modules
├── modules/
│   ├── auth/                # api/, components/ (AuthLayout, ProtectedRoute), hooks/ (use-current-user),
│   │                        # pages/, store/ (token.store), types/
│   ├── admin/               # admin area: admin.module.ts (adminRoutes), api/, hooks/use-admin.ts,
│   │                        # components/ (user-columns, UserEditDialog), pages/ (AdminDashboardPage, AdminUsersPage)
│   ├── chat/                # sample AI chat: chat.module.ts (widget), chat.config.ts (texts), hooks/use-chat.ts,
│   │                        # components/ (ChatWidget = floating button + popup, ChatPanel, ChatComposer)
│   ├── home/                # home.module.ts, pages/HomePage
│   ├── notes/               # REFERENCE MODULE: api/, hooks/, components/, pages/, types/, notes.module.ts
│   ├── typing/              # /typing (TypingPage, TypingArea) and /typing/result/:id: a session is started when the page opens (no start button), the timer starts at the first key (`PATCH /api/sessions/:id/begin`) and the backend grades it (/api/sessions); the page uses the login/register look (`shared/lib/red-glass-theme.ts`, also used by `AuthLayout`) and shows only the passage: an invisible textarea sits over it and the typed text appears in the passage (grey = not reached, white = typed or right, red = wrong word after the space); TypingArea grades only committed IME text with classifyWord (shared/lib/vietnamese-errors.ts)
│   └── profile/             # profile.module.ts, api/, components/ (AvatarUpload, ProfileEditForm, SecuritySettings), pages/
├── shared/
│   ├── api/                 # http.ts (axios), query-client.ts, api-error.ts, types.ts (Paginated<T>)
│   ├── components/          # page-header, empty-state, error-state, loading-state, confirm-dialog,
│   │   │                    # form-field, pagination
│   │   ├── data-table/      # DataTable, SearchInput, FilterSelect, TableToolbar (list and admin pages)
│   │   ├── layout/          # AppLayout (BrandHeader with the navigation, BrandFooter, module widgets), AdminLayout (sidebar + BrandFooter, /admin)
│   │   └── ui/              # shadcn/ui primitives (button, input, dialog, switch, ...)
│   ├── hooks/               # use-debounce, use-pagination
│   └── lib/                 # utils.ts (cn(), theme helpers), vietnamese-errors.ts (classifyWord, tagWord: per-word error types; pure TS so it can be copied to the BE)
└── test/                    # setup.ts, render-with-providers.tsx
```

### Module vs Shared — where does code go?

| Put it in a `module/` when... | Put it in `shared/` when... |
|-------------------------------|------------------------------|
| Logic belongs to one feature | Reused across ≥2 features |
| Page, feature component, feature API call or hook | Generic UI (button, empty state, pagination) |
| Feature-specific types | Axios/query client, `cn()`, generic hooks |

**Rule**: default to the feature module. Promote to `shared/` only when a second module needs it.

## Naming Conventions

- Folders & non-component files: `kebab-case` — `notes.api.ts`, `use-notes.ts`, `note.types.ts`, `form-field.tsx`.
- Feature components & pages: `PascalCase.tsx` — `NoteFormDialog.tsx`, `NotesListPage.tsx`.
- Exports: named (not default). (`App` is the one default export.)
- API modules: one object — `export const notesApi = { list, get, create, update, remove }`.
- Module descriptor: `export const notesModule: AppModule` in `<feature>.module.ts`.

## Path Aliases

Use `@/` for all `src`-relative imports. Relative imports are fine inside one module (`../hooks/use-notes`).

## Core Patterns

### 1. HTTP layer (`shared/api/http.ts`)
One shared Axios instance. **Never call `axios` directly** or hardcode base URLs.
- Base URL from `import.meta.env.VITE_API_BASE_URL` (typed in `src/vite-env.d.ts`, fallback `http://localhost:5003/api`).
- Request interceptor adds `Authorization: Bearer <token>` from `tokenStore`.
- Response interceptor on `401` clears the token and redirects to `/logout`.

### 2. Feature API modules (`modules/<f>/api/<f>.api.ts`)
Typed functions that **return the response body**:

```ts
export const notesApi = {
  list: (params: NoteListParams = {}) => http.get<Paginated<Note>>('/notes', { params }).then((r) => r.data),
  create: (input: NoteInput) => http.post<Note>('/notes', input).then((r) => r.data),
};
```

### 3. Server state (`modules/<f>/hooks/use-<f>.ts`)
All reads and writes go through TanStack Query hooks — never `useEffect` + `useState` for fetching.

```ts
export const noteKeys = { all: ['notes'] as const, list: (p: NoteListParams) => [...noteKeys.all, 'list', p] as const };
export const useNotes = (params: NoteListParams) =>
  useQuery({ queryKey: noteKeys.list(params), queryFn: () => notesApi.list(params), placeholderData: keepPreviousData });
export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: notesApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }) });
};
```

`shared/api/query-client.ts` sets the defaults: 4xx are never retried, other failures once, and **a mutation without its own `onError` shows the backend message as a toast**. Add `onError` only for custom behaviour (e.g. rolling back an optimistic update, see `SecuritySettings.tsx`).

### 4. Current user (`modules/auth/hooks/use-current-user.ts`)
- `useCurrentUser()` — the signed-in user, fetched once and shared (`currentUserKey = ['me']`).
- `useSetCurrentUser()` — store a user returned by a mutation; or invalidate `currentUserKey`.
- `useLogout()` — clears token and cache, opens `/login` (the `/logout` route does the same).
A 401 from any request redirects to `/logout` (http interceptor), so cached data of one user never carries over to the next. Other failures (server down) keep the user signed in.

### 5. Auth token (`modules/auth/store/token.store.ts`)
JWT in `localStorage` behind `tokenStore` (`get/set/clear`). Never touch `localStorage` for auth directly.

### 6. Routing and navigation (`app/modules.ts`)
Feature pages are registered, not hand-written in `App.tsx`:

```ts
// modules/notes/notes.module.ts
export const notesModule: AppModule = {
  routes: [{ path: '/notes', Component: NotesListPage }],
  navItems: [{ to: '/notes', label: 'Notes', icon: StickyNote }],
};
// app/modules.ts
export const appModules: AppModule[] = [homeModule, notesModule, profileModule];
```

Every registered route renders inside `ProtectedRoute` + `AppLayout`. A module may also add:
- `adminRoutes` (paths under `/admin`) and `adminNavItems`: rendered inside `AdminLayout` (sidebar). **Admins only:** `AdminLayout` is wrapped in `<ProtectedRoute roles={['admin']}>` in `App.tsx` and the API uses `requireRole('admin')` in `BE/src/routes/admin.route.ts`.
- `widgets`: components rendered on every page of `AppLayout`, for floating UI such as the chat button (`chatModule.widgets = [ChatWidget]`). A widget positions itself (`fixed bottom-8 left-1/2 -translate-x-1/2 ...`) and keeps its own state. Add `roles: ['admin']` to a route or nav item to restrict it; `ProtectedRoute roles` sends other users to `/`. Public auth pages (`/login`, `/register`, `/forgot-password`) live in `App.tsx` under `AuthLayout`. Page number lives in the URL via `usePagination()` (`?page=2`).

### 7. Forms (React Hook Form + Zod + `FormField`)

```tsx
const schema = z.object({ title: z.string().trim().min(1, 'Title is required').max(120) });
const { register, handleSubmit, formState: { errors } } =
  useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues });

<FormField id="note-title" label="Title" error={errors.title?.message}>
  <Input id="note-title" {...register('title')} />
</FormField>
```
- Mirror backend validation (the backend re-validates; FE validation is UX).
- Strip empty optional strings to `undefined` before submit (see `ProfileEditForm.tsx`).
- Disable the submit button with `mutation.isPending`. Use `useWatch` (not `watch`) to read live values.

### 8. Page states
Every data page handles all states with the shared components:

```tsx
if (query.isPending) return <LoadingState />;
if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
if (query.data.items.length === 0) return <EmptyState title="No notes yet" action={...} />;
```
Use `PageHeader` for the title row, `Pagination` under lists, `ConfirmDialog` before deleting, `useDebounce` for search boxes.

### 9. Tables and admin pages
`DataTable` takes a column config (`{ id, header, cell, sortKey? }`), rows and `getRowId`. Sorting is done by the backend: pass `sort` + `onSortChange` (headers cycle `field` → `-field`). Pass `selectedIds` + `onSelectedIdsChange` for checkboxes and bulk actions; `isRowSelectable` disables rows. Put `SearchInput` (debounced) and `FilterSelect` (`''` = all) in a `TableToolbar`. `useListParams({ sort })` keeps `q`, filters, `sort` and `page` in the URL and resets the page when a filter changes. `AdminUsersPage` shows all of it together.

### 10. UI, styling, notifications
- shadcn/ui primitives in `shared/components/ui/` — reuse them; compose classes with `cn()`.
- Tailwind theme tokens (`bg-background`, `text-muted-foreground`, `text-destructive`, ...) — no raw colors, so dark mode works.
- `toast.success` / `toast.error` from `sonner`; `<Toaster />` is mounted once in `main.tsx`.

## Testing

- Tests sit next to the code: `*.test.ts(x)`.
- Mock the feature's api module with `vi.mock('../api/notes.api', ...)`, then render with
  `renderWithProviders(<Page />, { route: '/notes', otherRoutes: { '/login': 'login page' } })` from `src/test/render-with-providers.tsx`
  (fresh QueryClient without retries + MemoryRouter).
- Assert what the user sees (`findByText`, `getByRole`), not implementation details. See `NotesListPage.test.tsx`.

## Playbook: Add a New Feature Module

1. `npm run gen:module -- <name>` from the repository root (copies `notes`, registers it). Or copy `modules/notes/` by hand.
2. **Types** — `types/<name>.types.ts`.
3. **API** — `api/<plural>.api.ts`, returning response bodies.
4. **Hooks** — key factory + `useQuery` / `useMutation` with invalidation.
5. **Components/Pages** — reuse shared components; all page states handled.
6. **Register** — `<plural>.module.ts` + one entry in `app/modules.ts`.
7. **Tests** — page test with mocked api.
8. **Verify** — `npm run lint`, `npm test`, `npm run build`.

## Do / Don't

- ✅ Organize by feature module; register pages in `app/modules.ts`.
- ✅ Fetch and mutate only through TanStack Query hooks and the feature `api` object.
- ✅ Use `useCurrentUser()` for the signed-in user.
- ✅ Validate forms with Zod and lay them out with `FormField`.
- ✅ Handle loading, error and empty states with the shared components.
- ❌ Don't call `axios` directly, hardcode API URLs, or fetch in `useEffect`.
- ❌ Don't add feature routes to `App.tsx` by hand.
- ❌ Don't read/write the auth token outside `tokenStore`.
- ❌ Don't hardcode hex colors — use theme tokens.
- ❌ Don't put feature code in `shared/`.

## Design

Every page uses the TypeTrace look of the login pages: `BrandHeader` and `BrandFooter` (`AppLayout` and `AdminLayout` include them), the blood-red palette defined once in `src/index.css` (dark: near-black red page, maroon cards, red accents; light: white with a red `primary`), and square corners. New features get this for free by using theme tokens (`bg-card`, `text-primary`, `bg-destructive`, ...). Never add other accent colors or raw hex values in components. A page that wants the translucent red glass card (login, register, typing) puts `redGlassTheme` on its wrapper and `redGlassCard` on the wrapper of the card (`src/shared/lib/red-glass-theme.ts`).
