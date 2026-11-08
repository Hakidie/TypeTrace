// Builds the word list of the Nối từ minigame: FE/public/noi-tu/words.txt, one two-syllable word per line,
// "*" in front of the words the bot may play. See README.md for the downloads it reads.
//
// usage: node minigame-words/build-noi-tu.mjs <Viet74K.txt> <Viet11K.txt> <leipzig-dir>...
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const [viet74k, viet11k, ...corpusDirs] = process.argv.slice(2);
if (!viet74k || !viet11k || !corpusDirs.length) {
  console.error('usage: node minigame-words/build-noi-tu.mjs <Viet74K.txt> <Viet11K.txt> <leipzig-dir>...');
  process.exit(1);
}

const SYL = /^[a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]{1,7}$/;
// Little words: a corpus pair with one of them is a phrase, not a word, and the bot never ends a word with one.
const STOP = new Set(
  ('được hơn với của là và các những này đó khi thì mà cho để từ ra vào lên xuống rồi đã đang sẽ cũng vẫn còn có không ' +
    'nhiều ít rất quá nhất kia ấy nào gì ai sao vậy nhé à ơi tới đến về theo tại trên dưới trong ngoài sau trước giữa ' +
    'bị nhóm việc người cái chiếc con một hai ba bốn năm triệu tỷ nghìn ngàn').split(' '),
);
const clean = (s) => s.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
const isWord = (w) => { const p = w.split(' '); return p.length === 2 && p.every((s) => SYL.test(s)); };

/** The two-syllable words of a dictionary file (one entry per line). */
const dictionary = (file) => [...new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(clean).filter(isWord))];

/** All `*-sentences.txt` files under the given folders. */
const sentenceFiles = (dirs) =>
  dirs.flatMap((dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('-sentences.txt')).map((f) => path.join(dir, String(f))));

/** Runs `onRun(syllables)` on every run of lowercase syllables between punctuation and names. */
async function eachRun(files, onRun) {
  for (const file of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8') });
    for await (const line of rl) {
      const text = line.slice(line.indexOf('\t') + 1).normalize('NFC');
      for (const chunk of text.split(/[^\p{L}\s]+/u)) {
        let run = [];
        for (const t of chunk.trim().split(/\s+/)) {
          const low = t.toLowerCase();
          // a capital letter inside a sentence is a name: it breaks the run
          if (!SYL.test(low) || /^\p{Lu}/u.test(t)) { if (run.length > 1) onRun(run); run = []; } else run.push(low);
        }
        if (run.length > 1) onRun(run);
      }
    }
  }
}

/**
 * Pairs of syllables that look like words: frequent (count >= 4), sticky (PMI >= 5), and not mostly a slice of a
 * longer phrase ("lời phỏng" is nearly always "lời phỏng vấn"). Returns pair -> { n, pmi }.
 */
async function corpusPairs(files) {
  const uni = new Map(), bi = new Map();
  let total = 0;
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  await eachRun(files, (run) => run.forEach((s, i) => { inc(uni, s); total++; if (i) inc(bi, run[i - 1] + ' ' + s); }));
  const keep = new Map();
  for (const [k, n] of bi) {
    if (n < 4) continue;
    const [a, b] = k.split(' ');
    if (STOP.has(a) || STOP.has(b)) continue;
    const pmi = Math.log2((n * total) / (uni.get(a) * uni.get(b)));
    if (pmi >= 5) keep.set(k, { n, pmi, after: new Map(), before: new Map() });
  }
  await eachRun(files, (run) => {
    for (let i = 1; i < run.length; i++) {
      const p = keep.get(run[i - 1] + ' ' + run[i]);
      if (!p) continue;
      if (i + 1 < run.length) inc(p.after, run[i + 1]);
      if (i > 1) inc(p.before, run[i - 2]);
    }
  });
  const most = (m) => Math.max(0, ...m.values());
  for (const [k, p] of keep) if (most(p.after) >= 0.6 * p.n || most(p.before) >= 0.6 * p.n) keep.delete(k);
  console.error(`${files.length} files, ${total} syllables, ${keep.size} word-like pairs`);
  return keep;
}

const all74k = dictionary(viet74k), common = dictionary(viet11k);
const files = sentenceFiles(corpusDirs);
const pairs = await corpusPairs(files);
const newsPairs = await corpusPairs(files.filter((f) => /news/.test(f)));

const commonSyl = new Set(common.flatMap((w) => w.split(' ')));
const bot = new Set([
  ...common,
  ...all74k.filter((w) => w.split(' ').every((s) => commonSyl.has(s))),
  ...[...newsPairs].filter(([, p]) => p.n >= 10 && p.pmi >= 6).map(([k]) => k),
].filter((w) => !STOP.has(w.split(' ')[1])));
const words = [...new Set([...all74k, ...common, ...pairs.keys()])].sort((a, b) => a.localeCompare(b, 'vi'));

const out = path.resolve(import.meta.dirname, '../FE/public/noi-tu/words.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, words.map((w) => (bot.has(w) ? '*' : '') + w).join('\n') + '\n');
console.error(`${words.length} words (${[...bot].filter((w) => words.includes(w)).length} for the bot) -> ${out}`);
