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
| `npm run seed` | Demo accounts `demo@example.com / demo1234`, `admin@example.com / admin1234`, 12 students `student01..12@example.com / student1234` (`student01` is on Premium for a month, given by the demo admin); and typing sessions for `demo@example.com` (a counted placement test 8 months ago, practice sessions since, two months without any, sessions on the last days, each with errors and chances of every error type) so the charts and the error profile of the profile have data; made once (demo sessions seeded before the error profile get its counts on the next run) |
| `npm run import:words` | Add the starter word list (`BE/src/data/words.ts`) to the word bank with error tags; safe to run many times |
| `npm run import:passages` | Add the starter passages (`BE/src/data/passages.ts`, source recorded, owner TypeTrace) to the passage bank as published passages; safe to run many times |
| `npm run import:passages:en` | Add the English starter passages (`BE/src/data/passages-en.ts`, marked `isRanked`, for ranked duels; never offered in Practice or Placement) as published passages; safe to run many times |
| `npm run import:themes` | Add the starter themes (`BE/src/data/themes.ts`, owner TypeTrace) as published themes; safe to run many times |
| `npm run rebuild:progress` | Rebuild every learner's days (`DailyProgress`: streak, daily mission, profile heatmap) from their counted sessions, in each learner's own time zone. Run it once after deploying SCRUM-31 (older sessions have no day yet) and after changing `DAILY_MISSION_SESSIONS`, while nobody is typing; safe to run many times |
| `npm run rebuild:tag-counts` | Count the words and error tags (`tagCounts`) of every passage again from its text and language. Run it once after deploying SCRUM-218 (English passages saved before have no English tags yet) and after changing `tagWord` or `tagEnglishWord`; safe to run many times |
| `npm run migrate:rating-kinds` | Mark the ratings saved before word rain duels as race ratings (`kind: 'race'`) and switch to the one-rating-per-kind index. Run it once after deploying the rain duel; safe to run many times |
| `npm run migrate:user-status` | Give `active` to the accounts saved before the `status` field existed (they have none, and the placement leaderboard lists only `active` accounts); locked accounts keep theirs. Run it once; safe to run many times |
| `npm run migrate:placement-board` | Set `isOnPlacementBoard` again, from the rules and the minimum accuracy saved, on every completed placement session (fixes flags saved wrong; saving the minimum in the admin Settings page does the same). Run it after deploying the minimum accuracy setting; safe to run many times |
| `npm run migrate:ranked-passages` | Mark the published public English passages already in the bank as `isRanked`: ranked duels (races and word rain) play only those. Run it once after deploying US6.4; safe to run many times |
| `npm run migrate:subscriptions` | Give a Free `migration` subscription row to the accounts saved before subscriptions existed (a missing row already reads as Free; this only gives them a history; it also closes the rows written by the first version of US11.1). Run it once after deploying this version of US11.1; safe to run many times |
| `npm run dev` | Run backend (http://localhost:5003) and frontend (http://localhost:5173) together |
| `npm test` | Run backend and frontend tests |
| `npm run lint` | Lint the frontend |
| `npm run build` | Typecheck and build both apps |
| `npm run gen:module -- <name>` | Scaffold a new feature (BE + FE + tests) from the `notes` module |
| `npm run gen:module -- <name> --remove` | Delete a generated feature again |

Optional services: without SMTP, emails (OTP and reset codes) are printed in the backend terminal in development and
answer 503 in production; without Cloudinary, image upload answers 503; without `GEMINI_API_KEY`, the AI chat answers 503; without `GOOGLE_CLIENT_ID` (BE) / `VITE_GOOGLE_CLIENT_ID` (FE), "Login with Google" answers 503 and its button is hidden; without `VNP_TMN_CODE` / `VNP_HASH_SECRET` (BE, `VNP_URL` defaults to the VNPay sandbox), payments answer 503.
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
- Realtime: server-sent events through `services/match-hub.ts` (`subscribe`, `publish`, `schedule`, `withMatchLock`); clients
  read them with `fetch` and the `Authorization` header, never a token in a URL. The open streams and timers live in memory,
  so the backend runs as one process. A player who leaves a running match, or whose stream stays closed `disconnectGraceMs`
  (15 s), does not finish (DNF, stored as `forfeit`); the room hears `presence` events, and a race player who comes back gets
  `resume` with their saved words (SCRUM-154). Keep the frontend's reconnect wait (`MAX_RECONNECT_MS`) well under that grace.
- The User model strips private fields in `toJSON`; keep it that way for new private fields. `.lean()` and `aggregate()`
  skip `toJSON`: with them, `.select()` the public fields explicitly.
- A learner's days (streak, daily mission, profile heatmap) are calendar days in their `settings.timezone` (`DEFAULT_TIMEZONE`
  when it is missing or unknown): cut them with `localDateKey(date, zone)` and count them with `addDays` (`utils/local-date.ts`),
  never with `toISOString().slice(0, 10)`. They live in `DailyProgress`, which only `completeSession` (and `claimStreakReward`) writes, through
  `recordCountedSession`. The mission goal is `DAILY_MISSION_SESSIONS` (`services/daily-progress.service.ts`), sent to the
  frontend as `missionGoal`. The admin user list keeps its own UTC days from `TypingSession`.
