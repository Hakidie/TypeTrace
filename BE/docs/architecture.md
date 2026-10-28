# Backend Architecture & Conventions

> Instruction doc for AI agents and developers. Read this before adding or changing backend code. Follow these patterns exactly — do not introduce new architectural styles without reason. The reference feature is `notes` (`*/note.*`). This is a base project for students: keep code simple, reuse the helpers below, and update this file when a convention changes.

## Stack

- **Runtime**: Node.js + Express 5
- **Language**: TypeScript (strict mode, CommonJS output)
- **Database**: MongoDB via Mongoose 9
- **Auth**: JWT (Bearer token); optional email OTP at login, per user (`loginOtpEnabled`)
- **Validation**: Zod 4 (requests and environment)
- **Media**: Cloudinary (images via Multer memory storage), optional
- **Email**: Nodemailer (SMTP), printed to the console when SMTP is not configured
- **Security**: helmet, CORS locked to `CLIENT_URL`, rate limits · **Logging**: morgan
- **Dev**: `tsx watch` · **Build**: `tsc` → `build/` · **Start**: `node build/server.js` · **Test**: Vitest + supertest + mongodb-memory-server

## Layered (Clean) Architecture

Request flows strictly top-to-bottom. Never skip a layer or call upward.

```
HTTP request
  → routes/         endpoints + middleware chain
  → middlewares/    authGuard → requireRole → validate → (imageUpload)
  → controllers/    read req, call service, shape res
  → services/       queries, ownership rules, side effects (email, cloudinary)
  → models/         Mongoose schemas
  → config/         env, db, cloudinary clients
  → utils/          app-error, pagination, jwt, hash, otp, vietnamese-errors, passage-text
```

| Layer | Owns | Must NOT |
|-------|------|----------|
| `routes/` | URL + verb + middleware chain | contain logic |
| `controllers/` | req/res handling, status codes | contain queries beyond one trivial call; be reused |
| `services/` | queries, access rules, workflows, side effects | touch `req`/`res` |
| `models/` | schema, constraints, `toJSON` hiding private fields | contain HTTP concerns |
| `validators/` | Zod schemas + inferred input types | run queries |
| `middlewares/` | auth, roles, validation, upload, errors | contain feature logic |
| `utils/` | pure helpers | import services |
| `config/` | env parsing, clients | contain feature logic |

## Directory Map

```
src/
├── app.ts               # helmet, cors, json, morgan, rate limits, routers, 404, error handler
├── server.ts            # connectDb() → listen; graceful shutdown on SIGINT/SIGTERM
├── config/              # env.ts (Zod-validated), db.ts, cloudinary.ts (isCloudinaryConfigured)
├── models/              # user.model.ts, note.model.ts, typing-session.model.ts, passage.model.ts, word.model.ts
├── validators/          # common.validator.ts (idParamsSchema, objectIdSchema, booleanQuerySchema), <name>.validator.ts
├── services/            # <name>.service.ts, email.service.ts, cloudinary.service.ts
├── controllers/         # <name>.controller.ts
├── routes/              # <name>.route.ts — export <name>Router
├── middlewares/         # auth, role, validate, upload, not-found, error
├── utils/               # app-error.ts, pagination.ts, jwt.ts, hash.ts, otp.ts, vietnamese-errors.ts (word error classifier, copy of the FE file), passage-text.ts (cleans pasted passages, title search with optional accents)
├── scripts/seed.ts      # demo accounts (npm run seed)
└── types/express.d.ts   # req.user
```

## Naming Conventions

- Files: `kebab-case` with layer suffix — `note.controller.ts`, `lesson-plan.validator.ts`.
- Routers: `<feature>Router`. Models: `<Name>Model` + `<Name>Document`.
- Controllers: named exports, one per endpoint (`listNotes`, `createNote`).
- Validators: `<action>Schema` + inferred `<Action>Input` type.

## Core Patterns

### 1. Environment (`config/env.ts`)
All variables are parsed by one Zod schema; startup fails with a list of every invalid variable. In production `JWT_SECRET` must be ≥ 32 characters and not the example value. Add new variables to the schema and to `.env.example`. Never read `process.env` elsewhere.

### 2. Routes → middleware chain

```ts
noteRouter.use(authGuard, requireRole('user', 'admin'));          // all routes: signed in, role loaded
noteRouter.get('/', validate({ query: listNotesQuerySchema }), listNotes);
noteRouter.patch('/:id', validate({ params: idParamsSchema, body: updateNoteSchema }), updateNote);
profileRouter.post('/avatar', authGuard, imageUpload.single('avatar'), uploadAvatar);
```
Mount in `app.ts`: `app.use('/api/<plural>', <name>Router)` (before `notFoundHandler`). `npm run gen:module` does this for you.

### 3. Validation (`validate`)
`validate({ body?, query?, params? })` parses each part with Zod and replaces it with the parsed value, so `req.query.page` is a number. Failures answer `400 { message: 'Validation failed', errors: [{ field, message }] }`. `validateBody(schema)` is shorthand for `validate({ body: schema })`.

