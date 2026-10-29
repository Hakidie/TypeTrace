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
│   │                        # components/ (ChatWidget = navigation tab + popup, ChatPanel, ChatComposer)
│   ├── home/                # home.module.ts: `/` redirects to `/typing` (pages/HomeRedirect)
│   ├── notes/               # REFERENCE MODULE: api/, hooks/, components/, pages/, types/, notes.module.ts
│   ├── ranked/              # ranked duels (ranked duel design, phase 4): the Rank tab of the Typing page shows components/RankMode when `?mode=rank` (no typing session is started then); the room code is in the URL (`&room=CODE`) so a reload comes back to it, and in sessionStorage so the Rank tab comes back to it after a look at another tab. `ranked.module.ts` adds the Leaderboard page (`/leaderboard`, nav link) and the admin Seasons page (`/admin/seasons`, close a season with a confirmation); hooks/use-ranked.ts has `useRankedMe` (season rating and tier, shown in the Rank lobby, read again on each `result` event), `useLeaderboard`, `useSeasons`, `useCloseSeason`. The result screen shows each player's rating change, or why the match was not rated. api/ranked.api.ts: `rankedApi` (REST through `http`) and `openMatchStream` (the one `fetch` in the app: axios cannot read a stream; `Authorization` header, never a token in the URL; reconnects after 1 s, doubling the wait up to 30 s while it fails with 429/5xx, stops on any other 4xx), lib/sse.ts `parseEvents`; hooks/use-match.ts: `useMatch(code)` (the room in the TanStack cache, kept live by the stream events through `setQueryData`; `invite` for a rematch, `gone` when the room is no longer there) and the mutations. Components: RankLobby (Create room / join with a code), RoomLobby (code + copy, two PlayerCards, Ready / Not ready, Leave room), RaceView (RaceLanes with each avatar running by finished words, Countdown, then the shared `TypingArea` with `onProgress` sending each finished word and `onFinish` the last one with `done`), MatchResult (You win / You lose / Draw / You forfeited, win and lose poses, Rematch, the opponent's invitation, Back to lobby). Elo is not shown yet ("Rating comes soon")
│   ├── daily/               # daily challenge, the Daily tab of the Typing page (`?mode=daily`, like Rank and Rain: no practice session, no passage menu, no time tabs; no `daily.module.ts`): components/DailyMode (today's card and the board side by side, one column under `lg`; Start opens a try (`useStartTry`, a `daily` typing session) in the shared `TypingArea` for the challenge's 60 s, sent with `useCompleteSession`, then `dailyKeys.all` is asked again and DailyResult replaces the card; 404 → "No daily challenge today"), DailyCard (passage, preview, tries as three bars, best and rank, streak with the `fire-streak` Lottie, Start try N or "Come back tomorrow", time until the next one), DailyLeaderboard (compact one-line rows: rank (the `trophy` Lottie on the first), avatar head, name, score; the learner's row tinted with `aria-current`; yesterday's winner; "Be the first today"), DailyResult (score counting up with `useCountUp`, "New best, #4 → #3" and the `confetti` Lottie (a popper by the score) on a new best, WPM, accuracy, coins with the Coins icon popping in CSS (every coin Lottie embeds images, 130 KB or more) and "20 + streak N", "This try was too short to count", Try again (N left)); api/daily.api.ts, hooks/use-daily.ts (`useDailyToday`, `useDailyBoard`, `useStartTry`), types/daily.types.ts (`DAILY_TRIES`)
│   ├── rain/                # word rain minigame, the Rain tab of the Typing page (`?mode=rain`, like Rank: no typing session, no passage menu, no time tabs; no `rain.module.ts`, it has no route of its own): components/RainMode (start screen with Start / Enter, HUD with lives, score, time left and Pause / Escape, the typing box (a word counts only on space or Enter, never as soon as the letters match: a Vietnamese keyboard holds the word until a word break and would put it back in a box cleared earlier; an Enter that only confirms a composing keyboard's letters is skipped), pause and result screens with words and WPM, Play again; loading, error and "No words to rain yet" states) over RainStage; api/rain.api.ts + hooks/use-rain.ts `useRainWords` (`GET /api/rain/words`, asked again each time); hooks/use-rain-game.ts `useRainGame` (the reducer with a 100 ms clock that stops while paused or while the tab is hidden); lib/rain-game.ts `rainReducer` (pure rules: a 60 s round, 3 lives, lanes so words never overlap (a lane takes a new word once its newest one has fallen 30%), falling and spawning faster over the round, the target is the earliest falling word that starts with the input without the Vietnamese marks (Telex shows "tie" before "tiế") and only the exact word followed by space or Enter is a hit (a wrong word is cleared, letters after the space are kept), a long tick counts as 250 ms) and `targetOf`; components/RainStage draws what it is given (falling words, the avatar in the pose of `lib/rain-pose.ts` `rainPose(phase, reaction)`, sliding under the word being typed); a word falls with the `rain-fall` CSS animation (always on: it is the rule of the game; `onLand(id)` comes from its `animationend`, the stage is a size container and `paused` freezes the words and the sky) down to a dashed line over the avatar's head, a red bar grows at the foot of a word close to landing (`rain-heat`, also always on: it only changes a color), the word being typed is lifted and outlined (`aria-current`); decoration, skipped for reduced motion with the right final look: streaks falling behind the words (`rain-sky`), a typed word pops with a ring (`rain-pop`), a missed one is squashed (`rain-splat`) and the ground flashes (`rain-flash`), the avatar hops with its shadow (`rain-hop`, `rain-hop-shadow`) or shakes (`rain-shake`); no sprites of its own: it reuses the four avatar poses; types/rain.types.ts
│   ├── avatar/              # pixel avatar (ranked duel design, phase 2): avatar.module.ts (route /wardrobe, opened from the account menu and the profile page, no nav link), components/AvatarSprite (stacks one <img> per layer in a fixed-size frame, image-rendering: pixelated; `eager` loads the images at once instead of lazily and lib/preload.ts `preloadAvatar(look)` fetches every pose, for games that change the pose; crop="head" for the account menu; the effect layer moves with an `avatar-fx-*` class from index.css, a slow fade in place for reduced motion), lib/layers.ts (`layerFiles(look, pose)`: which files (the body is `{skin}-{face}-{pose}`, without the face for classic) of /avatar to stack, the same rule as minigame-sprites/build-layers.mjs), data/avatar-manifest.ts (generated by that script: layer order, poses, hair with a back layer, items), api/avatar.api.ts + hooks/use-avatar.ts (`GET /api/avatar/catalog`, `PUT /api/avatar`, which also updates the current user), pages/WardrobePage (preview in every pose on a sticky stage, coins, one tab per slot; a slot shows its styles (items named `{style}-{color}` grouped, plain colors as "Basic") and the colors of the style worn, hair cards without the hat; locked items show their price or tier/season reward, Save / Reset; an item for sale can be previewed and bought with "Buy … for N coins", `POST /api/avatar/buy`, and Save waits until the look holds only owned items). The images are static files in FE/public/avatar (served as /avatar/...), written by the script; the account menu and the profile header show the avatar when there is no uploaded picture
│   ├── passages/            # admin passage bank (/admin/passages): passages.module.ts, api/passages.api.ts (GET/POST /api/admin/passages, backend is SCRUM-90), hooks/use-passages.ts, components/ (PassageForm, PassageCard), pages/AdminPassagesPage with three Panels one under the other, no tabs (the form has an English passage switch, which turns Placement off: English passages are for ranked duels only; the Passages panel filters by Language, ?language=vi|en, and cards show an EN badge): "New passage" (the form, which turns into "Edit passage" when Edit is clicked on a card; in edit mode a Delete passage button deletes the passage for good, SCRUM-159), "Passages" (SCRUM-159: a `ListToolbar` with a search in title and source (accents optional), sort (Newest by default, Oldest, Recently updated, Title A–Z / Z–A, Shortest, Longest) and Status (Draft / Published / Archived) and Type (Placement / Regular, sent as `isPlacement`) filters, all kept in the URL by `useListParams({ sort: '-createdAt' })` (`?q=&status=&type=&sort=&page=`; a page past the end goes back to the last page; "No matching passages" when nothing matches), then a 3-column card grid of the public passages only, TypeTrace's and the approved ones: `visibility: 'public'`, so a learner's private passage, waiting or turned down, never shows up there as published; the hard delete is offered where `canHardDelete` allows it (`types/passage.types.ts`: archived and not a placement passage, the backend refusing the placement passage and a passage learners have typed, while one only opened on the Typing page can go), by the Delete icon of a card and by Delete passage in the edit form, both through one `ConfirmDialog` that closes after a refusal too (the backend message is toasted) and, once the passage is deleted, brings the form back to New passage) and "Pending review" (SCRUM-176, `PendingPassagesPanel`: learners' requests to make a passage public as the same `PassageCard`s in review mode (a learner's edit of a public passage is in the same queue: the card shows the proposed text and an Edited badge next to its Published status, `PassageViewDialog` shows what the edit changes against the approved version, word by word (`lib/text-diff.ts` `diffWords`: words taken out struck through in red as `<del>`, words put in highlighted as `<ins>`, in place, in the title, the source line and the text, with no extra lines), and `ReviewDialog` says the edit replaces the text) (chosen by clicking it, highlighted with a ring and "Selected" for screen readers, Space / Enter on a focused card too; "by <author> · <source> · asked <day>", View, Approve and Reject icon buttons at its top right (like the learner's cards: visible on hover or focus, always on touch screens; the icon buttons do not choose the card)), oldest first, 9 per page, with a `ListToolbar` (search in title and source, sort, a Type filter Edited / Pending (`?pending-kind=`: Edited = learners' edits of public passages, Pending = requests to make a passage public; sent as `edited=true|false`), "n waiting", and once cards are chosen the Approve n / Reject n buttons as parts of the toolbar of their own, filled like the active Sort / Filter buttons and between the count and Sort (`ListToolbar` `decisions`); no Select all and no tick boxes) whose search, sort and page stay in the URL apart from the bank's through `useListParams({ sort: 'updatedAt', prefix: 'pending' })` (`?pending-q=&pending-sort=&pending-page=`); View opens `PassageViewDialog` with the whole text and its source; Approve / Reject on a card, from the view dialog, or for the chosen cards at once, always through `ReviewDialog`: a `ConfirmDialog` whose Reject needs a reason (at most 300 characters, the learner sees it, and the passage becomes `rejected`: still private, never published); `useReviewPassages` calls `PATCH /api/admin/passages/:id/approve|reject` for one passage and `POST /api/admin/passages/bulk-approve|bulk-reject` for several, and says when some were no longer waiting; after a decision, also a failed one, the queue is asked for again and the choice is cleared, and a 409 or 404 (decided elsewhere, withdrawn, deleted) closes the dialog; the queue comes from `usePendingPassages`, asked again every minute (`REVIEW_QUEUE_REFRESH_MS`) and when the admin comes back to the browser tab). Learner side (SCRUM-34), the "Passages" nav link /passages: pages/PassagesPage is one screen tall below the header on a desktop (`lg`; the footer comes after scrolling, like the Typing page): the New passage Panel (`Panel fill`, its textarea fills the height) takes a third, the My Passages Panel two thirds (6 cards, 2 rows of 3, each one the height of its row) and a card shows as many lines of the text as fit (`useFitLines`, at least 2; on a phone the page grows and shows 4); it has a "New passage" Panel (`OwnPassageForm`: Title on the left and Source on the right above the pasted text, laid out and sized like the admin `PassageForm` (the source is optional: empty means the backend saves the author's name (display name, else "Anonymous learner", never the email)), cleaned like the backend does before they are checked (title at most 120 characters, source at most 300, text of at least 20 words and at most 5000 characters), "Your passages: n/20" and Add passage off at 20), which turns into "Edit passage" (scrolled into view) when Edit is clicked on a row, like the admin passages page: the passage is loaded with its text by `useOwnPassage` (`GET /api/passages/:id`), saved with Update passage (`PATCH /api/passages/:id`), and Cancel, the update, deleting it or sending it for review go back to New passage and a "My passages" Panel listing only the learner's own passages (`mine: true`: private, waiting for review, turned down or approved; TypeTrace's passages are in the passage menu of the Typing page) (a `ListToolbar` with title search, sort and a Visibility filter Private / Public kept in the URL by `useListParams`, one `PassageCard` per passage in a 3-column grid, like the admin passage bank (its `own` prop: the title and the icon buttons on top, then the first lines of the text, then the state badge (on a Rejected passage it is a button that opens `RejectionReasonDialog` with the admin's reason, so the card itself no longer prints it) on the left and the word count on the right (the admin's card has the same footer)'s card; `GET /api/passages?mine=true` is the only list that sends the text), 6 per page with the toolbar `Pagination` at the bottom right; the actions are icon buttons, visible only while the card is hovered or has keyboard focus (always on touch screens), (name in `aria-label`, hint in `title`): Practice, a link to `/typing?passage=<id>`, and on own private passages Edit (not while it waits for review) and Delete with confirmation; own passages show a state badge (Draft = private and not sent, Pending, Rejected, Published = public) and, SCRUM-176, "Request public" (after a confirmation that says which author name everyone will see: the display name, else `ANONYMOUS_OWNER_NAME` of `passages.config.ts`, never the email; `POST /api/passages/:id/publish-request`) or, while it waits, "Withdraw request" (`DELETE` on the same path); an own passage an admin made public can be edited, but not deleted: its edit waits for an admin (the form says so, its button is Send edit for review, and the approved text stays public meanwhile), the card shows Pending while an edit waits (Withdraw request takes it back) and Rejected after a refusal (the badge opens the reason; the modal says it was the edit); pagination; a page past the end, e.g. after deleting its last passage, goes back to the last page); data from api/learner-passages.api.ts and hooks/use-learner-passages.ts (`GET/POST/DELETE /api/passages`; a change also refreshes the passage menu of the Typing page); `passages.config.ts` has the limits (same as the backend) and `countWords`; `lib/passage-text.ts` is a copy of the backend's `cleanPassageText` (keep the two the same), so `OwnPassageForm` checks, counts and sends the text as it will be saved
│   ├── settings/            # /settings (SettingsPage: an Appearance panel with Light/Dark mode tabs, the themes of the mode in use in one grid (the built-in palette, TypeTrace themes, then the user's own), a "+ Custom theme" last card that turns into a live editor `ThemeEditor`, Edit and Delete buttons on hover for the user's own themes only (delete asks for confirmation), then a Security panel (`SecuritySettings`: the email code at login); data from `hooks/use-themes.ts`: `GET/POST/PATCH/DELETE /api/themes`, `GET/PATCH /api/themes/active`) and /admin/settings (AdminSettingsPage: mode tabs and the compact sidebar); `lib/theme-rules.ts` has the rules a theme must meet (same as `BE/src/utils/theme-colors.ts`: keep them in sync); `hooks/use-theme-mode.ts` has `useThemeMode` (Light/Dark, used by the user menu, the header toggle and the tabs) and `useThemeSync` (mounted by `AppLayout` and `AdminLayout`: applies the signed-in user's mode and chosen theme)
│   ├── typing/              # /typing (TypingPage, TypingArea; the Placement tab asks for confirmation in a modal first, then opens `?mode=placement`; a learner who has just created an account (history state `AfterLoginState` `{ newAccount: true }` from `useFinishLogin`, SCRUM-157) is asked once, in the same modal, "Welcome! Take the placement test?" with Start the test / Not now (`ConfirmDialog` `cancelLabel`), and the state is taken out of the history entry at once so a reload does not ask again) and /typing/result/:id (no page title; top to bottom: the note "saved but not counted in your error profile", when the session is not counted, with an OK button that hides it; `SessionInfoPanel` with the passage name, the typing mode and the time chosen; the speed chart `SpeedErrorChart`; the passage with the wrong words highlighted; `ResultActions` (Error detail shows or hides the `ErrorTypeChart` and the Mistakes / Error rate panels of `ResultsPanel`, which start hidden; Replay does nothing yet; Type again goes to /typing). The chart data comes from `useSessionStats` = `GET /api/sessions/:id/stats`, whose loading and error states show in place of the first two; chart colors are theme tokens as `var(--primary)`, never hex; the `SpeedErrorChart`, the WPM (solid, left axis) and errors (dashed, right axis) lines, smoothed, one point per second over the last 10 seconds (the time axis runs 0 to the time the learner chose, a tick every second up to 60 s and then every 5 s or more, `timeLimitSeconds` sent with `complete`, the numbers on the left WPM axis and the right error axis carry their names as axis labels) from `timeline` in the same stats, or a note for an older or a too short session, with the final WPM and ACC of the session stacked on its right (under it on a phone), SCRUM-187; `TypingArea` notes when each word is finished and passes the times to `onFinish(typedWords, typedAtMs)`, sent with `complete`, never while typing): a session is started when the page opens (no start button; `?mode=placement` types the placement passage), the passage name is a menu (`usePassageOptions`, the first 100 of `GET /api/passages?mode=` by title) to pick a specific passage (`?passage=<id>`, the Practice link of the Passages page, picks one before the page opens; it is then taken out of the URL, so a reload does not go back to it), the Random button goes back to a random one, and Restart / time up keep the pick (switching the mode resets it to Random, also on the way back to the mode it was picked in); the timer starts at the first key (`PATCH /api/sessions/:id/begin`) and a session ends at 3:00 (`SESSION_TIME_LIMIT_SECONDS`), sending the words finished so far (nothing finished = a new session starts) and the backend grades it (/api/sessions); the page uses the login/register look (`shared/lib/red-glass-theme.ts`, also used by `AuthLayout`) and shows only the passage: an invisible textarea sits over it and the typed text appears in the passage (grey = not reached, white = typed or right, red = wrong word after the space); TypingArea grades only committed IME text with classifyWord (shared/lib/vietnamese-errors.ts)
│   └── profile/             # /profile (SCRUM-157, the TypeTrace look of the other pages, no PageHeader, no panel titles or frames): `ProfileHeader` (a grid: the 192px avatar tile that uploads a new image on click (`AvatarUpload`, a camera on hover or focus), the name in 2.25rem with a pencil on hover to change it in place (Enter saves, Escape cancels), the email (without a display name: the email as the name and a hint to add one), the bio typed in place (Enter or leaving the field saves, "No description" when empty), WPM / ACC (a whole number) / STREAK on the baseline of the name and under it (zeros before the first completed session, a dash while loading), and the joined date at the bottom right) and `ProfileHeatmap` under it (`ActivityHeatmap` with `calendarYear`, `fill` and `labels`, and a tooltip at once over the hovered cell with the day and its sessions, "27 Oct 2026: 2 sessions", from the `data-tip` of the cell, in the look of the dropdown menus: the quarters of this year in whole weeks, 128px high (`h-32`, two thirds of the avatar tile of the header above it), with the error and a retry, and "No completed sessions yet" with a link to the Typing page) and `ProfileSessions` at the bottom (a `ListToolbar` (`plain`: no background, the controls in the red of the title, no ring on the search box) titled "My Sessions" with a search box without the magnifier (passage name, `q`), Sort (Newest, Oldest, Fastest, Most accurate), Filter (`mode`, and `time` = the time chosen, sent as `timeLimitSeconds`) and the total, a list of `SessionCard`s, 3 per page, `Pagination`; its URL params have the prefix `sessions`; `useSessions` reads `GET /api/sessions?status=completed`, a summary without the words; a `SessionCard` is built like the user card of the admin area (`ListRow` with `plain`: no background and no frame until hovered): the icon of the mode (`modeIcons`, as on the Typing page tabs, no background) and the passage name, the speed line `SessionLine` where the heatmap is (small recharts lines of WPM (solid) and errors (dashed) without axes, each with its own scale, from the `timeline` of the item, the same as the stats; a note when the session has no word times or is too short; hidden below `xl` like the heatmap), WPM, ACC (one decimal) and TIME (the time chosen, a dash on older sessions), and under the name only the date (the mode is the icon; no bottom tier, no "Not counted" mark), and the whole card links to `/typing/result/:id`). The old "Profile", "Edit profile" and "Security" panels are gone: `ProfileEditForm.tsx` is no longer used (the phone number cannot be changed for now) and "Security" is on the Settings page. `hooks/use-profile.ts` `useTypingActivity` reads `GET /api/sessions/activity` (asked again each time the page opens, `staleTime: 0`); profile.module.ts, api/, types/
├── shared/
│   ├── api/                 # http.ts (axios), query-client.ts, api-error.ts, types.ts (Paginated<T>)
│   ├── components/          # panel, page-header, empty-state, error-state, loading-state, confirm-dialog,
│   │   │                    # form-field, pagination, lottie (`Lottie name loop play`: a file of FE/public/lottie, aria-hidden, still for reduced motion; see AGENTS.md)
│   │   ├── data-table/      # DataTable, SearchInput, FilterSelect, TableToolbar (list and admin pages)
│   │   ├── layout/          # AppLayout (BrandHeader with the navigation and the avatar `UserMenu` with Mode, Admin (admins only) and Logout, BrandFooter, module widgets), AdminLayout (AdminSidebar with its own logo header and Logout footer, no BrandHeader/BrandFooter, /admin)
│   │   └── ui/              # shadcn/ui primitives (button, input, dialog, switch, ...)
│   ├── hooks/               # use-debounce, use-pagination, use-fit-lines (how many lines of text fit in a box, for a `line-clamp`)
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
- `widgets`: components rendered on every page of `AppLayout`, for floating UI; a widget positions itself (`fixed ...`) and keeps its own state. A component that belongs in the top navigation (the chat tab) is a `navItems` entry `{ Component }` (`NavWidget`) instead of a link: `chatModule.navItems = [{ Component: ChatWidget }]`, drawn where its module stands in `modules.ts` (before Settings); its popup goes to `document.body` because the header's blur would make a fixed popup follow the header. Add `roles: ['admin']` to a route or nav item to restrict it; `ProtectedRoute roles` sends other users to `/`. Public auth pages (`/login`, `/register`, `/forgot-password`) live in `App.tsx` under `AuthLayout`. Page number lives in the URL via `usePagination()` (`?page=2`).

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
Use `Panel` (title, description, actions; `fill` grows to the height a flex column gives it) for every block of content in a page, `PageHeader` for the title row of a non-admin page (admin pages get their title from `AdminLayout`), `Pagination` under lists, `ConfirmDialog` before deleting (its `children` go between the description and the buttons, e.g. a field for a reason, and `confirmDisabled` keeps the confirm button off until it is filled, see `ReviewDialog`; `cancelLabel` renames Cancel, e.g. Not now), `useDebounce` for search boxes.
A list of people or items in the red card look uses `ListRow` (slots `identity`, `center` (wide, `xl` up), `extra` (narrow, right), `action` (far right, as wide as its content), `tags`, `meta`) with `ListRowMenu` for the kebab button, `ListRowStat` for a label over a big value in `extra` (`WPM` over `64`) and `ActivityHeatmap` for a 53-week activity grid (a whole year) in four blocks (`calendarYear`: whole weeks of this year cut into its quarters instead, `labels`: the months under each block, `fill`: as high as the parent); `modules/admin/components/UserRow.tsx` is the reference, and `PassageCard` (`modules/passages/components/`) is the card version, with icon buttons at the top right instead of a kebab menu.

`ListToolbar` (`shared/components/list-toolbar.tsx`) is the bar above such a list, all in one row: an optional `title` island in the theme red before the search (`My Passages` on the learner page), an optional `search` box that fills the row, and on the right a `summary` text (e.g. the total count, styled like the buttons), a **Sort** button (menu of the sorts the backend allows, current one checked) and a **Filter** button (menu with one group per filter, each with an "All" entry; the button shows how many filters are on). Sort and Filter turn red-orange (like the tag badges) while they hold a non-default choice; the first sort option counts as the default, plus an `actions` slot on the right. It only shows the controls and reports changes, so pair it with `useListParams`; `AdminUsersPage` is the reference. It is built from `SearchInput` and the dropdown menu.

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
