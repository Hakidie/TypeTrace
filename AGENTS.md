# AGENTS.md

Instructions for AI coding agents (Antigravity, Claude Code, Codex, Cursor, ...) working in this repository.
Read this whole file before changing code. Details and examples: [BE/docs/architecture.md](BE/docs/architecture.md)
and [FE/docs/architecture.md](FE/docs/architecture.md). When this file and your habits disagree, follow this file.

## Golden rules

1. **This is a base project for students.** Keep code simple and readable. Copy the existing patterns
   (`notes`, admin users page, chat) instead of inventing new architecture, libraries or folder layouts.
2. **Reuse before you write.** Use the shared helpers listed below (`validate`, `paginate`, `AppError`, `DataTable`,
   `FormField`, query hooks, ...). Do not add a dependency when the project already has a tool for the job.
3. **Register, don't wire by hand.** Backend routers are mounted in `BE/src/app.ts`; frontend features are registered
   in `FE/src/app/modules.ts` (routes, nav links, admin pages, widgets). Never add feature routes to `FE/src/App.tsx`.
4. **Never leak private data.** No passwords, OTP/reset fields or API keys in responses, logs or frontend code. Never
   show a user's email to other users: show their display name, or a neutral name without one (`publicOwnerName` in
   `BE/src/models/passage.model.ts`).
5. **Do not change the OTP functions**: `BE/src/utils/otp.ts`, `createUserWithOtp`, `issueOtpForUser`, `issueResetToken`,
   and the OTP/reset handlers in `BE/src/controllers/auth.controller.ts`.
6. **Every change has tests**, and you finish only when `npm test`, `npm run lint` and `npm run build` pass from the root.
   Never weaken or delete tests to make them pass.
7. **Keep the docs true.** If you change a rule, a shared helper or a convention, update this file and the matching
   `docs/architecture.md` in the same change.

## Project

A MERN starter for students. Two apps in one repository, each with its own `package.json`:

- `BE/` — Express 5 + TypeScript + MongoDB (Mongoose 9) + Zod 4. JWT auth with optional email OTP.
- `FE/` — React 19 + Vite + TypeScript + TanStack Query 5 + React Hook Form + Zod + shadcn/ui + Tailwind CSS 4.

## Commands (run from the repository root)

| Command | What it does |
|---|---|
| `npm run setup` | Install all dependencies, create `BE/.env` and `FE/.env` from the examples |
| `docker compose up -d` | Start a local MongoDB on port 27017 |
| `npm run seed` | Demo accounts `demo@example.com / demo1234`, `admin@example.com / admin1234`, 12 students `student01..12@example.com / student1234` |
| `npm run import:words` | Add the starter word list (`BE/src/data/words.ts`) to the word bank with error tags; safe to run many times |
| `npm run import:passages` | Add the starter passages (`BE/src/data/passages.ts`, source recorded, owner TypeTrace) to the passage bank as published passages; safe to run many times |
| `npm run import:themes` | Add the starter themes (`BE/src/data/themes.ts`, owner TypeTrace) as published themes; safe to run many times |
| `npm run rebuild:progress` | Rebuild every learner's days (`DailyProgress`: streak, daily mission, profile heatmap) from their counted sessions, in each learner's own time zone. Run it once after deploying SCRUM-31 (older sessions have no day yet) and after changing `DAILY_MISSION_SESSIONS`, while nobody is typing; safe to run many times |
| `npm run dev` | Run backend (http://localhost:5003) and frontend (http://localhost:5173) together |
| `npm test` | Run backend and frontend tests |
| `npm run lint` | Lint the frontend |
| `npm run build` | Typecheck and build both apps |
| `npm run gen:module -- <name>` | Scaffold a new feature (BE + FE + tests) from the `notes` module |
| `npm run gen:module -- <name> --remove` | Delete a generated feature again |

Optional services: without SMTP, emails (OTP and reset codes) are printed in the backend terminal in development and
answer 503 in production; without Cloudinary, image upload answers 503; without `GEMINI_API_KEY`, the AI chat answers 503; without `GOOGLE_CLIENT_ID` (BE) / `VITE_GOOGLE_CLIENT_ID` (FE), "Login with Google" answers 503 and its button is hidden.
Everything else keeps working. `npm run seed` refuses `NODE_ENV=production`. Behind a proxy set `TRUST_PROXY=1`.
Tests never read `BE/.env`: their variables are in `BE/vitest.config.mts`.

## Adding a feature (follow these steps in order)

1. Run `npm run gen:module -- <singular-kebab-name>` (e.g. `product`, `lesson-plan`). It copies the `notes` module,
   renames everything and registers it. It refuses names that clash with existing code (`class`, `page`, `query`,
   names containing `note`, `admin`, `chat`, ...): pick another name.
2. Change the fields. Keep these files in sync:
   - `BE/src/models/<name>.model.ts` — Mongoose schema and `<Name>Document` interface
   - `BE/src/validators/<name>.validator.ts` — Zod schemas for create / update / list query
   - `FE/src/modules/<plural>/types/<name>.types.ts` — TypeScript types
   - `FE/src/modules/<plural>/components/<Name>FormDialog.tsx` — form schema and inputs
   - `FE/src/modules/<plural>/components/<Name>Card.tsx` — how one item is displayed
3. Update the generated tests (`BE/tests/integration/<plural>.test.ts`, `FE/src/modules/<plural>/pages/*.test.tsx`).
4. Optional: add an admin page for it (see "Admin area").
5. Run `npm test`, `npm run lint` and `npm run build`. All must pass.

Reference for anything not covered here: `BE/src/{models,validators,services,controllers,routes}/note.*` and `FE/src/modules/notes/`.

## Backend rules

- Layers: `routes → middlewares → controllers → services → models`. Controllers stay thin; queries and rules live in services.
- Validate every input with `validate({ body, query, params })` (`middlewares/validate.middleware.ts`). Reuse
  `idParamsSchema`, `booleanQuerySchema`, `optionalBooleanQuerySchema`, `bulkIdsSchema` (`validators/common.validator.ts`).
- List endpoints: extend `paginationQuerySchema` with `sort: sortSchema([...allowed fields])` and return
  `paginate(Model, filter, query)` (`utils/pagination.ts`) → `{ items, page, limit, total, totalPages }`.
  Never allow sorting by private fields. Escape user text before building a `RegExp`. An optional fourth argument
  `{ select, collation }` sends only some fields (when `toJSON` keeps one this user may not see) and sorts text in a
  language's order (`{ locale: 'vi' }`; add an index with the same collation, or MongoDB reads the whole collection;
  the count uses the collation too).