- The streak reward replaced the daily challenge (its `/api/daily`, card and board are gone; old data stays unread): today's
  first counted session makes it claimable, once, with `POST /api/profile/streak/reward` (`claimStreakReward`: one conditional
  update sets `rewardClaimedAt` and `rewardCoins` on today's `DailyProgress` row, so two claims pay once; coins
  `streakRewardCoins` = 20 + 5 per streak day before today, at most 50). The result page asks with `StreakRewardDialog`.
- A learner's daily tasks (SCRUM-112) live in `UserDailyTasks` (`models/user-daily-tasks.model.ts`): one document per learner
  and local day, made by the day's first `GET /api/profile/daily-tasks` or counted session, with a snapshot of `dailyTaskCount`
  active `DailyTask` templates (weak error types first) and the numbers of the sessions already counted that day, cut in the
  zone it keeps as `timeZone`. It is stored once (an upsert with `$setOnInsert`) and its `tasks` are never edited afterwards:
  template edits and a new count apply from the next day. After that upsert, its `progress` is written only by
  `updateDayNumbers` (`services/user-daily-tasks.service.ts`), which works the day's numbers out again from its counted
  sessions: with `$max` after each counted session (`completeSession`, through `recordDailyTaskProgress`), so recording a
  session twice changes nothing, and replaced once, with the new `timeZone`, by the day's next counted session or `GET`
  after the learner's zone changed.
- A learner's error profile (SCRUM-27) is never stored: `getErrorProfile` (`services/error-profile.service.ts`) works it out
  when it is read from their last 20 counted sessions that have chances (the current window is the 10 newest, the previous
  one the 10 before them), with the pure `computeErrorProfile`: per error type the rate in %, the level (`weak` from
  `WEAK_RATE`, compared in whole numbers, never with a sum of decimals) and the trend (a two-proportion z-test between the
  windows). Nothing is written in `completeSession`, there is nothing to rebuild or to delete with the user. The thresholds
  are sent with `GET /api/profile/error-profile`: never write them in the frontend. A feature that needs the learner's weak
  error types reads `getWeakErrorTypes` (the daily tasks and word rain still pick theirs their own way).
- A completed session's replay (SCRUM-35) lives in its own `SessionReplay` collection (`models/session-replay.model.ts`),
  which a TTL index on `createdAt` empties 30 days after each save: `TypingArea` records the changes of the text on screen
  (`createReplayRecorder`, `FE/src/modules/typing/utils/session-replay.ts`), the page sends them as `replay` with
  `PATCH /api/sessions/:id/complete`, and `GET /api/sessions/:id/replay` reads them back (owner only). A replay never makes
  a completion fail: one over `MAX_REPLAY_BYTES` (64 KB, a copy in `typing.config.ts`) or not made of changes is dropped,
  and a failed save is only logged.
