# Bot duel (SCRUM-247) — design

## Intent

Learners practise the word rain duel against a bot, at three levels, whenever they want. It is practice only: no
match on the server, no rating, nothing saved.

## Goals / non-goals

- Goals: a "Bot duel" card in the Minigames tab; pick a level; play a rain duel against that level's bot; see the
  result with Ping's tip; play again or change level.
- Non-goals: a bot in the ranked Race duel, bots on the server, saved results, rewards (coins, rating, history).
- Anti-goals: anything that touches `/api/matches`, `/api/ranked` or a rating.

## Approaches considered

1. **Bot in the browser (chosen).** Reuse the tutorial's practice duel engine (`practice-duel.ts`), add levels.
   No backend change. Fits "practice only".
2. Bot on the server as a match player in `match-hub`. Lets results be saved, but needs rating guards and more
   in-memory timers; nothing in this ticket needs it.

## Levels

| Level | Bot | Rain pace (server `rainDuelSettings.paces`) | Bot types after | Bot misses |
|---|---|---|---|---|
| Dễ | **Bông** — sleepy boy, red beanie | Bronze | 2.5–6 s | 1 word in 6 |
| Vừa | **Nhịp** — DJ girl, ponytail, headphones | Gold | 1.5–4 s | 1 word in 10 |
| Khó | **Dạ** — demon boy, horns, bat wings | Diamond | 0.8–2.5 s | 1 word in 20 |

The bot numbers are a first guess, tuned by playing. The pace numbers mirror the server's tiers, as the tutorial's
`PRACTICE_PACE` already mirrors Bronze.

## The bots' look

Own pixel sprites, like Ping: one strip of 4 frames (64×88 each) per move in `FE/public/bots/<bot>-<move>.png`,
moves `idle`, `typing`, `win`, `lose`. They keep their own colors (the same exception as Ping and the avatars).
Approved by the user on 2026-11-08: Bông from CellCog; Nhịp redrawn by script; Dạ from CellCog with curtain-bang
hair and curved horns redrawn by script. A `README.md` in that folder records where they came from; they are not
edited by hand.

During the duel the bot types; it shows `win` just after it throws a word at the learner or when it wins, `lose`
just after it loses a life or when it loses (as Ping does now with happy/sad).

## The flow

- Minigames tab: a third card **Bot duel** (`?mode=minigames&game=bot`). Ping's guide does not run there.
- Level picker: three cards with the bot (idle), its name, the level and one line about it.
- The duel: the tutorial's `PracticeDuel` layout, with the bot's name, sprite and level instead of Ping and
  "Bronze"; tagged unrated.
- The result: the numbers and Ping's tip (the existing coach call), buttons **Chơi lại** and **Đổi độ khó**.

## What the builder decides

- How `practice-duel.ts` takes the level (a parameter of `startPractice` with Bông/Bronze as the default keeps the
  tutorial unchanged).
- Whether the level lives in the URL (not required).
- Component names and test cases, following the project's patterns (AGENTS.md).
