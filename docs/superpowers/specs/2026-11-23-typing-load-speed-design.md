# SCRUM-236: faster passage load on the Typing page

## Why
The passage shows only after `OPTIONS` (CORS), `me` and `POST /api/sessions`. Target: under 1 s on a normal network, first open with JS cached.

## Goals
- The browser caches the CORS preflight (`maxAge`).
- `POST /api/sessions` does less work one after another.
- The FE sends `me` and `POST sessions` at the same time (verified, changed only if found sequential).

## Non-goals
Route code splitting, same-domain `/api` rewrite, vendor splitting. Old behaviour stays: a running session becomes `abandoned` when a new one starts, an invalid passage still answers an error (and then leaves the old session running), the server grades with the stored `targetWords`.

## Approaches
One sensible way: the three parts are independent, and each is the smallest change that removes a wait. A bigger rewrite (rewrite `/api`, split code) is out of scope.

## Design
1. `BE/src/app.ts`: `cors({ origin, maxAge: 86400 })`; test the `Access-Control-Max-Age` header.
2. `startSession` (`typing-session.service.ts`): in `pickPassage` read the plan and the locked passages together; in `startSession` start the content pick without waiting for other reads; the `updateMany` of old sessions still runs only after the content is picked, so a refused passage keeps the old session. Tests: abandoned old session, invalid passage keeps the old one, stored `targetWords`.
3. FE: a test that `me` and `POST sessions` are requested without one waiting for the other; change code only if not.

## Left to the builder
Exact parallel grouping in `pickPassage`; the real timing is measured on the deployed app, not locally.