### 4. Auth and roles
- `authGuard` verifies `Authorization: Bearer <token>`, sets `req.user = { sub, email }` and reads the user's `status` from the database: a locked account answers 403 `Your account is locked`, also with a token issued before the lock (a token of a deleted user passes; the handlers answer 404). Login and Google login answer 403 for a locked account too (after the password check, so a wrong password stays 401).
- `requireRole(...roles)` loads the user's role from the database (so promotions apply without re-login), sets `req.user.role`, and answers 403 otherwise.
- Login: password check → if `user.loginOtpEnabled`, email an OTP (202 `{ requiresOtp }`), else return `{ token }`. Users toggle it with `PATCH /api/profile/security`.
- Google login (`POST /api/auth/google` `{ credential }`) answers `{ token, isNewUser }`: `isNewUser` is true when this login created the account (`findOrCreateGoogleUser`), and the app then asks the new learner to take the placement test, like after a registration (SCRUM-157).

### 5. Controllers — thin

```ts
const actorOf = (req: Request) => ({ id: req.user!.sub, role: req.user!.role });
export const updateNote = async (req: Request, res: Response) => {
  res.json(await noteService.updateNote(actorOf(req), req.params.id as string, req.body as UpdateNoteInput));
};
```
No try/catch: Express 5 forwards rejected promises to the error handler.

### 6. Services — queries and access rules

```ts
const accessFilter = (actor: Actor, id?: string) => ({ ...(id ? { _id: id } : {}), ...(isAdmin(actor) ? {} : { owner: actor.id }) });
export const updateNote = async (actor: Actor, id: string, input: UpdateNoteInput) => {
  const note = await NoteModel.findOneAndUpdate(accessFilter(actor, id), input, { new: true, runValidators: true });
  if (!note) throw notFound('Note not found');   // also for other users' notes: never reveal they exist
  return note;
};
```

### 7. Lists (`utils/pagination.ts`)
Extend `paginationQuerySchema` (`page`, `limit ≤ 100`, `sort` like `-createdAt`) and declare the sortable fields with `sort: sortSchema(['createdAt', 'title'])` (anything else answers 400 — never list private fields). Return `paginate(Model, filter, query)` → `{ items, page, limit, total, totalPages }`. Ties are broken by `_id`, so pages never overlap. Escape user text before building a `RegExp` (see `note.service.ts`). An optional fourth argument: `{ select: 'title wordCount' }` sends only those fields (use it when `toJSON` keeps a field this user may not see, like the `owner` of a passage) and `{ collation: { locale: 'vi' } }` sorts text in Vietnamese order (Đ right after D, not after Z); see `listPassages` in `passage.service.ts`. A query with a collation can only use the indexes that have the same collation: give it one (see the `{ locale: 'vi' }` index in `passage.model.ts`), or MongoDB reads the whole collection. `paginate` counts with the same collation, so that index serves the count as well as the page.

### 7b. Admin endpoints (`routes/admin.route.ts`)
All under `/api/admin`. **Guarded by `adminRouter.use(authGuard, requireRole('admin'))`: admins only, other accounts get 403.** Endpoints: `GET /stats`, `GET /users` (search `q`, filters `role`, `verified`, `status`, allowlisted `sort`, pagination), each user with `stats` (`{ wpm, accuracy }`, the average of their completed typing sessions; absent when there is none) and `sessions` (`[{ date, sessions }]`: completed typing sessions per UTC day of `completedAt` for the last 371 days; both from `typingActivityOf` in `typing-session.service.ts`, which also serves `GET /api/sessions/activity`, see 7c), `GET|PATCH|DELETE /users/:id`, `PATCH /users/:id/status` (`{ status: 'active' | 'locked' }`; sets or clears `lockedAt`; locking yourself answers 400, locking an admin 403), `POST /users/bulk-delete` (`{ ids }`, `bulkIdsSchema`). Deleting a user also deletes their notes, typing sessions and avatar. The signed-in account can never remove its own admin role or delete itself (checked in `admin-user.service.ts`, keep it). Yes/no filters use `optionalBooleanQuerySchema` (missing = no filter).

