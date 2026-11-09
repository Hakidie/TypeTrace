import { useMinigameLang, type MinigameLang } from '@/shared/hooks/use-minigame-lang';

export type WordChainLang = MinigameLang;

/** Every text of the Word chain game, in each language it can be played in. */
export interface WordChainText {
  /** The toggle's own label, in the language it switches to. */
  switchTo: string;
  title: string;
  leaderboard: string;
  leaderboardTitle: string;
  leaderboardHint: string;
  openLeaderboardPage: string;
  you: string;
  noWordList: string;
  noWordListHint: string;
  timeLeft: string;
  score: string;
  best: string;
  chainList: string;
  chainFrom: string;
  given: string;
  secondSyllable: (prompt: string) => string;
  nextWord: string;
  typeSecond: string;
  hint: string;
  skip: string;
  rules: (seconds: number) => string;
  slower: string;
  start: string;
  newBest: string;
  timesUp: string;
  scored: string;
  scoredPoints: string;
  bestColon: string;
  playAgain: string;
  thisWeek: string;
  allTime: string;
  timeRange: string;
  boardLabel: string;
  noOne: string;
  noOneHint: string;
  yourPlace: (rank: number, score: number) => string;
  reasonShape: string;
  reasonStart: (syllable: string) => string;
  reasonUnknown: (word: string) => string;
  reasonUsed: string;
  wrong: (why: string, seconds: number) => string;
  right: (bonus: number) => string;
  botStuck: (syllable: string, points: number, bonus: number) => string;
  skipped: (word: string, seconds: number) => string;
  noFollow: string;
  hinted: (word: string, seconds: number) => string;
}

export const TEXT: Record<WordChainLang, WordChainText> = {
  en: {
    switchTo: 'Tiếng Việt',
    title: 'Word chain',
    leaderboard: 'Leaderboard',
    leaderboardTitle: 'Word chain leaderboard',
    leaderboardHint: "Everyone's best score, this week or all time.",
    openLeaderboardPage: 'Open the Leaderboard page',
    you: 'You',
    noWordList: 'No word list yet',
    noWordListHint: 'Run minigame-words/build-noi-tu.mjs to create FE/public/noi-tu/words.txt.',
    timeLeft: 'Time left',
    score: 'Score',
    best: 'Best',
    chainList: 'Word chain list',
    chainFrom: 'Chain from',
    given: 'given',
    secondSyllable: (prompt) => (prompt ? `Second syllable (the syllable "${prompt}" is given)` : 'Next word'),
    nextWord: 'Next word',
    typeSecond: 'type the second syllable',
    hint: 'Hint',
    skip: 'Skip',
    rules: (seconds) =>
      `Type a two-syllable word that starts with the last syllable of the bot's word. You have ${seconds} seconds; each right word scores 1 point and adds time: the faster you type, the more you get.`,
    slower: 'Slower',
    start: 'Start',
    newBest: 'New best!',
    timesUp: "Time's up",
    scored: 'You scored',
    scoredPoints: 'points. Best:',
    bestColon: 'Best:',
    playAgain: 'Play again',
    thisWeek: 'This week',
    allTime: 'All time',
    timeRange: 'Time range',
    boardLabel: 'Word chain leaderboard',
    noOne: 'No one yet',
    noOneHint: 'Play a game to get on the board.',
    yourPlace: (rank, score) => `You are #${rank} with ${score} points.`,
    reasonShape: 'Type a compound word of exactly two syllables.',
    reasonStart: (syllable) => `The word must start with "${syllable}".`,
    reasonUnknown: (word) => `"${word}" is not in the word list.`,
    reasonUsed: 'This word was already used in this game.',
    wrong: (why, seconds) => `${why} −${seconds}s`,
    right: (bonus) => `Right! +1 point, +${bonus}s`,
    botStuck: (syllable, points, bonus) => `The bot is stuck on "${syllable}"! +${points} points, +${bonus}s`,
    skipped: (word, seconds) => `Skipped "${word}", −${seconds}s`,
    noFollow: 'No word can follow. Press Skip.',
    hinted: (word, seconds) => `Hint: ${word} (−${seconds}s)`,
  },
  vi: {
    switchTo: 'English',
    title: 'Nối từ',
    leaderboard: 'Bảng xếp hạng',
    leaderboardTitle: 'Bảng xếp hạng Nối từ',
    leaderboardHint: 'Điểm cao nhất của mỗi người, tuần này hoặc mọi lúc.',
    openLeaderboardPage: 'Xem trang Leaderboard',
    you: 'Bạn',
    noWordList: 'Chưa có danh sách từ',
    noWordListHint: 'Chạy minigame-words/build-noi-tu.mjs để tạo FE/public/noi-tu/words.txt.',
    timeLeft: 'Thời gian còn lại',
    score: 'Điểm',
    best: 'Kỷ lục',
    chainList: 'Chuỗi từ',
    chainFrom: 'Nối tiếp bằng',
    given: 'có sẵn',
    secondSyllable: (prompt) => (prompt ? `Tiếng thứ hai (tiếng "${prompt}" đã có sẵn)` : 'Từ nối tiếp'),
    nextWord: 'Từ nối tiếp',
    typeSecond: 'gõ tiếng thứ hai',
    hint: 'Gợi ý',
    skip: 'Bỏ qua',
    rules: (seconds) =>
      `Gõ một từ hai tiếng bắt đầu bằng tiếng cuối của từ bot đưa. Bạn có ${seconds} giây, mỗi từ đúng được 1 điểm và thêm giờ: gõ càng nhanh thêm càng nhiều.`,
    slower: 'Chậm hơn',
    start: 'Bắt đầu',
    newBest: 'Kỷ lục mới!',
    timesUp: 'Hết giờ',
    scored: 'Bạn được',
    scoredPoints: 'điểm. Kỷ lục:',
    bestColon: 'Kỷ lục:',
    playAgain: 'Chơi lại',
    thisWeek: 'Tuần này',
    allTime: 'Mọi lúc',
    timeRange: 'Khoảng thời gian',
    boardLabel: 'Bảng xếp hạng Nối từ',
    noOne: 'Chưa có ai',
    noOneHint: 'Chơi một ván để lên bảng.',
    yourPlace: (rank, score) => `Bạn đứng thứ ${rank} với ${score} điểm.`,
    reasonShape: 'Gõ một từ ghép đúng hai tiếng.',
    reasonStart: (syllable) => `Từ phải bắt đầu bằng "${syllable}".`,
    reasonUnknown: (word) => `"${word}" chưa có trong danh sách từ.`,
    reasonUsed: 'Từ này đã dùng trong ván rồi.',
    wrong: (why, seconds) => `${why} −${seconds} giây`,
    right: (bonus) => `Đúng! +1 điểm, +${bonus} giây`,
    botStuck: (syllable, points, bonus) => `Bot bí "${syllable}"! +${points} điểm, +${bonus} giây`,
    skipped: (word, seconds) => `Bỏ qua "${word}", −${seconds} giây`,
    noFollow: 'Không còn từ nào nối được. Bấm Bỏ qua.',
    hinted: (word, seconds) => `Gợi ý: ${word} (−${seconds} giây)`,
  },
};

/** The language of the game's texts (the choice of every minigame). */
export const useWordChainLang = () => {
  const { lang, toggle } = useMinigameLang();
  return { lang, text: TEXT[lang], toggle };
};