- Expected failures: `throw notFound('...')`, `badRequest`, `forbidden`, `conflict`, or `new AppError(status, message)`
  (`utils/app-error.ts`). Never send error responses by hand; never wrap handlers in try/catch (Express 5 forwards rejections).
- Protected routes: `authGuard`. Role checks: `requireRole('admin')` (also sets `req.user.role`).
- Ownership: filter queries by `owner: actor.id`; another user's resource answers 404, as in `note.service.ts`.
- Image uploads: `imageUpload.single('<field>')` (`middlewares/upload.middleware.ts`) + `uploadImage()` (`services/cloudinary.service.ts`).
- Configuration: add variables to the Zod schema in `config/env.ts` and to `BE/.env.example`. Never read `process.env` elsewhere.
- The User model strips private fields in `toJSON`; keep it that way for new private fields. `.lean()` and `aggregate()`
  skip `toJSON`: with them, `.select()` the public fields explicitly.
- A learner's days (streak, daily mission, profile heatmap) are calendar days in their `settings.timezone` (`DEFAULT_TIMEZONE`
  when it is missing or unknown): cut them with `localDateKey(date, zone)` and count them with `addDays` (`utils/local-date.ts`),
  never with `toISOString().slice(0, 10)`. They live in `DailyProgress`, which only `completeSession` writes, through
  `recordCountedSession`. The mission goal is `DAILY_MISSION_SESSIONS` (`services/daily-progress.service.ts`), sent to the
  frontend as `missionGoal`. The admin user list keeps its own UTC days from `TypingSession`.
- A learner's daily tasks (SCRUM-112) live in `UserDailyTasks` (`models/user-daily-tasks.model.ts`): one document per learner
  and local day, made by the day's first `GET /api/profile/daily-tasks` or counted session, with a snapshot of `dailyTaskCount`
  active `DailyTask` templates (weak error types first) and the numbers of the sessions already counted that day, cut in the
  zone it keeps as `timeZone`. It is stored once (an upsert with `$setOnInsert`) and its `tasks` are never edited afterwards:
  template edits and a new count apply from the next day. After that upsert, its `progress` is written only by
  `updateDayNumbers` (`services/user-daily-tasks.service.ts`), which works the day's numbers out again from its counted
  sessions: with `$max` after each counted session (`completeSession`, through `recordDailyTaskProgress`), so recording a
  session twice changes nothing, and replaced once, with the new `timeZone`, by the day's next counted session or `GET`
  after the learner's zone changed.
