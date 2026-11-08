# Word lists of the minigames

`build-noi-tu.mjs` builds `FE/public/noi-tu/words.txt`, the word list of the Nối từ minigame, and its server copy
`BE/src/data/noi-tu-words.ts` (the backend checks a chain against it before it goes on the leaderboard). Each line holds one
two-syllable word. A `*` in front marks a word the bot may play. The file is generated, never edited by hand.

## Downloads (not in the repo)

1. Get `Viet74K.txt` and `Viet11K.txt` from https://github.com/duyet/vietnamese-wordlist (GPL-2.0).
2. Get the Leipzig Vietnamese corpora (CC BY 4.0) from https://wortschatz-leipzig.de/en/download/vie, for example
   `vie_news_2022_1M`, `vie_wikipedia_2021_1M`, `vie_mixed_2014_1M` and `vie-vn_web_2015_1M`. Unpack them; only their
   `*-sentences.txt` files are read. Folders with `news` in the file name also make the bot's list.

## Run

```bash
node --max-old-space-size=8192 minigame-words/build-noi-tu.mjs Viet74K.txt Viet11K.txt <leipzig-folder>...
```

The script takes a few minutes.

## What goes into the list

You may type:
- every two-syllable word of both dictionaries;
- the syllable pairs of the corpora that look like words:
  - frequent (count ≥ 4),
  - sticky (PMI ≥ 5),
  - not mostly a slice of a longer phrase,
  - without a little word such as "là" or "của".

The bot only plays:
- Viet11K;
- the Viet74K words made of common syllables;
- the frequent news pairs.

It never plays a word that ends in a little word.