- The placement leaderboard (US10.1, `GET /api/placement/leaderboard`, `services/placement-board.service.ts`) takes only sessions with `isOnPlacementBoard`:
  the server sets it when a placement session completes (`isSessionOnPlacementBoard`: counted, started with 3 minutes, accuracy of `placementMinAccuracy` or more (an app setting, 90 until an admin changes it in the admin Settings page; saving a new one runs `rebuildPlacementBoardFlags`, which sets the flag again on every completed placement session, and a session being completed reads the minimum again after its own write), lasted
  the 3 minutes or typed the whole passage). The time the learner chose comes with `POST /api/sessions` (`timeLimitSeconds`, kept as `chosenLimitSeconds`; changing the time in Placement starts a new session (the passage is chosen again), and an abandoned session is deleted 24 hours later by a partial TTL index on `updatedAt`, `ABANDONED_TTL_MS`);
  the `timeLimitSeconds` of `complete` is only for the chart and is never read for ranking. It is not `Passage.isRanked` (the passages of ranked duels).
  The week starts on Monday 0:00 in `Asia/Ho_Chi_Minh` (`placementWeekStart`). The ranking of each board is kept in memory (`placement-board-cache.ts`): built again after an hour, and only if something changed (`placementBoardChanged`); call it whenever a change can alter a board. Names and avatars only, never an email.
- Plans and passage limits (US11.1): a learner is on `free` or `premium`. Their plan is the newest `Subscription` row in
  effect (`models/subscription.model.ts`, `services/subscription.service.ts`: `getCurrentSubscription`): a row is one term
  with its own dates (`startsAt`, `expiresAt`; it may start in the future); no row means Free, and a Premium term past its end reads
  as Free (nothing runs in the background: the first read writes the one `auto` Free row, the unique partial index keeps it to
  one). Rows are only added; the only edits are `endedAt` (a Free row when Premium starts, a Premium term cut short) and
  `cancelledAt`. Each row has a status worked out when it is read (`subscriptionStatus`, and `statusFilter` for the list):
  `upcoming`, `active`, `cancelled` (also while it runs to its end) or `ended`. Every new account gets a Free `signup` row from a hook on the `User` model
  (never from the OTP functions). A row says who made it: `signup`, `payment` (`recordPaidMonth`, for US11.2 and US11.3),
  `admin` (`grantPremium` queues the months as a new term that starts when the last one ends, so every term keeps its own dates; `cancelPremium` lets the paid time run out, `revokePremium` stops it at once; `changedBy` is the admin), `auto`, `migration`. What a
  plan gives (`priceVnd`, `maxPassages`, `canCreateErrorPractice`, `canUsePublicPassages`) is `AppSettings.plans`
  (`getPlanConfig`, defaults `DEFAULT_PLANS`: Free 9 passages, Premium 90): US3.2 must check `canCreateErrorPractice`.
  `MAX_USER_PASSAGES` is gone: `passage-lock.service.ts` counts every passage the learner made (draft, private, pending,
  rejected, public; not archived, placement, ranked or English ones, never an admin's or a deleted account's) and locks, when they have more than their plan's
  `maxPassages`, all but the newest ones (`getLockedPassageIds`, worked out on every read, nothing stored: buying Premium,
  a new limit or deleting a passage opens the older ones again). A locked passage cannot be practiced or picked and other
  learners never see it; its owner sees it dimmed (`locked: true`) and may delete it (also when public). Free practices only system passages (no owner, or an admin's) and its own: another learner's public
  passage is listed with `lockedByPlan: true` and starting a session with it answers 403 (`assertCanPractice`).
  Placement and ranked ignore plans. The passages of an account that was deleted (the subscription rows go with it) are system passages. `GET /api/plan` is the learner's own plan, `/api/admin/plans` (GET, PUT, POST
  `/preview`: how many users and passages a change would newly lock) and `POST|DELETE /api/admin/users/:id/premium` and `POST` `.../premium/cancel`
  (1 to 36 calendar months, Vietnam time) are the admin side. `npm run migrate:subscriptions` gives old accounts a row.
- Word errors have one set per passage language, each a pure file with an identical frontend copy in `FE/src/shared/lib/`
  (keep each pair identical): Vietnamese `utils/vietnamese-errors.ts` (`WordError`, `classifyWord`, `tagWord`) for everything
  learners practice, English `utils/english-errors.ts` (`EnglishError`, `classifyEnglishWord`, `tagEnglishWord`, SCRUM-218)
  for the English passages of ranked duels. Never mix the two: a passage's `tagCounts` counts the set of its `language`
  (`computePassageStats`). After changing a `tag…` function, run `npm run rebuild:tag-counts`.