- App-wide settings that admins change live in the one `AppSetting` document (`models/app-setting.model.ts`, SCRUM-210):
  read them with `getAppSettings()` (the model's defaults until an admin saves) and save them with `updateAppSettings(changes)`
  (`services/app-setting.service.ts`). A new setting is a new field there, with its default, not a new collection.

## Frontend rules

- One folder per feature in `FE/src/modules/<feature>/` with `api/ hooks/ components/ pages/ types/` and a
  `<feature>.module.ts` describing what it adds: `routes` + `navItems` (main app), `adminRoutes` + `adminNavItems`
  (admin area), `widgets` (components on every app page: floating UI, or one that draws nothing and keeps something in step, like `TimezoneSync`, which sends the browser's time zone), a `navItems` entry `{ Component }` instead of a link puts a component in the top navigation (the chat button). Register it in `FE/src/app/modules.ts`.
- HTTP only through the `http` instance (`shared/api/http.ts`). API functions return the response body: `http.get<T>(url).then((r) => r.data)`.
- Server data only through TanStack Query hooks in `hooks/use-<feature>.ts` (see `modules/notes/hooks/use-notes.ts`):
  a key factory, `useQuery` for reads, `useMutation` + `invalidateQueries` for writes. No `useEffect` + `useState` fetching.
- The signed-in user: `useCurrentUser()`; after changing it, `useSetCurrentUser()` or invalidate `currentUserKey`.
- Mutations without `onError` show the backend message as a toast automatically. Add `onError` only for custom handling.
- Forms: React Hook Form + `zodResolver`, laid out with `FormField` (`shared/components/form-field.tsx`). Mirror the backend schema.
- Every data view handles loading, error and empty states (`LoadingState`, `ErrorState`, `EmptyState`).
- Reuse shared UI before writing new: `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog` (`children` for an extra field such as a reason, `confirmDisabled` until it is filled, `cancelLabel` to rename Cancel), `Pagination`,
  `StatCard`, `Panel`, `ListRow` + `ListRowMenu` + `ListRowStat` (a two-tier red list item with slots, see `UserRow`; icon buttons instead of the kebab menu: `PassageCard`), `ActivityHeatmap` (always one tooltip for the hovered day; a learner's own days: `timeZone`, `unit`, `legend`, see `ProfileHeatmap`), `ListToolbar` (an optional `title` island, search + Sort and Filter menu buttons + actions above a list) (`shared/components/`), `DataTable`, `SearchInput`, `FilterSelect`, `TableToolbar` (`shared/components/data-table`),
  shadcn primitives (`shared/components/ui/`), hooks `useDebounce`, `usePagination`, `useListParams`, `useFitLines` (`shared/hooks/`),
  date helpers in `shared/lib/local-date.ts` (a learner's today is `dateKeyIn(new Date(), timezone)`, never `toISOString()`).
  The daily mission goal is the backend's `missionGoal`: never write the number in the frontend.
- Design: the TypeTrace look of the login pages applies to every page, now and for new features. Header and footer are
  `BrandHeader` / `BrandFooter` (`shared/components/layout/`; `AppLayout` already uses them, so pages
  inside them get both). Colors are only the theme tokens in `FE/src/index.css` (Blood red dark palette and Sand light palette, built from 4 theme colors; users can choose their own themes): do
  not add purple, blue or other accents. A page that wants the red glass card (login, typing) uses `redGlassTheme` and
  `redGlassCard` from `shared/lib/red-glass-theme.ts`. Square corners (radius 0), no per-page color schemes.
- Menus: every dropdown menu (`shared/components/ui/dropdown-menu.tsx`) has the `Panel` look: see-through page background with blur, panel border with the soft red hover, muted option text that turns red on a light red tint while hovered.
- Styling: Tailwind theme tokens (`bg-background`, `text-muted-foreground`, ...), never raw hex colors. Layouts must work on phones.
- Imports use the `@/` alias. Components and pages are `PascalCase.tsx` named exports; other files are `kebab-case.ts`.

## Admin area

`/admin` has its own sidebar layout (`FE/src/shared/components/layout/AdminLayout.tsx`): no BrandHeader/BrandFooter, the sidebar (`AdminSidebar.tsx`) has the logo on top and the user + Logout at the bottom. The reference admin page is user
management: `FE/src/modules/admin/pages/AdminUsersPage.tsx` (a `ListToolbar` with search, sort and filters, a list of `UserRow` cards with an edit/delete kebab menu,
pagination, edit dialog, delete with confirmation) backed by `BE/src/routes/admin.route.ts`. For a review queue with
cards chosen by a click and bulk decisions, see the Pending review panel under the Passages panel of `FE/src/modules/passages/pages/AdminPassagesPage.tsx`
(`PendingPassagesPanel`: learners ask for their own passages to become public, admins approve them or turn them down with a
reason, which makes them `rejected`, SCRUM-176). Two lists on one page keep their URL params apart with `useListParams({ sort, prefix })`.

**Access: admins only.** The lock is one line on each side: `requireRole('admin')` in `BE/src/routes/admin.route.ts`
(others get 403) and `<ProtectedRoute roles={['admin']}>` around `AdminLayout` in `FE/src/App.tsx` (others are sent to `/`).
The "Admin" item in the avatar menu (`UserMenu`, top right of the main app) is also admins only. After login or registration, admins land on `/admin`; everyone else on `/typing` in Practice mode (`afterLoginPathFor` in
`FE/src/modules/auth/utils/home-path.ts`); `/` also opens `/typing`. A learner who has just created an account (registration, or a first Google login: `useFinishLogin(token, { newAccount: true })`) lands there with the history state `AfterLoginState`, and the Typing page asks once to take the placement test (SCRUM-157). The placement test is the Placement tab on the Typing page (a confirm modal first). Make the first
admin with `npm run seed` (`admin@example.com`) or by setting `role: 'admin'` in the database. Keep the server-side checks that stop
an account from deleting itself or removing its own admin role.

To add an admin page for a feature module:

1. Backend: endpoints under `/api/admin/...` in `admin.route.ts`. Lists use `validate({ query })` with `sortSchema`,
   `optionalBooleanQuerySchema` for yes/no filters, and `paginate`. Bulk actions take `bulkIdsSchema` (`{ ids }`).
2. Frontend: in the module's `<feature>.module.ts` add `adminRoutes: [{ path: '/admin/<plural>', Component }]` and
   `adminNavItems: [{ to: '/admin/<plural>', label, icon }]`. Build the page like `AdminUsersPage`: a `ListToolbar` (search, sort, filters),
   a list of `ListRow` cards (or a `DataTable` with column config for plain tables), `Pagination` (`variant="toolbar"` = right-aligned, styled like the `ListToolbar` buttons; `accent` = red text on transparent buttons), `ConfirmDialog`, and `useListParams`
   to keep search, filters, sort and page in the URL.

## AI chat bot (Google Gemini, free tier)

A sample chat bot to customize, not a finished product:

- UI: a tab in the top navigation (before Settings) opens a chat popup under the header, on the right (`FE/src/modules/chat/components/ChatWidget.tsx`),
  registered as a nav widget in `chat.module.ts`. It has no page of its own. Texts and suggested questions: `chat.config.ts`;
  conversation state: `hooks/use-chat.ts`.
- Backend: `POST /api/chat` with `{ messages: [{ role: 'user' | 'model', text }] }` → `{ reply }`. Stateless: the client sends
  the conversation each time. Signed-in users only, 10 messages per minute per user.
- Personality: `BE/src/config/chatbot.ts` (system prompt, thinking level, history length; Gemini 3.5 ignores temperature).
  Gemini calls: `BE/src/services/ai.service.ts` with `@google/genai` (never the deprecated `@google/generative-ai`).
- Config: `GEMINI_API_KEY` (free at https://aistudio.google.com/apikey) and `GEMINI_MODEL` (default `gemini-3.5-flash-lite`,
  thinking level `LOW`) in `BE/.env`. Quota errors answer 429. Never put the key in frontend code.

## Testing rules

- Backend integration tests use `api()` from `BE/tests/helpers/api.ts` (not `request(app)`), `createUser` / `bearerFor`
  from `tests/helpers/user-factory.ts`, and an in-memory MongoDB. External services are mocked in
  `tests/setup/mock-external-services.ts`; inspect them with `email-outbox.ts`, `cloudinary-recorder.ts`, `gemini-recorder.ts`.
- Frontend tests mock the feature's `api` module and render with `renderWithProviders` from `FE/src/test/render-with-providers.tsx` (`state` for the history state of the starting URL, `otherRoutes` with an element instead of a text to read the location after a redirect).
  Assert what the user sees (`getByRole`, `findByText`).
- Days and time zones: fix the clock by faking `Date` only (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`,
  then `vi.useRealTimers()` in `afterEach`), so HTTP, MongoDB and React Query keep their real timers and no test runs across
  a midnight (see `BE/tests/integration/profile-streak.test.ts`).

## Before you finish

Run `npm test`, `npm run lint` and `npm run build` from the root and fix every failure. Update the docs if a rule or a
shared helper changed (golden rule 7). Mention any step you could not run.
