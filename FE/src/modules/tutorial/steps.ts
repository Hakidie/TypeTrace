import type { TutorialMode, TutorialState, TutorialStep } from './types/tutorial.types';

/** The tour after sign-up visits the modes in this order (Ping tutorial design). */
export const TOUR_ORDER: TutorialMode[] = ['practice', 'placement', 'rain', 'daily', 'rank'];

/** The Typing page tab (`?mode=`) of each mode. */
export const MODE_QUERY: Record<TutorialMode, string> = { practice: 'practice', placement: 'placement', rain: 'rain', daily: 'daily', rank: 'rank' };

/** The first words of the tour, before Practice. */
export const WELCOME_STEP: TutorialStep = {
  id: 'welcome',
  mode: 'practice',
  move: 'happy',
  text: 'Yo! Mình là Ping. Mình dẫn bạn đi một vòng: gõ thử, bài xếp lớp, Mưa chữ, thử thách mỗi ngày, rồi đấu tập với mình trước khi vào Rank thật. Chừng 5 phút thôi!',
  next: 'Đi thôi',
};

/**
 * The steps of each mode, in Ping's voice. A guide of one mode shows its list; the tour chains the lists in `TOUR_ORDER`.
 * `target` is the `data-tutorial` id of what is framed.
 */
export const MODE_STEPS: Record<TutorialMode, TutorialStep[]> = {
  practice: [
    { id: 'practice-passage', mode: 'practice', move: 'point', target: 'typing-passage', text: 'Đây là đoạn văn để luyện. Cứ gõ theo: chữ đúng sáng lên, chữ sai hiện đỏ, sai thì Backspace sửa lại.' },
    { id: 'practice-stats', mode: 'practice', move: 'talk', target: 'typing-stats', place: 'top', text: 'Dưới đây là số từ đã gõ và thời gian. Gõ xong, màn kết quả cho bạn WPM (số từ mỗi phút) và độ chính xác. Gõ đúng trước, tốc độ tự lên!' },
    { id: 'practice-try', mode: 'practice', move: 'happy', text: 'Gõ thử vài từ đi. Xong thì bấm "Hiểu rồi" nhé.', next: 'Hiểu rồi' },
  ],
  placement: [
    { id: 'placement-what', mode: 'placement', move: 'talk', target: 'mode-tabs', text: 'Placement là bài xếp lớp: gõ một đoạn, mình biết trình độ của bạn để chọn đoạn văn vừa sức.' },
    { id: 'placement-when', mode: 'placement', move: 'point', text: 'Làm một lần là đủ, chừng một phút. Muốn để sau cũng được, cứ bấm Tiếp.' },
    { id: 'placement-next', mode: 'placement', move: 'happy', text: 'Tiếp theo là màn mình thích nhất: Mưa chữ!' },
  ],
  rain: [
    { id: 'rain-what', mode: 'rain', move: 'talk', target: 'rain-stage', text: 'Mưa chữ: chữ rơi từ trên xuống, gõ đúng chữ rồi nhấn Space để bắn nó trước khi chạm đất. Bấm Start (hoặc Enter) để bắt đầu.' },
    { id: 'rain-word', mode: 'rain', move: 'point', target: 'rain-word', waitFor: 'rain-word', text: 'Khoan đã! Mình dừng mưa lại rồi. Gõ chữ đang khoanh đỏ rồi nhấn Space nào.' },
    { id: 'rain-lives', mode: 'rain', move: 'happy', text: 'Chuẩn! Chữ chạm đất là mất một ♥, hết 3 ♥ là thua. Cần nghỉ thì Esc để tạm dừng.' },
  ],
  daily: [
    { id: 'daily-what', mode: 'daily', move: 'talk', target: 'daily-challenge', text: 'Daily là thử thách mỗi ngày: một bài chung cho mọi người, mỗi ngày một bài mới.' },
    { id: 'daily-progress', mode: 'daily', move: 'point', text: 'Xong bài là thấy WPM và độ chính xác của bạn qua từng ngày. Quay lại mỗi ngày để xem mình tiến bộ!' },
    { id: 'daily-next', mode: 'daily', move: 'happy', text: 'Còn một chặng cuối: Rank!' },
  ],
  rank: [
    { id: 'rank-what', mode: 'rank', move: 'talk', target: 'rank-kind', text: 'Rank là đấu 1–1 với người khác. Race: gõ một đoạn văn nhanh và đúng hơn. Rain: Mưa chữ đối đầu, gõ trúng là ném chữ sang đối thủ.' },
    { id: 'rank-points', mode: 'rank', move: 'point', text: 'Thắng được cộng điểm, thua bị trừ: hai người ngang nhau thì khoảng 20 điểm. Thắng người mạnh hơn được nhiều hơn, thua người yếu hơn mất nhiều hơn.' },
    { id: 'rank-tiers', mode: 'rank', move: 'talk', text: 'Bạn bắt đầu ở Bronze 1000. Lên 1100 là Silver, rồi Gold 1250, Platinum 1400, Diamond 1550, Legend 1700. Race và Rain mỗi kiểu một rating riêng.' },
    { id: 'rank-practice', mode: 'rank', move: 'happy', next: 'Đấu tập với Ping', text: 'Trước khi đấu thật, đấu tập với mình một trận Rain nhé. Trận này không tính điểm đâu!' },
  ],
};

/** A per-mode guide is due: the account has a tutorial (never one from before it) and has not learned or skipped the mode. */
export const pendingGuide = (tutorial: TutorialState | undefined, mode: TutorialMode) => Boolean(tutorial && !tutorial.modes[mode]);

/** The mode the tour is at: the first of `TOUR_ORDER` not learned or skipped, while the tour is active. */
export const nextTourMode = (tutorial: TutorialState | undefined): TutorialMode | undefined =>
  tutorial?.tour === 'active' ? TOUR_ORDER.find((mode) => !tutorial.modes[mode]) : undefined;