**Passage bank** (`admin-passage.{validator,service,controller}.ts`, same router): `GET /passages` (search `q` in title and source through `titleSearchPattern`, accents optional like the learner list, so `ha noi` finds `Hà Nội`; filters `status`, `visibility` and `isPlacement`, allowlisted `sort`, titles in Vietnamese order with the `{ locale: 'vi' }` collation (only for `sort=title|-title`: a query with a collation can only use the indexes with the same one), pagination; the admin page asks for `visibility=public`, so its bank holds TypeTrace's and the approved passages, never a learner's private one), `POST /passages` (`{ title, content, source, isPlacement? }` → 201, always a `draft` owned by TypeTrace; a `status` in the body is ignored), `GET|PATCH|DELETE /passages/:id`, `PATCH /passages/:id/status` (`{ status }`). `draft`, `published` and `archived` switch freely in any direction (the same status, `pending` and `rejected` answer 409; learners' requests are decided with approve / reject). A placement passage (`isPlacement`) may be archived like any other, but it cannot be deleted (a placement test needs passages: archiving all of them makes `GET /api/placement` answer 404). `DELETE` is a hard delete (the admin page offers it on archived passages that are not placement passages only, on the card and in the edit form, SCRUM-159) and answers 409 for a passage learners have typed (a session where the first key was pressed, `beganAt`, or a completed one: their history): archive it instead. The sessions only opened on it and never typed in (the Typing page starts one as soon as it shows a passage, abandoned when the learner opens another) do not count and are deleted with it. Edits use `doc.save()` so `wordCount` and `tagCounts` are counted again. Learners only ever get `published` passages (`typing-session.service.ts`), apart from their own passages waiting for review or turned down. `npm run import:passages` adds starter passages as `published` and moves old `active`/`inactive` passages to `published`/`archived`.

**Review of learners' passages** (SCRUM-176, same files and router): a learner asks for one of their private passages to become public (7e), which puts it in `pending`. The status endpoint never moves a passage into or out of `pending` or `rejected` (409): an admin answers with `PATCH /passages/:id/approve` (→ `published` and `public`, `reviewNote` cleared, so every learner can type it; `ownerName` becomes `publicOwnerName` of its owner as they are now: their display name, `ANONYMOUS_OWNER_NAME` = `Anonymous learner` without one, `TypeTrace` for an admin, never the email that `ownerFieldsFor` puts on a private passage of a learner without a display name, which only they and admins see) or `PATCH /passages/:id/reject` `{ reason }` (→ `rejected` and still `private`, the trimmed `reason` saved in `reviewNote`, 1 to `REVIEW_NOTE_MAX` = 300 characters; never `published`, so `?status=published` does not list it; the learner sees the reason, may still type and edit it, and may ask again). Both are one conditional update on `status: 'pending'`, so two admins (or an admin and the learner taking the request back) cannot both win: not pending → 409, unknown id → 404. `POST /passages/bulk-approve` `{ ids }` and `POST /passages/bulk-reject` `{ ids, reason }` change only the passages of `ids` still pending and answer `{ updated }` (bulk approve writes one conditional update per passage, each with its own author's public name). The review queue is `GET /passages?status=pending` (`q`, pages, `sort=updatedAt` = oldest request first: a request updates the passage; index `{ status, updatedAt }`), whose items carry the text and `ownerName`. **Edits of public passages** (a learner edited an approved passage, 7e) are in the same queue: `?status=pending` also lists the passages with a `pendingEdit` (`status` is still `published`, `visibility` `public`; the item carries `pendingEdit` next to the approved text). `approve` replaces `title`, `source` and `content` with the edit, counts `wordCount` and `tagCounts` again, and clears `pendingEdit` and `reviewNote`; `reject` drops the edit, keeps the approved text and saves the reason in `reviewNote` (the passage stays public). `?status=pending&edited=true` keeps only the edits and `edited=false` only the requests to make a passage public. Single and bulk decisions work on both kinds; each is one conditional update (an edit only if it is still the same edit that was read, so an edit sent again meanwhile is not approved unread), and the 409 / 404 rules are the same.

