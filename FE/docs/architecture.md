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
├── main.tsx                 # QueryClientProvider + BrowserRouter + App + Toaster; applyStoredTheme()
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
│   ├── home/                # home.module.ts: `/` redirects to `/typing` (pages/HomeRedirect)
│   ├── notes/               # REFERENCE MODULE: api/, hooks/, components/, pages/, types/, notes.module.ts
│   ├── passages/            # admin passage bank (/admin/passages): passages.module.ts, api/passages.api.ts (GET/POST /api/admin/passages, backend is SCRUM-90), hooks/use-passages.ts, components/ (PassageForm, PassageCard), pages/AdminPassagesPage with three Panels one under the other, no tabs: "New passage" (the form, which turns into "Edit passage" when Edit is clicked on a card), "Passages" (a 3-column card grid of the public passages only, TypeTrace's and the approved ones: `visibility: 'public'`, so a learner's private passage, waiting or turned down, never shows up there as published) and "Pending review" (SCRUM-176, `PendingPassagesPanel`: learners' requests to make a passage public as the same `PassageCard`s in review mode (a box to tick it, "by <author> · <source> · asked <day>", View, Approve and Reject chips), oldest first, 9 per page, with a `ListToolbar` (search in title and source, sort, "n waiting", a Select all box and Approve n / Reject n for the ticked cards) whose search, sort and page stay in the URL apart from the bank's through `useListParams({ sort: 'updatedAt', prefix: 'pending' })` (`?pending-q=&pending-sort=&pending-page=`); View opens `PassageViewDialog` with the whole text and its source; Approve / Reject on a card, from the view dialog, or for the ticked cards at once, always through `ReviewDialog`: a `ConfirmDialog` whose Reject needs a reason (at most 300 characters, the learner sees it, and the passage becomes `rejected`: still private, never published); `useReviewPassages` calls `PATCH /api/admin/passages/:id/approve|reject` for one passage and `POST /api/admin/passages/bulk-approve|bulk-reject` for several, and says when some were no longer waiting; after a decision, also a failed one, the queue is asked for again and the ticks are cleared, and a 409 or 404 (decided elsewhere, withdrawn, deleted) closes the dialog; the queue comes from `usePendingPassages`, asked again every minute (`REVIEW_QUEUE_REFRESH_MS`) and when the admin comes back to the browser tab). Learner side (SCRUM-34), the "Passages" nav link /passages: pages/PassagesPage has a "New passage" Panel (`OwnPassageForm`: Title and Source side by side above the pasted text, all three required and cleaned like the backend does before they are checked (title at most 120 characters, source at most 300, text of at least 20 words and at most 5000 characters), "Your passages: n/20" and Add passage off at 20), which turns into "Edit passage" (scrolled into view) when Edit is clicked on a row, like the admin passages page: the passage is loaded with its text by `useOwnPassage` (`GET /api/passages/:id`), saved with Update passage (`PATCH /api/passages/:id`), and Cancel, the update, deleting it or sending it for review go back to New passage and a "My passages" Panel listing only the learner's own passages (`mine: true`: private, waiting for review, turned down or approved; TypeTrace's passages are in the passage menu of the Typing page) (a `ListToolbar` with title search, sort and a Visibility filter Private / Public kept in the URL by `useListParams`, one `PassageRow` per passage, in the look of the admin users list (a `ListRow`: a 61px tile, the title and the source on the left, `WORDS` with `ListRowStat` and the icon buttons on the right, the state tag, the reason of a refusal and the day it was added below), 10 per page with the toolbar `Pagination` at the bottom right; the actions are icon buttons (name in `aria-label`, hint in `title`): Practice, a link to `/typing?passage=<id>`, and on own private passages Edit (not while it waits for review) and Delete with confirmation; own passages show a state tag (Private, Pending review, Rejected with the reason, Public) and, SCRUM-176, "Request public" (after a confirmation that says which author name everyone will see: the display name, else `ANONYMOUS_OWNER_NAME` of `passages.config.ts`, never the email; `POST /api/passages/:id/publish-request`) or, while it waits, "Withdraw request" (`DELETE` on the same path); an own passage an admin made public can no longer be deleted or changed; pagination; a page past the end, e.g. after deleting its last passage, goes back to the last page); data from api/learner-passages.api.ts and hooks/use-learner-passages.ts (`GET/POST/DELETE /api/passages`; a change also refreshes the passage menu of the Typing page); `passages.config.ts` has the limits (same as the backend) and `countWords`; `lib/passage-text.ts` is a copy of the backend's `cleanPassageText` (keep the two the same), so `OwnPassageForm` checks, counts and sends the text as it will be saved
│   ├── settings/            # /settings (SettingsPage: Light/Dark mode tabs, the themes of the mode in use in one grid (the built-in palette, TypeTrace themes, then the user's own), a "+ Custom theme" last card that turns into a live editor `ThemeEditor`, Edit and Delete buttons on hover for the user's own themes only (delete asks for confirmation); data from `hooks/use-themes.ts`: `GET/POST/PATCH/DELETE /api/themes`, `GET/PATCH /api/themes/active`) and /admin/settings (AdminSettingsPage: mode tabs and the compact sidebar); `lib/theme-rules.ts` has the rules a theme must meet (same as `BE/src/utils/theme-colors.ts`: keep them in sync); `hooks/use-theme-mode.ts` has `useThemeMode` (Light/Dark, used by the user menu, the header toggle and the tabs) and `useThemeSync` (mounted by `AppLayout` and `AdminLayout`: applies the signed-in user's mode and chosen theme)
│   ├── typing/              # /typing (TypingPage, TypingArea; the Placement tab asks for confirmation in a modal first, then opens `?mode=placement`) and /typing/result/:id: a session is started when the page opens (no start button; `?mode=placement` types the placement passage), the passage name is a menu (`usePassageOptions`, the first 100 of `GET /api/passages?mode=` by title) to pick a specific passage (`?passage=<id>`, the Practice link of the Passages page, picks one before the page opens; it is then taken out of the URL, so a reload does not go back to it), the Random button goes back to a random one, and Restart / time up keep the pick (switching the mode resets it to Random, also on the way back to the mode it was picked in); the timer starts at the first key (`PATCH /api/sessions/:id/begin`) and a session ends at 3:00 (`SESSION_TIME_LIMIT_SECONDS`), sending the words finished so far (nothing finished = a new session starts) and the backend grades it (/api/sessions); the page uses the login/register look (`shared/lib/red-glass-theme.ts`, also used by `AuthLayout`) and shows only the passage: an invisible textarea sits over it and the typed text appears in the passage (grey = not reached, white = typed or right, red = wrong word after the space); TypingArea grades only committed IME text with classifyWord (shared/lib/vietnamese-errors.ts)
│   └── profile/             # profile.module.ts, api/, components/ (AvatarUpload, ProfileEditForm, SecuritySettings), pages/
├── shared/
│   ├── api/                 # http.ts (axios), query-client.ts, api-error.ts, types.ts (Paginated<T>)
│   ├── components/          # panel, page-header, empty-state, error-state, loading-state, confirm-dialog,
│   │   │                    # form-field, pagination
│   │   ├── data-table/      # DataTable, SearchInput, FilterSelect, TableToolbar (list and admin pages)
│   │   ├── layout/          # AppLayout (BrandHeader with the navigation and the avatar `UserMenu` with Theme and Logout, BrandFooter, module widgets), AdminLayout (AdminSidebar with its own logo header and Logout footer, no BrandHeader/BrandFooter, /admin)
│   │   └── ui/              # shadcn/ui primitives (button, input, dialog, switch, ...)
│   ├── hooks/               # use-debounce, use-pagination
│   └── lib/                 # utils.ts (cn()), theme.ts (the 4 theme colors, the Blood red and Sand fallbacks, paint/apply/remember the theme in `localStorage`), vietnamese-errors.ts (classifyWord, tagWord: per-word error types; pure TS so it can be copied to the BE)
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
- `useFinishLogin()` — stores the token after any login (password, emailed code, Google) and opens `afterLoginPathFor(role)`
  (`utils/home-path.ts`): `/admin` for admins, `/typing` (Practice) for everyone else. The register page
  signs the new account in itself once its email code is verified, so registering lands there too. `GuestRoute` sends a
  user who is already signed in when a login/register page opens to `homePathFor(role)` (`/admin` or `/`, which opens `/typing`). It ignores a
  login made on the page: redirecting from there too would race `useFinishLogin`'s navigation and win.
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
Use `Panel` (title, description, actions) for every block of content in a page, `PageHeader` for the title row of a non-admin page (admin pages get their title from `AdminLayout`), `Pagination` under lists, `ConfirmDialog` before deleting (its `children` go between the description and the buttons, e.g. a field for a reason, and `confirmDisabled` keeps the confirm button off until it is filled, see `ReviewDialog`), `useDebounce` for search boxes.
A list of people or items in the red card look uses `ListRow` (slots `identity`, `center` (wide, `xl` up), `extra` (narrow, right), `action` (far right, as wide as its content), `tags`, `meta`) with `ListRowMenu` for the kebab button, `ListRowStat` for a label over a big value in `extra` (`WPM` over `64`) and `ActivityHeatmap` for a 52-week activity grid in four blocks; `modules/admin/components/UserRow.tsx` is the reference, and `modules/passages/components/PassageRow.tsx` puts a few icon buttons in `action` instead of the kebab menu.

