/**
 * The texts of the guest typing test on the home page. They live in the frontend: a guest has no session on the server,
 * so nothing is read from or saved to the API. Short on purpose (the test lasts 1 minute), with plenty of marks and tones.
 */
export const GUEST_PASSAGES: readonly string[] = [
  'Mỗi buổi sáng, em thức dậy thật sớm để chạy bộ quanh hồ. Không khí trong lành giúp em tỉnh táo hơn.',
  'Hà Nội vào thu, trời trong và gió se lạnh. Hoa sữa nở thơm ngát trên những con phố nhỏ.',
  'Trước ngõ nhà em có một cây bàng già. Mùa hè, tán bàng xòe rộng như chiếc ô che nắng cho lũ trẻ.',
  'Cơn mưa đầu hạ đến rất nhanh. Chỉ vài phút sau, mưa rơi ào ào trên mái tôn và không khí trở nên mát dịu.',
  'Chiều nào cũng vậy, cả nhà ngồi quanh mâm cơm, kể cho nhau nghe chuyện ở trường và ở cơ quan.',
];

/** The guest test lasts one minute. */
export const GUEST_TIME_LIMIT_SECONDS = 60;

/** A random passage other than `not` (the one just typed), as its words. */
export const pickGuestPassage = (not?: number): { index: number; words: string[] } => {
  const choices = GUEST_PASSAGES.map((_, index) => index).filter((index) => index !== not);
  const index = choices[Math.floor(Math.random() * choices.length)];
  return { index, words: GUEST_PASSAGES[index].split(/\s+/).filter(Boolean) };
};
