# Nối từ (word chain) minigame — design

## Why
Daily will merge into Practice (a later ticket). The Minigames tab gets a game that is not "type a passage" again:
Vietnamese word chain against a friendly bot, played for a best score. The user tried a similar game elsewhere and
wants it simpler: one mode, no difficulty levels, and a time bonus that rewards typing fast.

## Rules (decided with the user)
- One mode. The clock starts at 60 s and the game ends when it reaches 0. The goal is to beat your best score.
- The bot shows a two-syllable word. You type a two-syllable word whose first syllable is the bot's last syllable. It
  must be in the word list and not used yet in this game. Tone marks compare without their position (hoà = hòa).
- A right word scores +1 point and adds time by the speed of that answer, in WPM. The answer's length counts as
  characters / 5, from the moment the bot's word appears to Enter:
  - ≥ 40 WPM: +5 s
  - 25–40 WPM: +4 s
  - 15–25 WPM: +3 s
  - below 15 WPM: +2 s
- Skip: −5 s, and the bot gives a fresh word. Hint: −3 s, and shows one common word that answers.
- A friendly bot. It answers your word with one of the words that have the most common answers, and never traps you.
  If it has no answer, you get +2 points and it gives a fresh word.

## Approaches
- **Browser only, like Rain (chosen).** The word list is a static file, loaded once and cached. The best score is
  kept per user in the browser. No backend, because nothing is rewarded.
- **Server-held games (dropped).** These would only be needed to pay coins or keep a leaderboard, and neither is
  wanted now.

## Word list
- The user chose Viet74K + Viet11K (GPL-2.0) plus the Leipzig Vietnamese corpora (CC BY 4.0).
- From the corpora, pairs of syllables that are frequent (count ≥ 4), sticky (PMI ≥ 5) and not mostly a slice of a
  longer phrase are kept. Pairs with a little word (là, của, được, …) are dropped.
- The bot plays only the cleaner part:
  - Viet11K;
  - Viet74K words made of common syllables;
  - corpus pairs frequent in news.
  It never plays a word that ends in a little word.
- `minigame-words/build-noi-tu.mjs` builds `FE/public/noi-tu/words.txt`, one word per line; `*` marks a word the bot
  may play. Sources and licences are in `FE/public/noi-tu/CREDITS.md`. The raw downloads are not in the repo (the
  README says where to get them).

## Frontend
- Logic: `FE/src/modules/word-chain/lib/word-chain.ts`, pure and tested (keys, the index, checking a word, the bot's
  pick, the bonus by WPM).
- Screen: `WordChainMode`, a card in Minigames, at `?mode=minigames&game=chain`. It has loading, error and empty
  states.
- Design with the ui-ux-pro-max, design-taste and motion skills, inside the TypeTrace look (theme tokens, square
  corners). Motion:
  - words slide into the chain;
  - the time bonus pops;
  - the clock pulses red under 10 s;
  - everything stays still for reduced motion.

## Not now
- Removing the Daily card (that waits for the Daily → Practice ticket).
- Coins, a leaderboard, "report a missing word", AI judging of unknown words.
