# MERN Student Base (TypeScript)

A starter for student projects: authentication, profile, image upload, and a complete example feature
(`notes`) ready to copy. It is built to be extended with AI tools such as Google Antigravity.

- `BE/` — Node.js + Express 5 + MongoDB (Mongoose) + Zod
- `FE/` — React 19 + Vite + TanStack Query + shadcn/ui + Tailwind CSS 4
- `shared/` — `@typetrace/shared`, code used by both apps (rules, constants, pure functions)

Hướng dẫn tiếng Việt cho học sinh: **[docs/vibe-coding-guide.md](docs/vibe-coding-guide.md)**.
Instructions for AI agents: **[AGENTS.md](AGENTS.md)**.

## Quick start

Requires Node.js 22.12+ and Docker (or any MongoDB, e.g. Atlas: set `MONGO_URI` in `BE/.env`).

```bash
npm run setup          # install dependencies, create BE/.env and FE/.env
docker compose up -d   # start MongoDB
npm run seed           # demo@example.com / demo1234, admin@example.com / admin1234, 12 sample students
npm run dev            # backend http://localhost:5003, frontend http://localhost:5173
```

No email or Cloudinary account is needed to start:

- Without `SMTP_HOST`, emails (OTP and reset codes) are printed in the backend terminal.
- Without `CLOUDINARY_*`, image upload answers 503; everything else works.
- Without `GEMINI_API_KEY`, the chat popup explains that it is not configured; everything else works.

## Features

- Register with email OTP verification, login, forgot / reset password
- Optional email code at login, off by default, toggled per user on **Profile → Security**
- Profile editing and avatar upload (Cloudinary)
- Roles (`user`, `admin`) with `requireRole` on the backend and role-gated routes on the frontend
- `notes` reference module: paginated list, search, tag filter, create / edit / delete, owner-only access, admin view of all notes
- Admin area (`/admin`, admins only): sidebar layout, dashboard with stats, user management (search, filters, sortable
  table, pagination, edit role / verification, delete, bulk delete) built from reusable `DataTable`, `SearchInput`,
  `FilterSelect` and `StatCard` components
- Sample AI chat bot on Google Gemini's free tier, as a floating button in the bottom-right corner that opens a chat popup: set `GEMINI_API_KEY` in `BE/.env`
  (free key at https://aistudio.google.com/apikey), customize it in `BE/src/config/chatbot.ts` and `FE/src/modules/chat/chat.config.ts`

## Add a feature

```bash
npm run gen:module -- product            # BE model/validator/service/controller/route + FE module + tests
npm run gen:module -- product --remove   # undo
```

Then change the example fields (`title`, `content`, `tags`). Step-by-step instructions are in [AGENTS.md](AGENTS.md#adding-a-feature-follow-these-steps-in-order).

## Scripts (repository root)

| Script | Description |
|---|---|
| `npm run setup` | Install dependencies of all workspaces (`shared`, `BE`, `FE`) with one `npm install`; create `.env` files from the examples |
| `npm run dev` | Run backend and frontend together (and rebuild `shared/` on change) |
| `npm run seed` | Create demo accounts (safe to run again) |
| `npm test` | Shared package tests, backend tests (Vitest + in-memory MongoDB), then frontend tests (Vitest + Testing Library) |
| `npm run lint` | ESLint on the frontend |
| `npm run build` | Typecheck and build both apps |
| `npm run gen:module -- <name>` | Scaffold a feature from the `notes` module |

Each app also has its own scripts (`cd BE && npm run dev`, `cd FE && npm run test:watch`, ...).

The repository is an npm workspace with a single `package-lock.json` at the root. Add a dependency to one app with
`npm install <package> -w BE` (or `-w FE`). Code needed by both apps goes in `shared/`: see
[AGENTS.md](AGENTS.md#shared-code-be--fe). On Vercel, keep each project's Root Directory (`BE` or `FE`) and keep
the Root Directory setting that lets the build use files outside it (on by default), so it can read `shared/` and the root lockfile.

## Project layout

```
AGENTS.md                  conventions for AI agents (CLAUDE.md imports it)
.agents/workflows/         Antigravity workflows: /new-module, /check
docs/vibe-coding-guide.md  student guide (Vietnamese)
docs/spikes/               technical spikes, e.g. how Vietnamese IMEs send input events
shared/                    @typetrace/shared: code used by both BE and FE (src/, tests/, built to dist/)
scripts/                   setup and module generator
BE/src/                    config, models, validators, services, controllers, routes, middlewares, utils
BE/tests/                  unit and integration tests
FE/src/app/                module registry (routes + navigation)
FE/src/modules/            one folder per feature: auth, home, notes, profile
FE/src/shared/             http client, query client, shared components and hooks
```

Conventions: [BE/docs/architecture.md](BE/docs/architecture.md), [FE/docs/architecture.md](FE/docs/architecture.md).

## Tests and CI

Backend integration tests run the real app against an in-memory MongoDB; SMTP and Cloudinary are replaced by
in-memory recorders. Every push and pull request runs tests, lint, typecheck and a generator smoke test on
GitHub Actions (`.github/workflows/ci.yml`).