`ListToolbar` (`shared/components/list-toolbar.tsx`) is the bar above such a list, all in one row: an optional `search` box that fills the row, and on the right a `summary` text (e.g. the total count, styled like the buttons), a **Sort** button (menu of the sorts the backend allows, current one checked) and a **Filter** button (menu with one group per filter, each with an "All" entry; the button shows how many filters are on). Sort and Filter turn red-orange (like the tag badges) while they hold a non-default choice; the first sort option counts as the default, plus an `actions` slot on the right. It only shows the controls and reports changes, so pair it with `useListParams`; `AdminUsersPage` is the reference. It is built from `SearchInput` and the dropdown menu.

### 9. Tables and admin pages
`DataTable` takes a column config (`{ id, header, cell, sortKey? }`), rows and `getRowId`. Sorting is done by the backend: pass `sort` + `onSortChange` (headers cycle `field` → `-field`). Pass `selectedIds` + `onSelectedIdsChange` for checkboxes and bulk actions; `isRowSelectable` disables rows. Put `SearchInput` (debounced) and `FilterSelect` (`''` = all) in a `TableToolbar`. `useListParams({ sort })` keeps `q`, filters, `sort` and `page` in the URL and resets the page when a filter changes; a second list on the same page passes a `prefix` to keep its own keys (`useListParams({ sort: 'updatedAt', prefix: 'pending' })` uses `pending-q`, `pending-sort`, `pending-page`, see `PendingPassagesPanel`). `AdminUsersPage` uses `ListToolbar` and `UserRow` cards instead of a table (the dashboard's recent users still use `DataTable`).

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

Every page uses the TypeTrace look of the login pages: `BrandHeader` and `BrandFooter` (`AppLayout` includes them; `AdminLayout` does not: its `AdminSidebar` has its own logo header and Logout footer), the palette defined once in `src/index.css` (dark = Blood red: near-black red page, maroon cards, red accents; light = Sand: warm paper with an orange `primary`; every theme is 4 colors, the other tokens are derived from them), and square corners. New features get this for free by using theme tokens (`bg-card`, `text-primary`, `bg-destructive`, ...). Never add other accent colors or raw hex values in components. A page that wants the translucent red glass card (login, register, typing) puts `redGlassTheme` on its wrapper and `redGlassCard` on the wrapper of the card (`src/shared/lib/red-glass-theme.ts`).

## Themes (SCRUM-163)
The look is 4 colors: `--theme-background`, `--theme-text`, `--theme-muted`, `--theme-accent` (`src/index.css` derives every other token from them). The app is always in one mode, Light or Dark (the `dark` class on `<html>`; there is no System mode). With no theme chosen a mode shows its built-in palette: Blood red (dark) or Sand (light). A chosen theme sets the 4 variables inline on `<html>`. The user has one chosen theme per mode (`GET/PATCH /api/themes/active`); `useThemeSync` applies it after login and the last applied colors are remembered in `localStorage` (`applyStoredTheme()` in `main.tsx`) so the first paint is right. Logout forgets the colors. The settings page only shows the themes of the mode in use, and switching the mode while the editor is open closes it. A new theme must fit the mode (dark or light background) and be readable (text 4.5, muted text 3, accent 3 contrast against the background); at most 9 own themes. Theme colors are raw hex because users choose them: this is the one exception to "no raw hex colors".

**Admin theme management** (`/admin/themes`, `modules/admin/pages/AdminThemesPage.tsx`): manages TypeTrace's own (published) themes through `/api/admin/themes`. Two panels: *New theme* / *Edit theme* (the settings `ThemeEditor` card plus a Mode button; the mode of an existing theme is locked) and *Themes* (the same `ThemeGrid` cards with a `ListToolbar` of search, sort and a Dark/Light filter, and 15 themes per page). Clicking Edit on a card switches the first panel to editing; saving or cancelling brings it back to a new theme. The editor's live preview does not repaint the admin's app. Changes refresh the learners' theme lists too (`themeKeys.all`).

**Unsaved theme draft** (`modules/settings/store/theme-draft.store.ts`): the theme being made or edited in Settings (name, colors, mode, new or the id being edited) lives in a small in-memory store, not in the editor, so it survives moving between pages (and between the app and `/admin`). While it exists `useThemeSync` paints its colors on every page (nothing is remembered in `localStorage` for it). Save, Cancel, changing the mode (`useThemeMode.setMode`) and logout (`useLogout`) clear it, as does a deleted theme being edited. It is lost on a page reload. The admin theme panel has no draft.