- Payments (VNPay, `/api/payments`, `services/payment.service.ts`): what can be bought and its price live in `config/payment.ts`
  (`PAYMENT_PRODUCTS`, today only `pro`); the client sends a product id, never an amount. `POST /vnpay` saves a pending `Payment`
  (its `_id` is `vnp_TxnRef`) and returns `paymentUrl`; VNPay sends the learner back to `${CLIENT_URL}/payments/vnpay/return`
  and calls `GET /vnpay/ipn` (server to server, answers `RspCode`). Both go through `applyVnpayResult`, which checks the
  `vnp_SecureHash` (`utils/vnpay.ts`), the payment and the amount, and changes a still-pending payment once. A payment never
  grants anything by itself yet: the Pro plan and coin top-ups read `Payment.status === 'paid'`.
- App-wide settings that admins change live in the one `AppSetting` document (`models/app-setting.model.ts`, SCRUM-210):
  read them with `getAppSettings()` (the model's defaults until an admin saves) and save them with `updateAppSettings(changes)`
  (`services/app-setting.service.ts`). A new setting is a new field there, with its default, not a new collection.

## Frontend rules

- One folder per feature in `FE/src/modules/<feature>/` with `api/ hooks/ components/ pages/ types/` and a
  `<feature>.module.ts` describing what it adds: `routes` + `navItems` (main app), `adminRoutes` + `adminNavItems`
  (admin area), `publicRoutes` (pages anyone can open, outside the login lock and `AppLayout`: the home page), `widgets` (components on every app page: floating UI, or one that draws nothing and keeps something in step, like `TimezoneSync`, which sends the browser's time zone), a `navItems` entry `{ Component }` instead of a link puts a component in the top navigation, `menuItems` add entries to the account menu in the header (`{ label, icon, to }` or `{ label, icon, onSelect }`: Settings, AI chat). Register it in `FE/src/app/modules.ts`.
- HTTP only through the `http` instance (`shared/api/http.ts`). API functions return the response body: `http.get<T>(url).then((r) => r.data)`.
  The one exception is a server event stream, which axios cannot read: `openMatchStream` in `modules/ranked/api/ranked.api.ts`
  uses `fetch` with the `Authorization` header (never a token in the URL) and puts the events into the query cache.
- Server data only through TanStack Query hooks in `hooks/use-<feature>.ts` (see `modules/notes/hooks/use-notes.ts`):
  a key factory, `useQuery` for reads, `useMutation` + `invalidateQueries` for writes. No `useEffect` + `useState` fetching.
- The signed-in user: `useCurrentUser()`; after changing it, `useSetCurrentUser()` or invalidate `currentUserKey`.
- Mutations without `onError` show the backend message as a toast automatically. Add `onError` only for custom handling.
- Forms: React Hook Form + `zodResolver`, laid out with `FormField` (`shared/components/form-field.tsx`). Mirror the backend schema.
- Every data view handles loading, error and empty states (`LoadingState`, `ErrorState`, `EmptyState`).
- Reuse shared UI before writing new: `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog` (`children` for an extra field such as a reason, `confirmDisabled` until it is filled, `cancelLabel` to rename Cancel), `Pagination`,
  `StatCard`, `Panel`, `ListRow` + `ListRowMenu` + `ListRowStat` (a two-tier red list item with slots, see `UserRow`; its tags are `LabeledTag`s and badges, as on the passage cards; icon buttons instead of the kebab menu: `PassageCard`), `ActivityHeatmap` (always one tooltip for the hovered day; a learner's own days: `timeZone`, `unit`, `legend`, see `ProfileHeatmap`), `ListToolbar` (an optional `title` island, search + Sort and Filter menu buttons, `menus` of its own in their look for a setting of the list such as `3 a day`, + actions above a list) (`shared/components/`), `CompactToolbar` (Search, Sort, Filter and a total as icons whose word shows on hover, no background: for a list under a title, see `ProfileSessions`; `menus` add pickers of their own that always show their choice, an `adder` (a "+" in front of them, whose menu of groups opens a second menu of options to add beside it) and `tags` (what was added, on the left of the "+", each with an x shown on hover): the Progress page), `DataTable`, `SearchInput`, `FilterSelect`, `TableToolbar` (`shared/components/data-table`),
  shadcn primitives (`shared/components/ui/`), hooks `useDebounce`, `usePagination`, `useListParams`, `useFitLines` (`shared/hooks/`),
  date helpers in `shared/lib/local-date.ts` (a learner's today is `dateKeyIn(new Date(), timezone)`, never `toISOString()`).
  The daily mission goal is the backend's `missionGoal`: never write the number in the frontend.
- Design: the TypeTrace look of the login pages applies to every page, now and for new features. Header and footer are
  `BrandHeader` / `BrandFooter` (`shared/components/layout/`; `AppLayout` already uses them, so pages
  inside them get both). Colors are only the theme tokens in `FE/src/index.css` (Blood red dark palette and Sand light palette, built from 4 theme colors; users can choose their own themes): do
  not add purple, blue or other accents. A page that wants the red glass card (typing) uses `redGlassTheme` and
  `redGlassCard` from `shared/lib/red-glass-theme.ts`. Square corners (radius 0), no per-page color schemes.
  Exception: the pixel avatar art (and the ranked duel screens built around it) keeps the colors of its sprites. Show an
  avatar only with `AvatarSprite` (`modules/avatar/components/`, layers from `FE/public/avatar`, rule in `lib/layers.ts`); the
  sprites and the item lists are generated by `node minigame-sprites/build-layers.mjs`, never edited by hand.
  The mascot Ping (the tutorial guide, a chibi cyberpunk kid) is its own pixel art, not avatar layers, and also keeps its
  colors: one strip of 4 frames (64×88 each) per move in `FE/public/mascot/ping-<move>.png` (idle, talk, happy, sad, point,
  typing), drawn by `node minigame-sprites/draw-ping.mjs`, never edited by hand.
  Decorative motion that CSS cannot draw (a flame, confetti, a trophy) uses `Lottie` (`shared/components/lottie.tsx`, the one
  animation library, `@lottiefiles/dotlottie-react`) with files in `FE/public/lottie/` (source and author in its `CREDITS.md`);
  they keep their own colors like the avatar sprites, never carry information on their own, and stay still for reduced motion.
- Plans (US11.1, `modules/plan`): `PlanBadge` (Free or Premium next to the name on the Profile) opens `PlanDialog` (both plans side by side as read-only cards
  like the admin ones (`PlanOfferCard`), the learner's own outlined, and in each card, at the bottom, its button: "Buy now" on Premium,
  "Owned" on the learner's own card, none on Free for a learner on Premium; Buy now does nothing but say so until US11.2/US11.3) with `usePlan` (`GET /api/plan`, which also sends both plans with their price); the same dialog opens from a passage the plan
  locks in the Typing menu. Never write a limit in the frontend: the Passages page reads `maxPassages` and `usedPassages` from the
  plan. `AdminPlansPage` (`/admin/plans`) has bare panels with a title each (no padding, border or background): first `PlanUsersChart` (titled Subscriptions, as tall as the screen leaves it, so with the Plans panel it fills one screen: a double bar chart of the users on each plan, two bars a period: Premium and Free, with the Week/Month/Year menus of the Progress page and a Lines button (All, Premium, Free) next to Year, which a click on a plan card also sets (the card shows its line alone, a second click shows both; a click on a field or a switch does not); `GET /api/admin/plans/users-over-time`, counted at the end of each period), then the two plan cards (under the title Plans, with Save on its row, in two columns that share the whole width), which edit both plans and ask the server what a save would lock before saving, and `SubscriptionList` under them (titled Subscription list, a `CompactToolbar showWords`, plain rows without a background), every term of every user built like My Sessions of the Profile (`GET /api/admin/subscriptions`; its SOURCE is the payment method, `None` for every change that was not a payment, each card starts with the user's avatar (picture or pixel face, as on the admin Users page) with their email under the name, its period (start → end, `Now` while it has no end; the admin who made the change under it) is in the middle and its STATUS is Upcoming, Active, Cancelled or Ended, each a filter; BY filters an admin or the system).
- Login, register and forgot-password pages (`modules/auth`): `AuthLayout` puts `AuthBrandPanel` (the default avatar typing, big (scale 5) and centered above `TypingDemo`; the avatar's hair is level with the top of the form's title (the sprite frame has empty rows above it, so the avatar is pulled up by `AVATAR_TOP_GAP_PX`):  the Typing page's `PassageView` typing a fixed passage by itself, with a wrong word and a slip that is deleted; no keys, no API; the final state for reduced motion) on the left from `lg` up and the form on the right, with no background (no card, border or blur), both columns level at the top and together centered vertically between the header and the footer (as wide as the other pages, `max-w-7xl`), under the header of the signed-in pages (`BrandHeader` with `GuestMenu`: the default avatar's head, "Guest", and a menu with Mode, Login and Register, every tab without a role, `NavLinks`, which send a guest back to Login) and text 2px bigger than the shared components (`AuthLayout` overrides `text-2xl`, `text-base`, `text-sm`). Fields are `FormField hideLabel` (the label stays for screen readers, the placeholder names the field: "Email", "Password"; 12px between fields, 24px before the submit button, between the buttons, before the icon buttons, between those and before "Forgot password?": `mt-6` on the element, not an extra margin, because neighbouring vertical margins collapse to the larger one) + `AuthInput` (no border, line or background of its own, even focused, red text on `aria-invalid`, text 20px, show/hide button for passwords, shown only while the field is hovered or focused (always on touch screens)); the title is 32px and centered, the primary button is 48px high; the other page's link is an outline button under the submit button ("Log in to your account", "Create a new account"); `SocialButtons` (a row of three equal icon buttons that fill the width: Google, which really works, and Facebook and GitHub, placeholders that say "not available yet") sits under the form of Login and Register (after the button to the other page, on Login before "Forgot password?"); Google's own button cannot be resized, so `GoogleSignInButton` renders it scaled up and invisible over its square cell; Login's "Forgot password?" link is a right-aligned line under them; the title ("Login" / "Register") has no description and 24px below it, like the gaps between the buttons; Register also checks the email while it is typed (`useEmailExists`: a valid email, 500ms after the last key, `GET /api/auth/email-exists?email=` answers `{ exists }` and nothing else, under the auth rate limit; a red icon on the right of the field, with "This email already has an account. Log in instead." in a tooltip (`AuthInput`'s `warning`)) and shows `PasswordStrengthMeter` under the password (`passwordStrength` in `modules/auth/utils`, 0-4 from length, case, digit, symbol: a hint only, the server checks the length alone); a failed submit calls `useFormShake`. Their motion (`auth-enter`, `auth-shake`, the typing demo) is skipped for reduced motion.
- Tooltips: use the shared `Tooltip` (`shared/components/ui/tooltip.tsx`, same look as the heatmap tooltip and the menus), not the native `title` attribute; wrap the trigger in a span when the button can be disabled.
- Menus: every dropdown menu (`shared/components/ui/dropdown-menu.tsx`) has the `Panel` look: see-through page background with blur, panel border with the soft red hover, muted option text that turns red on a light red tint while hovered.
- Styling: Tailwind theme tokens (`bg-background`, `text-muted-foreground`, ...), never raw hex colors. Layouts must work on phones.
- Imports use the `@/` alias. Components and pages are `PascalCase.tsx` named exports; other files are `kebab-case.ts`.

## Admin area

`/admin` has its own sidebar layout (`FE/src/shared/components/layout/AdminLayout.tsx`): no BrandHeader/BrandFooter, the sidebar (`AdminSidebar.tsx`) has the logo on top and the user + Logout at the bottom. The reference admin page is user
management: `FE/src/modules/admin/pages/AdminUsersPage.tsx` (a bare `Panel` titled User list whose `actions` are a `CompactToolbar` with search, sort, filters and the count, a list of `UserRow` cards (`ListRow plain flat`: no background, no lines between the tiers) with an edit/disable/delete kebab menu (shown while the row is hovered) that a right click on the row opens too (`RowContextMenu`, `shared/components/row-context-menu.tsx`; also the menu key or Shift + F10 on the focused row; a click chooses the row),
pagination, the `UserForm` panel above the list (edit only: empty and disabled until Edit picks a user), delete with confirmation) backed by `BE/src/routes/admin.route.ts`. For a review queue with
cards chosen by a click and bulk decisions, see the Pending review panel under the Passage list panel of `FE/src/modules/passages/pages/AdminPassagesPage.tsx`
(`PendingPassagesPanel`: learners ask for their own passages to become public, admins approve them or turn them down with a
reason, which makes them `rejected`, SCRUM-176). Two lists on one page keep their URL params apart with `useListParams({ sort, prefix })`.

**Access: admins only.** The lock is one line on each side: `requireRole('admin')` in `BE/src/routes/admin.route.ts`
(others get 403) and `<ProtectedRoute roles={['admin']}>` around `AdminLayout` in `FE/src/App.tsx` (others are sent to `/`).
The "Admin" item in the avatar menu (`UserMenu`, top right of the main app) is also admins only. After login or registration, admins land on `/admin`; everyone else on `/typing` in Practice mode (`afterLoginPathFor` in
`FE/src/modules/auth/utils/home-path.ts`); `/` is the public home page (`HomePage`, registered as a `publicRoutes` entry of `home.module.ts`): a signed-in user is sent to `/typing`, a guest gets a one-minute typing test (`GuestHomePage`) that runs only in the browser, with passages from `modules/home/lib/guest-passages.ts`; it never calls the API, saves nothing, and its result invites the guest to register. A learner who has just created an account (registration, or a first Google login: `useFinishLogin(token, { newAccount: true })`) lands there with the history state `AfterLoginState`, and the Typing page starts Ping's tour once (`POST /api/tutorial/start`, see "Tutorial (Ping)"), which brings the placement test in its turn. The placement test is the Placement tab on the Typing page (a confirm modal first). Make the first
admin with `npm run seed` (`admin@example.com`) or by setting `role: 'admin'` in the database. Keep the server-side checks that stop
an account from deleting itself or removing its own admin role.

To add an admin page for a feature module:

1. Backend: endpoints under `/api/admin/...` in `admin.route.ts`. Lists use `validate({ query })` with `sortSchema`,
   `optionalBooleanQuerySchema` for yes/no filters, and `paginate`. Bulk actions take `bulkIdsSchema` (`{ ids }`).
2. Frontend: in the module's `<feature>.module.ts` add `adminRoutes: [{ path: '/admin/<plural>', Component }]` and
   `adminNavItems: [{ to: '/admin/<plural>', label, icon }]`. Build the page like `AdminUsersPage`: a `ListToolbar` (search, sort, filters),
   a list of `ListRow` cards (or a `DataTable` with column config for plain tables), `Pagination` (`variant="toolbar"` = right-aligned, styled like the `ListToolbar` buttons; `accent` = red text on transparent buttons), `ConfirmDialog`, and `useListParams`
   to keep search, filters, sort and page in the URL.

## Tutorial (Ping)

The mascot Ping guides new learners (`docs/superpowers/specs/2026-10-30-ping-tutorial-design.md`):

- State: `user.tutorial = { tour: 'active' | 'done' | 'skipped', modes: { practice?, placement?, rain?, rank?: 'done' | 'skipped' } }`
  (the Daily mode left with the daily challenge; an old stored `modes.daily` is ignored).
  **Missing = an account from before the tutorial: nothing is shown.** Never give it a default. `/api/tutorial`
  (`routes/tutorial.route.ts`): `POST /start` (after sign-up, keeps an existing state), `PATCH /` (`{ mode, status }` and/or
  `{ tour }`, 400 without a state), `POST /reset` (Settings "Xem lại hướng dẫn"), `POST /coach` (Ping's tip after the practice
  duel: `generateChatReply` with `config/ping-coach.ts`, a written tip when the AI cannot answer; shares the chat limiter).
- Frontend: `modules/tutorial` (a widget, `TutorialGuide`, on /typing only). The steps of each mode are in `steps.ts`
  (`MODE_STEPS`, Vietnamese, Ping's voice); the tour chains them in `TOUR_ORDER`. A step frames `[data-tutorial="<id>"]` with
  `Spotlight`; add that attribute to what a new step points at. A step that waits for the learner sets `tutorialStore`'s hold
  (`rain-word`: `RainMode` freezes the rain and frames its lowest word until it is typed). Skipping is a button, never Escape.
- The practice duel against Ping-bot (`lib/practice-duel.ts`, Bronze pace, words of `GET /api/rain/words`) runs in the browser
  only: it never calls `/api/matches` or `/api/ranked` and never changes a rating.
- The Bot duel minigame (`?mode=minigames&game=bot`, `BotDuelMode`, SCRUM-247) reuses that practice duel at three levels
  (`BOT_LEVELS`: Bông/Bronze, Nhịp/Gold, Dạ/Diamond, each with its typing speed and miss rate). The bots are their own pixel
  sprites (`BotSprite`, strips in `FE/public/bots`, see its README), keep their colors like Ping, and are not edited by hand.
- The Nối từ minigame (`?mode=minigames&game=chain`, `WordChainMode`, `modules/word-chain`) is a Vietnamese word chain against a
  friendly bot, played in the browser: a 60 s clock, the linking syllable is typed for the player (`composeAnswer`), a right word
  adds time by its WPM (`BONUS_TIERS` in `lib/word-chain.ts`), a refused word, a hint or a skip costs time. A finished game goes to
  its leaderboard (a modal from the game, and the Minigames tab of the Leaderboard page, `?tab=minigames`; `/api/word-chain`, `services/word-chain.service.ts`, this week from Monday 0:00 in Vietnam and all the time): the
  server works the score out again from the chain (`scoreChain`, `utils/word-chain-rules.ts`, against `data/noi-tu-words.ts`), never
  takes it from the client. Its word list `FE/public/noi-tu/words.txt` (`*` = the bot may
  play it; sources and licences, GPL-2.0 and CC BY, in its `CREDITS.md`) and its server copy `BE/src/data/noi-tu-words.ts` are
  generated by `minigame-words/build-noi-tu.mjs` (see its README), never edited by hand.

## AI chat bot (Gemini)

A sample chat bot to customize, not a finished product:

- UI: "AI chat" in the account menu (the avatar menu in the header) opens a chat popup under the header, on the right (`FE/src/modules/chat/components/ChatWidget.tsx`),
  registered as a widget and a menu item in `chat.module.ts`. It has no page of its own. Texts and suggested questions: `chat.config.ts`;
  conversation state: `hooks/use-chat.ts`.
- Backend: `POST /api/chat` with `{ messages: [{ role: 'user' | 'model', text }] }` → `{ reply }`. Stateless: the client sends
  the conversation each time. Signed-in users only, 10 messages per minute per user.
- Personality: `BE/src/config/chatbot.ts` (system prompt, longest reply in tokens, history length).
  Gemini calls: `BE/src/services/ai.service.ts`, `generateContent` with plain `fetch` (no SDK); the key goes in the `x-goog-api-key` header, the system prompt in `systemInstruction`, and `model` messages keep their `model` role.
- Config: `GEMINI_API_KEY` (https://aistudio.google.com/apikey, free tier with limits) and `GEMINI_MODEL` (default `gemini-2.5-flash`)
  in `BE/.env`. Quota errors answer 429, a bad key or model 503. Never put the key in frontend code.

## Testing rules

- Backend integration tests use `api()` from `BE/tests/helpers/api.ts` (not `request(app)`), `createUser` / `bearerFor`
  from `tests/helpers/user-factory.ts`, and an in-memory MongoDB. External services are mocked in
  `tests/setup/mock-external-services.ts`; inspect them with `email-outbox.ts`, `cloudinary-recorder.ts`, `gemini-recorder.ts` (Gemini is answered by a stubbed `fetch`).
- Frontend tests mock the feature's `api` module and render with `renderWithProviders` from `FE/src/test/render-with-providers.tsx` (`state` for the history state of the starting URL, `otherRoutes` with an element instead of a text to read the location after a redirect).
  Assert what the user sees (`getByRole`, `findByText`).
- Days and time zones: fix the clock by faking `Date` only (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`,
  then `vi.useRealTimers()` in `afterEach`), so HTTP, MongoDB and React Query keep their real timers and no test runs across
  a midnight (see `BE/tests/integration/profile-streak.test.ts`).

## Before you finish

Run `npm test`, `npm run lint` and `npm run build` from the root and fix every failure. Update the docs if a rule or a
shared helper changed (golden rule 7). Mention any step you could not run.