### 7c. Typing sessions (`/api/sessions`)
A learner types a passage from the `Passage` collection (`passage.model.ts`, filled by `npm run import:passages`). Files: `typing-session.{model,validator,service,controller,route}.ts`; word grading uses `utils/vietnamese-errors.ts`. Always owner-only: another user's session answers 404, even for admins.
- `POST /` `{ mode?, passageId? }` → 201; any other field (a `status`, a `visibility`) is ignored. Picks the passage: the one in `passageId` (must be in the list of its `mode` from `GET /api/passages`, see 7e, which also holds the learner's own passages waiting for review; else 400), a random published placement passage (`isPlacement`) in `placement` mode, otherwise a random published public practice passage (404 if there is none of the kind asked for). Copies the passage words (`targetWords`) and title (`passageTitle`) into the session and turns the learner's older `in_progress` session into `abandoned`.
- `PATCH /:id/begin` → the learner pressed the first key: stores `beganAt` once (a second call keeps the first time; not in progress → 409). The timer starts here, not when the session was created.
- `PATCH /:id/complete` `{ typedWords }` → the server grades again with `classifyWord`, computes `wpm` (correct words per minute, duration measured by the server from `beganAt`, or from `startedAt` if `begin` was never called), `accuracy`, `errorCounts`, `opportunityCounts` and `isCounted` (at least 20 words, at most 200 WPM, and not longer than 3 minutes). A session lasts at most 3 minutes (`MAX_SESSION_MS`): a request that arrives within 5 seconds of the limit gets `durationMs` capped at 3:00; a later one is saved with its real duration but not counted. It ignores any total the client sends. Not in progress → 409; more words than the passage → 400. Optional `typedAtMs` (SCRUM-187): one time per typed word, in ms after the first key, saved as `SessionWord.typedAtMs` (older sessions have none); the times must not go back, be negative or later than `durationMs` plus the 5 s grace (the clock starts at `begin`, which arrives a little after the first key), else 400, and the count must equal the number of words.
- `PATCH /:id/abandon` (409 if not in progress), `GET /:id`, `GET /` (history for the profile page, `status`, `mode` and `timeLimitSeconds` (seconds, 1-180) filters, `q` = text searched in `passageTitle` through `titleSearchPattern` (accents optional), `sort` by `createdAt|wpm|accuracy`, pagination; each item is a summary: `mode`, `passageTitle`, `status`, `wpm`, `accuracy`, `durationMs`, `timeLimitSeconds`, `isCounted`, the dates and the speed `timeline` (as in the stats, worked out from the words, which are read for it but never sent), never the `words` and `targetWords` that `GET /:id` has).
- `GET /:id/stats` → the numbers behind the result charts (SCRUM-186): `{ totalWords, correctWords, wrongWords, wrongRate, errorTypes: [{ type, errors, opportunities, rate }], isCounted }`, worked out again by `getSessionStats` from the graded `words` (`countErrors`), never from the stored totals; types without any opportunity are left out. plus `timeline: { status, points }` (SCRUM-187): `points` = `[{ second, wpm, errors }]` every second and at the end, over a sliding window of the last `TIMELINE_WINDOW_SECONDS` (10) seconds, from `typedAtMs` by `timelineOf` (WPM = correct words per minute of the window like `computeWpm`, cut at the start; `errors` = the wrong words among those finished in the window), so it shows the pace at that moment and the last point is no longer the session WPM; `status` is `no_data` (an older session without times), `too_short` (under 10 s) or `ok`. `timeLimitSeconds` = the time the learner chose (the page sends it with `complete`, 1-180, only to size the chart's time axis; 180 for a session without it). Both lines are computed by the server, nothing from the client. Owner only (another user, even an admin, 404); a session that is not `completed` answers 409.
- `GET /activity` → the learner's own `{ stats?, sessions }` for their profile page (SCRUM-157), the same numbers as their row in the admin user list (`typingActivityOf`): `stats` = `{ wpm, accuracy }`, the averages of their completed sessions (absent before the first one), `sessions` = their completed sessions per UTC day of the last `HEATMAP_DAYS` (371) days. Declared before `GET /:id`, which would take `activity` for an id.

### 7d. Placement test (`/api/placement`)
Signed-in accounts only (`placementRouter.use(authGuard, requireRole('user', 'admin'))`). `GET /` → one of the published placement passages (`isPlacement: true`) at random, with public fields only: `{ _id, title, content, source, ownerName, wordCount }`, never `owner`. 404 `No placement passage` when there is none. The pick is `getPlacementPassage()` in `services/passage.service.ts`; its `samplePassage(match, fields)` also picks the passage of a new typing session.


### 7e. Passages to choose from (`/api/passages`)
Signed-in accounts only (`passageRouter.use(authGuard, requireRole('user', 'admin'))`). Files: `passage.{validator,service,controller,route}.ts`.
- Language: every passage has `language` (`vi` default, `en`). English passages are for ranked duels only: every learner flow (this list, `POST /api/sessions` with or without `passageId`, `GET /api/placement`) adds `notEnglish` from `passage.model.ts` (`language: { $ne: 'en' }`, so passages saved before the field still count as Vietnamese). English passages have no error tags (`tagCounts` all 0). Learners cannot set the language: their own passages are always Vietnamese.
- `GET /?mode=practice|placement` (default `practice`) → a page `{ items: [{ _id, title, source, wordCount, ownerName, visibility, status, reviewNote?, isOwn, createdAt }], page, limit, total, totalPages }`, never the text or `owner` (`paginate` with `select`; `owner` is only read to work out `isOwn`, and `reviewNote` only goes to the owner). Filters: `q` (searched in the title through `titleSearchPattern` in `utils/passage-text.ts`: case-insensitive, a letter typed without its marks finds every accented form, so `ha noi` finds `Hà Nội` and `duong` finds `Đường`, a letter typed with them only finds itself, anything else is taken literally; composed Unicode (NFC) like the saved titles), `visibility` (`private` = only the learner's own private passages, `public` = only the public ones: TypeTrace's and the learners' passages an admin approved), `mine` (`true` = only the learner's own passages, private or approved; `false` = only the others), `sort` by `title` (the default, Vietnamese order through a collation; the index with the same collation in `passage.model.ts` keeps the query from reading every learner's private passages), `createdAt` or `wordCount`, `page`, `limit` (≤ 100). `learnerPassageFilter(userId, mode)` decides what a learner may pick: `placement` = published, public placement passages; `practice` = non-placement passages that are published and public, plus the owner exception: the learner's own passages that are `published`, `pending` (waiting for review, SCRUM-176) or `rejected` (turned down), which only their owner may type. Drafts, archived passages and other people's private passages never match, whatever the filters (they are added with `$and`). The same filter checks the `passageId` of `POST /api/sessions`, so a passage of the other mode answers 400. The Typing page shows the first 100 in the menu of the passage name (TypeTrace's and the learner's own); the Passages page shows only the learner's own (`mine=true`) with pages.
- `POST /` `{ title, source?, content }` → 201 with a list item: a learner's own passage, `private`, `published` at once (so it can be typed), never a placement passage, `source` = where the text comes from (a book, a website, their own; optional: missing or empty once cleaned it is saved as the author's `publicOwnerName` (display name, else `ANONYMOUS_OWNER_NAME`, never the email; also when an update empties it); admins check it before the passage can become public), `ownerName` from `ownerFieldsFor` (their display name, else their email; `TypeTrace` for an admin). Any other field in the body is ignored. The validator first cleans the three fields with `cleanPassageText` (`utils/passage-text.ts`: Unicode NFC, HTML tags and hidden characters such as zero-width spaces removed, typographic quotes, dashes and `…` turned into keyboard ones, white space and line breaks into single spaces), then checks what is left: all three are required (a title or source made only of spaces, tags or hidden characters is empty once cleaned: `Title is required`, `Source is required`); content of at least `MIN_USER_PASSAGE_WORDS` (20) words, so its sessions can count, and at most `MAX_PASSAGE_WORDS` (200) words and 5000 characters (the admin bank has the same two maximums); title at most 120; source at most 300. At most `MAX_USER_PASSAGES` (20) own passages per learner (400); only the ones they can type count (their private passages, published, waiting for review or turned down, the same as the list with `visibility=private`), so one an admin archived or made public does not take a place. The passages of one learner are saved one at a time (`oneAtATime` in the service), so requests sent at the same time cannot all take the last place: exactly one gets it. That queue only covers one server, so the count is also checked again after saving, and the new passage is taken back (400) when requests on several servers went over.
- `GET /:id` → one of the learner's own passages (published, waiting for review or turned down, private or approved) as a list item plus its `source` and `content`, to edit it; another user's, a TypeTrace or an archived passage answers 404.
- `PATCH /:id` `{ title?, source?, content? }` → 200 with the list item: edits an own private `published` or `rejected` (turned down) passage, which keeps its status and reason, each field sent cleaned and checked like a new one (`updatePassageSchema`: the title and the source cannot become empty; an empty body, or one with only fields a learner may not send such as `status`, answers 400). `wordCount` and `tagCounts` are counted again when the text changes (`computePassageStats`). Waiting for review (take the request back first) → 409; not theirs → 404. One conditional update on those two statuses, so a request to make it public sent at the same time cannot let the text change under review. **An own public (approved) passage can be edited too, but the edit waits for an admin**: it is saved as `pendingEdit` `{ title, source, content }` (fields left out come from the earlier edit, else from the passage; `proposeEdit`), the approved text stays public and typeable meanwhile, the passage keeps `published` + `public`, `updatedAt` moves (it queues behind the others), an earlier `reviewNote` (a refused edit) is cleared, and the list item gets `editPending: true`. A second edit replaces the first; `GET /:id` opens the passage with its edit. Typing sessions keep their copy of the old words.
- `DELETE /:id` → 204, a hard delete of one of the learner's own private passages, also while it waits for review; another user's passage or a TypeTrace one answers 404, even to an admin (admins use `/api/admin/passages`), and an own passage an admin made public answers 409 (only an admin can remove it). Typing sessions keep their copy of the words and the title, so the history stays; the passage cannot be started again (400).
- `POST /:id/publish-request` → 200 with the list item: the learner asks for their own private `published` passage to become public (SCRUM-176), or asks again for a `rejected` one. It becomes `pending` (still private, still typeable by them) and an earlier `reviewNote` is cleared. No body is read, so a `status` or `visibility` sent along changes nothing: only an admin makes a passage public. Already pending or already public → 409; not theirs → 404. `DELETE /:id/publish-request` → 200: takes the request back (`pending` → `published`), or drops the waiting edit of a public passage (the approved text stays); nothing waiting → 409. Both are one conditional update, like the admin's decision (see 7b).

### 7f. Themes (`/api/themes`)
Signed-in accounts only (`themeRouter.use(authGuard)`). A `Theme` (`theme.model.ts`) has `name` (≤30, unique per owner ignoring case through `nameLower`), `colors` (`background`, `text`, `muted`, `accent`, `#rrggbb`), `isDark`, `owner`, `ownerName` and `published`. TypeTrace themes are `published` (made by `npm run import:themes` from `src/data/themes.ts`, no owner, safe to run many times); a learner's themes are private. Blood red (dark) and Sand (light) are the fallbacks of each mode in the frontend CSS, not rows.
- `GET /?isDark=` → an array (not paginated: published themes plus at most 9 own), published first, then by name. Never `owner` or `nameLower`.
- `POST /` `{ name, colors }` → 201, private. `PATCH /:id` `{ name?, colors? }`, `DELETE /:id` → 204. Only the user's own private themes; another user's or a published theme answers 404.
- Rules in `theme.service.ts` and `theme.validator.ts`: at most `MAX_USER_THEMES` (9) private themes per user (400), a taken name answers 409, `isDark` comes from the background (`isDarkBackground`). A new theme must fit the mode in use (`settings.mode`); recoloring cannot change a theme's mode. Colors must be readable (`contrastProblems` in `utils/theme-colors.ts`: text 4.5, muted text 3, accent 3 against the background, else 400 with one error per color). The frontend has the same functions in `FE/src/modules/settings/lib/contrast.ts`: keep them in sync.
- The user keeps `settings: { mode, darkTheme, lightTheme }` (`null` = the fallback). `GET /active` → `{ mode, dark, light }` with the theme objects; a theme that was deleted or is no longer allowed is answered as `null`. `PATCH /active` `{ mode?, darkTheme?, lightTheme? }` (ids or `null`) only accepts a published or own theme of the matching kind (else 404). Deleting a theme puts the fallback back in the mode that used it.

**Admin themes** (`admin-theme.{validator,service,controller}.ts`, the admin router): `GET /api/admin/themes` (search `q` in the name, filter `isDark`, `sort` by `createdAt`, `updatedAt` or `name` (case-insensitive), pagination; only published TypeTrace themes, never a learner's private theme), `POST` (`{ name, mode: 'dark' | 'light', colors }` → 201, published, shown as TypeTrace, no owner; the background must fit the mode, names are unique among TypeTrace themes: 409), `PATCH /:id` (`{ name?, colors? }`; recoloring cannot change the mode), `DELETE /:id` (also clears the theme from every user's `darkTheme` / `lightTheme`, so they fall back to Blood red or Sand). Same contrast rules as `/api/themes`.

### 7h. Ranked duels (`/api/matches`, ranked duel design phase 3)
Signed-in accounts only. Files: `match.model.ts`, `match.{validator,controller,route}.ts`, `services/match.service.ts` (rules), `services/match-view.ts` (room codes, `pickRankedPassage`, `toPublicMatch`) and `services/match-hub.ts` (live part). The `Match` document is the truth; the hub keeps the open SSE streams and the timers (countdown, time limit, disconnect grace, closing the streams of a finished room) per room code, in memory, so the backend must run as one process (see the `ponytail` note there). Every change of a room goes through `withMatchLock(code, ...)`, so two players finishing at the same moment cannot both win. Durations are in `matchSettings` (tests shorten them, `resetMatchHub()` puts them back).
- Room: `POST /` creates a `waiting` room (6-character code without `0 O 1 I`, unique among open rooms by a partial unique index; a random published public English passage of 30–80 words, 404 without one); `POST /:code/join` (any case; 400 own room, 409 full or already in another open room); `GET /:code` and `GET /:code/events` only for its players (others 404); `POST /:code/leave` (guest leaves, or host cancels; during a match the leaver forfeits). A waiting room older than 10 minutes is cancelled when it is next read. Players are shown by display name or `Anonymous player`, never the email; the passage words only once the countdown starts; typed words never leave the server.
- Race: `POST /:code/ready { ready }`; both ready → `countdown` (3 s, `countdown` event) → `running` (`startedAt` by the server clock, time limit `MAX_SESSION_MS`). `POST /:code/progress { typedWords, typedAtMs, done }` sends everything typed so far; the server grades it with `gradeWords`, streams `progress` (counts only) and applies the rules: a finisher with ≥ 90% correct wins at once; under 90% waits for the other; both under 90% or time up → more correct words wins, equal is a draw; over `MAX_COUNTED_WPM` loses and flags the match. 400 when progress goes back by more than one word, times go down or past the limit, or `done` comes early; 409 when the match is not running or the player already finished. `POST /:code/rematch` after the end opens a new room and sends a `rematch` event with its code on the old stream.
- Streams: `text/event-stream` with `state`, `countdown`, `progress`, `result`, `rematch` events and a ping every 15 s; the client reads it with `fetch` and the `Authorization` header (never a token in the URL). A player whose stream stays closed 15 s during a match forfeits; reopening it in time cancels that. Progress has its own limit (20 a second per player) and skips the global one.

### 7i. Elo and seasons (`/api/ranked`, `/api/admin/seasons`, ranked duel design phase 5)
Files: `season.model.ts`, `season-rating.model.ts`, `services/season.service.ts` (seasons, tiers), `services/rating.service.ts` (Elo), `services/ranked.service.ts` (API), `ranked.{validator,controller,route}.ts`.
- Seasons: 8 weeks; exactly one `active` (partial unique index). No background job: `currentSeason()` opens season 1 the first time one is needed and closes a season past `endsAt` on the next request; `closeSeason(id)` (also the admin's early close) opens the next one. The soft reset is lazy as well: `startRatingFor(user, season)` starts a player at `round(1000 + (rating − 1000) / 2)` of their rating in the season before (1000 without one) when their first match of the new season is rated, and `/me` shows that start before it. Each season has a `rewardItem` (the next of `SEASON_ITEMS` in `avatar-catalog.ts`). On close (phase 6) every player who reached Gold gets the items of their peak tier and every tier under it (`TIER_REWARDS`, cumulative) plus the season item; an item already owned pays its price, or `OWNED_REWARD_COINS` (100) for an item not sold. `SeasonRating.rewardedAt` is claimed first, so a player is rewarded once.
- Coins (phase 6): a rated match gives win 20, draw 10, loss or forfeit 5 (`MATCH_COINS` in `rating.service.ts`), at most `DAILY_COIN_LIMIT` (200) a day in Vietnam time; what was earned is kept on the match player (`coins`, shown on the result), so the daily total is summed from the matches.
- Elo: every place in `match.service.ts` that can finish a match calls `rateMatch(match)` before saving it. It settles the match once in the current season (an atomic claim on `match.season`, so two requests ending the same stale race rate it once): `E = 1 / (1 + 10^((Ro − R) / 400))`, `R' = round(R + K × (S − E))`, K 40 for a player's first 10 matches of the season then 32, S 1 / 0.5 / 0 (forfeit 0). Not rated (`rated: false`, `unratedReason`): `not-started` (left during the countdown), `flagged` (WPM cap), `pair-limit` (the two players already have 3 rated matches since 0:00 Vietnam time, UTC+7). Players get `ratingBefore` / `ratingAfter`.
- `GET /api/ranked/me`: season, rating (1000 before the first rated match), peak, tier, counts. `GET /api/ranked/leaderboard`: `paginate` over the season's ratings with 5 matches or more, best first, with rank, display name (or `Anonymous player`), avatar, tier, win rate; never an email. Tiers (`tierFor`): Bronze < 1100 ≤ Silver < 1250 ≤ Gold < 1400 ≤ Platinum < 1550 ≤ Diamond < 1700 ≤ Legend.
- Admin: `GET /api/admin/seasons` (newest first) and `POST /api/admin/seasons/:id/close` (answers the new active season; closing a closed one changes nothing). There is no "open season": closing opens the next.

### 7g. Avatar (`/api/avatar`, ranked duel design)
Signed-in accounts only. Files: `avatar.{validator,service,controller,route}.ts`, `data/avatar-catalog.ts` (prices and rules) and the generated `data/avatar-items.ts` (every item by slot; run `node minigame-sprites/build-layers.mjs`, never edit it by hand). `User` has `avatar` (the look: `skin, face, hair, top, bottom, shoes` and the optional `headwear, accessory, back, effect`, `null` = empty; defaults `DEFAULT_AVATAR`, also for accounts saved before the field), `ownedItems` (`slot:item`, bought or won items only) and `coins`. `unlockOf(slot, item)` says how an item is unlocked: `free` (starter items), `shop` (a price in coins, by slot), `tier` (a season tier reward, never sold) or `season` (the item of a season, never sold), `undefined` for an item the slot does not have. `POST /buy { item: 'slot:item' }` buys a `shop` item and answers the catalog: one conditional update (`coins >= price` and not owned) spends and adds it, so two buys at once never go below zero or buy twice; 400 `This item is not sold` / `Not enough coins` / `Unknown item`, 409 `You already own this item`. `GET /catalog` → `{ avatar, coins, slots: { [slot]: [{ id, unlock, owned }] } }`; `PUT /` with a whole look → the user, 400 `Unknown item: <slot> <item>` or `Item not owned: <slot> <item>` (nothing saved). Only the account itself sees its `coins` and `ownedItems` (`/me`, the catalog); no learner endpoint returns another user.

### 8. Errors (`utils/app-error.ts` + `errorMiddleware`)
Throw `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict` or `new AppError(status, message, details?)`. The error middleware also maps: malformed JSON body → 400, JSON body over 100 kB → 413, `ZodError` → 400, Multer file too large → 413, other Multer errors → 400, invalid ObjectId → 400, Mongoose validation → 400, duplicate key → 409. Anything else → `500 { message: 'Internal server error' }` (stack logged on the server, included in the body only in development). Unknown routes → `404 { message: 'Route not found: ...' }`.

### 9. Models
`<Name>Document` interface + `Schema`, `{ timestamps: true }`, DB constraints (`required`, `maxlength`, `enum`), indexes for the default list query, and a `toJSON` transform that removes `__v` and any private field. The User model strips `password`, `otpCode`, `otpExpiresAt`, `resetToken`, `resetTokenExpiresAt` in `toJSON`, so returning a user **document** is safe. `.lean()` and `aggregate()` return plain objects that skip `toJSON`: with those, `.select()` / `$project` the public fields explicitly.

### 10. External services
- Email: `sendEmail(to, subject, html)`. Without `SMTP_HOST`, mail goes to nodemailer's JSON transport and is printed to the console in development; in production it throws `AppError(503)` so codes never reach the logs.
- AI: `generateChatReply(messages)` in `services/ai.service.ts` calls Google Gemini through `@google/genai` with the system prompt and thinking level (default `LOW`) from `config/chatbot.ts`; default model `gemini-3.5-flash-lite`. Without `GEMINI_API_KEY` it throws `AppError(503)`; Gemini 429 → 429, bad key/model → 503, other failures → 502. `POST /api/chat` adds `authGuard` and a per-user limit of 10 requests per minute.
- Images: `uploadImage(buffer, folder)` / `deleteImage(publicId)`. Without Cloudinary variables, upload throws `AppError(503)` and delete is a no-op. Store the returned `publicId` to delete the image later.

## HTTP Response Conventions

| Situation | Status | Body |
|-----------|--------|------|
| Read / update | 200 | the resource |
| List | 200 | `{ items, page, limit, total, totalPages }` |
| Create | 201 | the created resource (auth register: `{ message }`) |
| Delete | 204 | empty |
| Login OTP step | 202 | `{ message, requiresOtp, email }` |
| Validation error | 400 | `{ message, errors: [{ field, message }] }` |
| Unauthorized / forbidden | 401 / 403 | `{ message }` |
| Not found (incl. other users' resources) | 404 | `{ message }` |
| Conflict | 409 | `{ message }` |
| File too large | 413 | `{ message }` |
| Too many requests | 429 | `{ message }` |
| Service not configured | 503 | `{ message }` |
| Server error | 500 | `{ message }` |

All API routes are under `/api`. Health check: `GET /health` → `{ ok: true }`.

## Security Rules

- Private fields are removed by the model's `toJSON`; add new private fields to `PRIVATE_USER_FIELDS` (or the model's own transform).
- Passwords hashed with bcrypt (`utils/hash`). OTP and reset codes are single-use. **Do not change the OTP functions** (`utils/otp.ts`, `createUserWithOtp`, `issueOtpForUser`, `issueResetToken`, OTP/reset handlers).
- Rate limits: 300 req / 15 min globally, 20 req / 15 min on `/api/auth/*` except `/me` (both off in tests). Behind a reverse proxy set `TRUST_PROXY=1` (number of proxies) so limits apply per client, not per proxy.
- `npm run seed` refuses to run with `NODE_ENV=production` (the demo admin has a public password).
- Ownership checks live in services; other users' resources answer 404.
- Uploads: memory storage, 5 MB, JPEG/PNG/WebP/GIF only (`imageUpload`).

## Testing

- `tests/unit` — pure functions and middlewares. `tests/integration` — real app over HTTP with an in-memory MongoDB.
  The mongod binary is downloaded once in `tests/setup/download-mongod.ts` (Vitest `globalSetup`) before the parallel workers start; each file then starts its own mongod.
- Use `api()` from `tests/helpers/api.ts` (binds to 127.0.0.1; `request(app)` can hit other local servers on macOS). For a custom router use `serve(app)`.
- `createUser({ role, loginOtpEnabled, ... })` + `bearerFor(user)` from `tests/helpers/user-factory.ts`. Emails: `tests/helpers/email-outbox.ts`; Cloudinary: `tests/helpers/cloudinary-recorder.ts`.
- See `tests/integration/notes.test.ts` for CRUD, ownership, pagination and validation cases.

## Playbook: Add a New Feature Endpoint

1. `npm run gen:module -- <name>` from the repository root (copies `notes`, registers the router), then change the fields. Or by hand:
2. **Model** — `models/<name>.model.ts` (constraints, indexes, `toJSON`).
3. **Validator** — create / update / list-query schemas in `validators/<name>.validator.ts`.
4. **Service** — queries with `accessFilter`, `paginate`, `throw notFound(...)`.
5. **Controller** — thin handlers; 201 on create, 204 on delete.
6. **Route** — `authGuard`, `requireRole`, `validate` per endpoint; mount in `app.ts`.
7. **Env** — new variables in `config/env.ts` and `.env.example`.
8. **Tests** — integration test like `notes.test.ts`.
9. **Verify** — `npm test` and `npm run build`.

## Do / Don't

- ✅ Keep controllers thin; put queries and access rules in services.
- ✅ Validate body, query and params with `validate`.
- ✅ Throw `AppError` helpers for expected failures.
- ✅ Use `paginate` for every list.
- ❌ Don't send error responses by hand or wrap handlers in try/catch.
- ❌ Don't read `process.env` outside `config/env.ts`.
- ❌ Don't return documents with private fields that `toJSON` does not strip.
- ❌ Don't add new top-level folders without a clear layer justification.
