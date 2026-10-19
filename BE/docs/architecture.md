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
  → utils/          app-error, pagination, jwt, hash, otp, vietnamese-errors
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
├── utils/               # app-error.ts, pagination.ts, jwt.ts, hash.ts, otp.ts, vietnamese-errors.ts (word error classifier, copy of the FE file)
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
Extend `paginationQuerySchema` (`page`, `limit ≤ 100`, `sort` like `-createdAt`) and declare the sortable fields with `sort: sortSchema(['createdAt', 'title'])` (anything else answers 400 — never list private fields). Return `paginate(Model, filter, query)` → `{ items, page, limit, total, totalPages }`. Ties are broken by `_id`, so pages never overlap. Escape user text before building a `RegExp` (see `note.service.ts`).

### 7b. Admin endpoints (`routes/admin.route.ts`)
All under `/api/admin`. **Guarded by `adminRouter.use(authGuard, requireRole('admin'))`: admins only, other accounts get 403.** Endpoints: `GET /stats`, `GET /users` (search `q`, filters `role`, `verified`, `status`, allowlisted `sort`, pagination), each user with `stats` (`{ wpm, accuracy }`, the average of their completed typing sessions; absent when there is none) and `logins` (`[{ date, sessions }]`: typing sessions per UTC day for the last 336 days), `GET|PATCH|DELETE /users/:id`, `PATCH /users/:id/status` (`{ status: 'active' | 'locked' }`; sets or clears `lockedAt`; locking yourself answers 400, locking an admin 403), `POST /users/bulk-delete` (`{ ids }`, `bulkIdsSchema`). Deleting a user also deletes their notes, typing sessions and avatar. The signed-in account can never remove its own admin role or delete itself (checked in `admin-user.service.ts`, keep it). Yes/no filters use `optionalBooleanQuerySchema` (missing = no filter).

**Passage bank** (`admin-passage.{validator,service,controller}.ts`, same router): `GET /passages` (search `q` in title and source, filters `status` and `isPlacement`, allowlisted `sort`, pagination), `POST /passages` (`{ title, content, source, isPlacement? }` → 201, always a `draft` owned by TypeTrace; a `status` in the body is ignored), `GET|PATCH|DELETE /passages/:id`, `PATCH /passages/:id/status` (`{ status }`). Status moves only `draft → published → archived` and `archived → published` (anything else answers 409). A placement passage (`isPlacement`) may be archived like any other, but it cannot be deleted (a placement test needs passages: archiving all of them makes `GET /api/placement` answer 404). `DELETE` is a hard delete and answers 409 for a passage that has typing sessions: archive it instead. Edits use `doc.save()` so `wordCount` and `tagCounts` are counted again. Learners only ever get `published` passages (`typing-session.service.ts`). `npm run import:passages` adds starter passages as `published` and moves old `active`/`inactive` passages to `published`/`archived`.

### 7c. Typing sessions (`/api/sessions`)
A learner types a passage from the `Passage` collection (`passage.model.ts`, filled by `npm run import:passages`). Files: `typing-session.{model,validator,service,controller,route}.ts`; word grading uses `utils/vietnamese-errors.ts`. Always owner-only: another user's session answers 404, even for admins.
- `POST /` `{ mode?, passageId? }` → 201. Picks the passage: the one in `passageId` (must be published and public, or the learner's own; else 400), a random published placement passage (`isPlacement`) in `placement` mode, otherwise a random published public practice passage (404 if there is none of the kind asked for). Copies the passage words into the session (`targetWords`) and turns the learner's older `in_progress` session into `abandoned`.
- `PATCH /:id/begin` → the learner pressed the first key: stores `beganAt` once (a second call keeps the first time; not in progress → 409). The timer starts here, not when the session was created.
- `PATCH /:id/complete` `{ typedWords }` → the server grades again with `classifyWord`, computes `wpm` (correct words per minute, duration measured by the server from `beganAt`, or from `startedAt` if `begin` was never called), `accuracy`, `errorCounts`, `opportunityCounts` and `isCounted` (at least 20 words, at most 200 WPM, and not longer than 3 minutes). A session lasts at most 3 minutes (`MAX_SESSION_MS`): a request that arrives within 5 seconds of the limit gets `durationMs` capped at 3:00; a later one is saved with its real duration but not counted. It ignores any total the client sends. Not in progress → 409; more words than the passage → 400.
- `PATCH /:id/abandon` (409 if not in progress), `GET /:id`, `GET /` (history, `status` filter, `sort` by `createdAt|wpm|accuracy`, pagination).

### 7d. Placement test (`/api/placement`)
Signed-in accounts only (`placementRouter.use(authGuard, requireRole('user', 'admin'))`). `GET /` → one of the published placement passages (`isPlacement: true`) at random, with public fields only: `{ _id, title, content, source, ownerName, wordCount }`, never `owner`. 404 `No placement passage` when there is none. The pick is `getPlacementPassage()` in `services/passage.service.ts`; its `samplePassage(match, fields)` also picks the passage of a new typing session.

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
