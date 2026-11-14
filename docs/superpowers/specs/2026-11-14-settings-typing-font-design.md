# SCRUM-158: Settings, typing font size and app font (design)

## Intent

A learner personalizes TypeTrace in `/settings`: the size of the passage text while typing, and the font of the whole
interface. This replaces the "daily reminder" part of SCRUM-158 (Notifications panel, SCRUM-169), which is dropped.
Purpose is personalization only, not accessibility.

## Goals

- **Typing tab:** passage font size in rem, 1 to 2.5 in steps of 0.125, default 2 (today's `text-[2rem]`), with a preview.
  Applies to the typing page (`PassageView` in `TypingArea`) and the replay; the 3-line height and the scroll position
  follow the size.
- **Font tab:** pick the font of the whole interface from five fonts, each row shown in its own font. The choice applies at
  once and is saved on the account.
- Both are saved per user in `User.settings` and read back with `GET /api/profile/settings`.

## Non-goals

- No reminder, no email, no notification settings.
- No font upload, no free font names, no separate font for the passage.
- The font size setting does not scale the rest of the interface.
- `font-mono` in the Rain, Ranked duel and practice duel screens stays as it is.
- The pixel avatar and mascot art are not affected.

## Constraints

- Every font must have the Vietnamese character set (checked when its package is added).
- Follow AGENTS.md: Zod validation, `authGuard`, no `process.env` outside `config/env.ts`, tests for BE and FE,
  `npm test`, `npm run lint`, `npm run build` pass, `AGENTS.md` and both `docs/architecture.md` updated.
- `PATCH /api/profile/settings` keeps `timezone` and `typingLanguage` working; it must not touch the theme fields.
- The font list lives in one place on each side, with the ids identical (BE enum, FE list).

## Approaches considered

- **A. Self-hosted `@fontsource` packages (chosen):** works offline, no third party, files load only when the font is
  chosen. Cost: new npm packages (the project has no other tool for fonts).
- B. Google Fonts `<link>` on choice: no packages, but calls Google, hurts privacy, and tests and offline have no font.
- C. System fonts only: nothing to download, but looks different on every OS and gives little choice.

## Design

**Fonts (my call, user may change):** `inter` (default), `be-vietnam-pro`, `lexend`, `noto-serif`, `jetbrains-mono`.

**Backend**
- `User.settings` gets `typingFontSizeRem` (Number, default 2) and `fontFamily` (enum of the five ids, default `inter`).
  Accounts without them read the defaults.
- `GET /api/profile/settings` (new, `authGuard`) answers `{ timezone, typingLanguage, typingFontSizeRem, fontFamily }`
  with defaults filled in.
- `PATCH /api/profile/settings` accepts any of the four fields, at least one (the refine message changes from
  "time zone or typing language"); `typingFontSizeRem` is checked for range and 0.125 step, `fontFamily` against the
  enum; invalid gives 400, no token gives 401. It saves with `$set` per field and keeps answering with the user as now.

**Frontend**
- `settings/lib/fonts.ts`: the list (id, label, CSS stack with a fallback, a loader that imports the package's
  Vietnamese and Latin CSS). `settings/hooks/use-settings.ts`: `useSettings` (GET) and save mutations that update the
  cached user.
- A widget in `settings.module.ts` applies the chosen font: loads its CSS, sets `--app-font` on `<html>`;
  `index.css` body uses `var(--app-font, Inter, Arial, sans-serif)`. The choice is also cached in `localStorage`
  (inside try/catch, a per-viewer convenience only) so a reload does not flash the old font.
- `SettingsPage` gets two tabs, Typing and Font, built like the existing tabs, with `LoadingState` and `ErrorState`.
- `PassageView` gets `fontSizeRem` (default 2): the font size, the line height and gap (`LINE_REM`, `GAP_REM`) and the
  caret height are computed from it. Other users of `PassageView` (login demo, dialogs, result page) keep the default.
  `TypingArea` and `ReplayPlayer` pass the learner's value.

**Tests:** BE integration (defaults, partial update, 400 on bad rem or font, 401, theme fields untouched, old
`timezone`/`typingLanguage` still work); FE (settings tabs save, API error, defaults; `PassageView` at another size
keeps its 3-row height and scroll).

## Left to the builder

The control for the size (slider or stepper), exact spacing, how the Font tab rows look, the name of the CSS variable,
and the exact `@fontsource` packages and weights (regular and bold used by the app today).

## Outside the code

Jira SCRUM-158 and SCRUM-169 still describe reminders and say font choice is out of scope; the user updates them.
