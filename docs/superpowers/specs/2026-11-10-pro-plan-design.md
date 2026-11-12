# Pro plan (paid with VNPay) — design

> **Update (2026-11-13):** Pro was merged into the Premium plan of US11.1. A Pro purchase is now a paid Premium term (`recordPaidMonth`, a `Subscription` row); `User.proUntil` is gone, the items are `PREMIUM_ITEMS` (`Unlock` kind `premium`), and the prices follow the Premium price an admin sets. See the Payments part of AGENTS.md.

## Why
The VNPay API is done (PR #55) but nothing can be bought yet. The first thing to sell is a **Pro plan** made of things
learners want to show off and use every week, not of speed: the ranked duel design keeps real money out of the rating
(its non-goals), so Pro never changes a rating, a word list or a duel.

What makes it worth the money (what the user asked for):
1. **The Dragon set** (was the Neon set): four avatar items nobody else can get (dragon horns, a dragon scarf, dragon wings, a flying baby dragon pet with embers), kept for as long as Pro lasts.
2. **See it before paying**: the Pro screen shows the learner's own avatar wearing the set, with each item on or off.
3. **Ping's weekly report**: a short coaching note made from the learner's own error profile and sessions (phase B).
4. A **Pro badge** beside the name.

## Decisions (defaults the user can change)
| Topic | Decision |
|---|---|
| Billing | **Prepaid time**, not a subscription: VNPay (this integration) charges once. 1, 6 or 12 months; buying while Pro adds time after the current end. No cancel flow, no failed renewals. |
| Prices | 1 month 49.000 ₫, 6 months 249.000 ₫ (−15%), 12 months 449.000 ₫ (−24%). Numbers live in `config/payment.ts` only. |
| When Pro ends | Items stay in the wardrobe but **locked**; the worn Neon items are taken off at the next visit. Renewing opens them again. Nothing is deleted. |
| Coins for money | **Yes, in packs** (decided by the user). Coins only buy avatar items (cosmetics), so a rating, a duel or a word list never depends on money. The packs are in the next section. |
| Pro items in the shop | Shown in the wardrobe with a "Pro" lock; a learner without Pro can preview them, the button leads to `/pro`. |

## Data
- `User.proUntil: Date | null` (default `null`). Pro is active when `proUntil > now`. Never written by a client: only the
  payment grant (below) and, later, an admin.
- `User.toJSON` replaces it with `pro: { active: boolean, until: string | null }` (only the owner reads `toJSON`;
  `.lean()`/`aggregate()` never expose it). Public screens that need the badge later send one `isPro` boolean, never a date.
- `Payment` gets `grantedAt: Date | null`.
- `config/payment.ts`: `PAYMENT_PRODUCTS` becomes a list of `{ amount, orderInfo, grant }`, where `grant` is
  `{ kind: 'pro', days }` or `{ kind: 'coins', coins }`. `orderInfo` stays without accents (VNPay).

  | Id | Price | Grant |
  |---|---|---|
  | `pro-1m` | 49.000 ₫ | Pro 30 days |
  | `pro-6m` | 249.000 ₫ | Pro 180 days |
  | `pro-12m` | 449.000 ₫ | Pro 365 days |
  | `coins-500` | 20.000 ₫ | 500 coins |
  | `coins-1400` | 50.000 ₫ | 1.400 coins (+12%) |
  | `coins-3000` | 100.000 ₫ | 3.000 coins (+20%) |

  Days, not calendar months: plain date maths on every MongoDB version. Prices and amounts are placeholders to confirm
  (an item costs 80–250 coins today, so 500 coins is a few items and 3.000 is a whole wardrobe).
- Coins bought bypass `DAILY_COIN_LIMIT` (that limit only caps coins *earned* by playing).

## Backend
**Grant (`services/payment.service.ts`, one function `grantPurchase(payment)`)**
1. Called after `applyVnpayResult` flips a payment to `paid`, and also when it finds a `paid` payment with
   `grantedAt === null` (so a failed grant is repaired by VNPay's next IPN retry or the return page).
2. Claim: `PaymentModel.findOneAndUpdate({ _id, status: 'paid', grantedAt: null }, { grantedAt: now })`. Only the call that
   gets a document goes on, so the return page and the IPN together grant once.
3. Apply the product's `grant` with one atomic update:
   - Pro (pipeline form, no read-modify-write):
     `UserModel.updateOne({ _id: owner }, [{ $set: { proUntil: { $add: [{ $max: [{ $ifNull: ['$proUntil', now] }, now] }, days * 86_400_000] } } }])`;
   - coins: `UserModel.updateOne({ _id: owner }, { $inc: { coins: coins } })`.
4. If step 3 throws, set `grantedAt` back to `null`, log, and rethrow (VNPay retries the IPN).

**Avatar (`data/avatar-catalog.ts`, `services/avatar.service.ts`)**
- `Unlock` gets `{ kind: 'pro' }`. `PRO_ITEMS = ['headwear:dragon-horns', 'accessory:dragon-scarf', 'back:dragon-wings', 'effect:baby-dragon']`, checked in `unlockOf` before the shop price.
- Pro items are **not** stored in `ownedItems`. `ownsItem` says yes for a `pro` item iff the user is Pro, so expiry locks them and a renewal opens them without any bookkeeping.
- `buyItem` already refuses anything that is not `shop`. `updateAvatar` already refuses an item that is not owned, so an expired learner cannot save a Neon look.
- `getCatalog` also returns `pro: { active, until }`.
- **Expiry sweep**: when `GET /api/auth/me` or `GET /api/avatar` runs for an expired Pro whose saved look still has a Pro item,
  those slots are set to `null` (one write). Known limit: another player can see an expired learner's Neon items until that
  learner next opens the app. Upgrade path if it matters: a Vercel Cron that runs the same function for every expired account.

**Payments API**
- `GET /api/payments/products` (signed in) sends the catalog: `[{ id, amount, grant }]`. The frontend shows prices and
  amounts from it and never writes a number.
- `POST /api/payments/vnpay` takes `{ product }` (the enum comes from the config ids). New: its own limiter, 10 per hour per user.
- `GET /vnpay/return` answers `{ status, amount, orderInfo, product, grant }`; the page reads the new `proUntil` or `coins` from `/me`.
- `GET /api/payments/me` is not needed in v1 (no receipts screen).

**Never** read an amount or a duration from the client; `proUntil` is not in any update schema (profile, admin) — a test proves a body with `proUntil` is ignored.

## Frontend
New module `FE/src/modules/payments/` (`api/ hooks/ components/ pages/ types/`), registered in `FE/src/app/modules.ts`.
It adds `routes: /store`, `publicRoutes: /payments/vnpay/return` and a `menuItems` entry in the account menu
("Cửa hàng"). A small shared `ProBadge` goes next to the name in `UserMenu` and the profile header.

**`/store` (StorePage)**: one page, two sections, one VNPay button each (`PlanCard` is shared).
```
┌ Pro · Bộ Neon ──────────────────────────┐
│  [avatar of the learner, scale 5]       │  pose cycles idle → typing → win
│  ◉ Tai nghe  ◉ Mặt dây  ◉ Cánh  ◉ Tia   │  each toggles on the preview
│  [1 tháng]  [6 tháng • Phổ biến]  [12]  │  price, price per month, saving
│  Trả một lần, không tự gia hạn           │
│  [ Thanh toán bằng VNPay ]               │
├ Coin ───────────────────────────────────┤
│  Bạn có 320 coins                        │
│  [500]  [1.400 • +12%]  [3.000 • +20%]  │  price, coins per 1.000 ₫
│  [ Thanh toán bằng VNPay ]               │
└──────────────────────────────────────────┘
```
The wardrobe links here: its coins line gets a "+ Nạp coin" button, and a shop item the learner cannot afford shows
"Nạp thêm coin" instead of only "Not enough coins". `?section=coins` scrolls to the coin pack section.
- The preview reuses `AvatarSprite` with the learner's saved look plus the four Pro items (`AvatarSprite` already takes a `look`).
- Already Pro: the title says "Pro đến dd/mm/yyyy", the button says "Gia hạn", a line says time is added after the end date.
- The button calls `useStartPayment` and sends the browser to `paymentUrl` (`window.location.assign`). Loading, error and a 503 ("Thanh toán chưa được bật") states, like the other pages.
- Look: theme tokens only, `Panel`, square corners. The "neon" is the primary red glow (a CSS `drop-shadow` on the sprite, still for reduced motion). The sprite art keeps its own colors (a hot red and white keycaps, matching the Blood red theme).

**`/payments/vnpay/return` (PaymentReturnPage, public)**
It forwards `window.location.search` to `GET /api/payments/vnpay/return` and shows:
- loading: "Đang xác nhận với VNPay…";
- **paid**: the avatar puts the Neon set on with a short pop (CSS, skipped for reduced motion), "Pro đến …", buttons **Mặc ngay** (`PUT /api/avatar` with the four items) and **Vào tủ đồ**; it invalidates `currentUserKey` so the badge shows at once;
- **failed**: a sentence from `vnp_ResponseCode` (24 = "Bạn đã hủy giao dịch", other = "Giao dịch không thành công") and **Thử lại** → `/pro`;
- **invalid** (400): "Không xác minh được giao dịch. Nếu tiền đã bị trừ, hãy chờ vài phút rồi mở lại trang này." (the IPN may still grant it);
- not signed in: the result is shown, the buttons say "Đăng nhập" instead.
- a **coin pack** that is paid: "+1.400 coins" counting up to the new balance (CSS number, still for reduced motion), buttons **Vào tủ đồ** and **Mua tiếp**.

**Wardrobe (`WardrobePage.tsx`, `avatar.types.ts`)**
`AvatarUnlock` gets `pro`; `lockText` says "Pro"; `pickable` allows previewing a Pro item. In the left panel, when the look holds a
Pro item the learner does not own, the Buy button is replaced by **Nâng cấp Pro** (a link to `/pro`) and Save stays disabled
(as it is for a shop item not bought). A "Pro" tag shows on the cards.

## Sprites (Dragon set)
Drawn by `minigame-sprites/build-layers.mjs` (new names in `HEADWEARS`, `ACCESSORIES`, `BACKS`, `EFFECTS` and their draw functions), then
`node minigame-sprites/build-layers.mjs` regenerates `FE/public/avatar` and `BE/src/data/avatar-items.ts`; never edited by hand.
Each item in the 4 poses (idle, typing, win, lose):
| Item | Slot | Look |
|---|---|---|
| `dragon-horns` | headwear | two small horns curving out of the hair, red roots and cream tips |
| `dragon-scarf` | accessory | a red scarf scaled in gold, its end flickering into an ember flame |
| `dragon-wings` | back | amber bat wings with red bones and a spade tail, flapping in two frames |
| `baby-dragon` | effect | a chibi baby dragon pet hovering beside the head (top right) with embers around, its wing beating in two frames |
Risk: `headwear` and the hair layer overlap (see the hair cards that hide the hat), so the headset must be checked on every hair style in the wardrobe test screenshot.

## Phases (each can be built and merged on its own)
- **A1 Backend**: config (Pro plans and coin packs), `proUntil`, `grantPurchase`, `GET /products`, `Unlock.pro`, limiter, tests. Needs no sprites (use placeholder names in the catalog test).
- **A2 Sprites**: the four items. Independent of A1.
- **A3 Frontend**: payments module, `/store`, return page, wardrobe changes, `ProBadge`. Needs A1 and A2. The coin pack half only needs A1, so it can ship first.
- **B Ping weekly report** (own spec): `GET /api/profile/weekly-report`, Pro only, made once a week per learner from `getErrorProfile` and the week's sessions with `generateChatReply`, stored (`WeeklyReport`, one per learner and week) so a reload costs nothing; written fallback when the AI answers 503, as the practice duel coach does.
- Later: Pro badge in duels and leaderboards, replay kept for a year (needs a per-document TTL), an admin "give Pro" button.

## Tests
- Unit: the catalog (every product has a positive amount and grant); the Pro grant arithmetic (new account, active Pro adds after the end, expired Pro starts now).
- Coin packs: a paid pack adds exactly its coins once (return + IPN together, or a second IPN), a failed one adds none, the daily coin limit does not cut bought coins.
- Integration (`payments.test.ts`): paid IPN grants once even when the return and the IPN run together; a failed or forged payment grants nothing; a failed grant (mock the user update) is repaired by the next call; wrong amount grants nothing; unknown product 400; `proUntil` in a body is ignored; the limiter answers 429.
- Integration (avatar): Pro items are not owned without Pro, can be saved with Pro, locked after expiry, and the sweep clears them.
- Frontend: `ProPage` (plans, price, Pro state, 503), `PaymentReturnPage` (paid / failed / invalid / signed out), `WardrobePage` (Pro lock and the Nâng cấp Pro button).
- Manual: one real sandbox payment with the NCB test card, and the IPN URL `https://<backend>/api/payments/vnpay/ipn` sent to VNPay.

## Docs to update with the code (golden rule 7)
`AGENTS.md`: the Payments rule (no longer "grants nothing yet": the grants, `proUntil`, `grantedAt`, the product ids), the Avatar rules (`pro` unlock), the frontend module list; `BE/docs` and `FE/docs` architecture pages; the real-money non-goal of `2026-10-28-ranked-duel-design.md` (now: coins may be bought, but only spend on cosmetics).

## Not now
Auto-renewing subscriptions, refunds and receipts (a refunded coin pack would need a negative grant), selling single items for money, Pro-only speed or rating perks, a trial, a first-purchase bonus, coins that buy anything but avatar items.
