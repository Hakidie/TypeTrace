# Daily merged into Practice: streak reward

## Why

Two streaks (the learner's days in `DailyProgress` and the Daily challenge's own `DailyEntry.streak`, Vietnam time) looked
the same to learners. The Daily challenge (one passage a day for everyone, 3 tries, a leaderboard) goes away; only its
reward stays, on the one streak the profile already shows.

## Decisions (with the user)

- **One streak**: `DailyProgress` (the learner's time zone), unchanged.
- **Reward**: the day's first counted session (Practice or Placement, whatever `isCounted` says) makes today's reward
  claimable. The learner claims it with a button in a "Nhận thưởng" modal on the result page. Closed without claiming,
  the modal comes back on the next result page of the day; at the end of the day the reward is gone.
- **Coins**: as `coinsFor` before: `min(50, 20 + 5 × (streak − 1))`, `streak` = the current streak (today included).
- **Old data stays**: `DailyEntry` and `DailyChallenge` documents and old `daily` sessions stay in the database. The code
  that wrote them is removed; `daily` stays a session mode so old sessions still read.
- The Daily card leaves the Minigames tab (Nối từ, PR #56, takes its place); Ping's tour loses its Daily stop.

## Backend

- `DailyProgress` gets `rewardCoins` and `rewardClaimedAt` (absent until claimed).
- `GET /api/profile/streak` adds `today.reward: { coins, claimed }`: `coins` = what the claim gives (or gave).
- `POST /api/profile/streak/reward` claims today's reward: one conditional update
  (`{ owner, date: today, sessions > 0, rewardClaimedAt missing }`), so two claims at once pay once; only the request that
  set `rewardClaimedAt` adds the coins to the user. No counted session today: 400. Already claimed: 409. Answers
  `{ coins, totalCoins }`.
- Removed: `/api/daily` (route, controller, validator, service, model), `recordTry` in `completeSession`, the `daily`
  tutorial mode (an old stored `modes.daily` is ignored).

## Frontend

- `modules/daily` is removed. `StreakRewardDialog` (profile module) on `TypingResultPage` opens when `today.reward` is
  unclaimed and today has a counted session; "Nhận" claims, then refreshes the streak and the current user's coins.
- Minigames: only the Rain card here (Nối từ comes with PR #56). The old `?mode=daily` link opens Practice; `&game=daily` shows the cards.
- Tutorial: `daily` leaves `TOUR_ORDER`, `MODE_SEARCH`, `MODE_STEPS`; a Practice step tells about the streak reward.
