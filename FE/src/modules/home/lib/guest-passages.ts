import type { TypingLanguage } from '@/shared/lib/typing-language';

/**
 * The texts of the guest typing test on the home page. They live in the frontend: a guest has no session on the server,
 * so nothing is read from or saved to the API. Each has a short title for the Manual menu of the guest Typing page. Short on purpose (the test lasts 1 minute), with plenty of marks and tones.
 */
export const GUEST_PASSAGES: readonly { title: string; text: string }[] = [
  { title: 'Buổi sáng', text: 'Mỗi buổi sáng, em thức dậy thật sớm để chạy bộ quanh hồ. Không khí trong lành giúp em tỉnh táo hơn.' },
  { title: 'Thu Hà Nội', text: 'Hà Nội vào thu, trời trong và gió se lạnh. Hoa sữa nở thơm ngát trên những con phố nhỏ.' },
  { title: 'Cây bàng', text: 'Trước ngõ nhà em có một cây bàng già. Mùa hè, tán bàng xòe rộng như chiếc ô che nắng cho lũ trẻ.' },
  { title: 'Mưa đầu hạ', text: 'Cơn mưa đầu hạ đến rất nhanh. Chỉ vài phút sau, mưa rơi ào ào trên mái tôn và không khí trở nên mát dịu.' },
  { title: 'Bữa cơm gia đình', text: 'Chiều nào cũng vậy, cả nhà ngồi quanh mâm cơm, kể cho nhau nghe chuyện ở trường và ở cơ quan.' },
];

/** The English passages of the guest Typing page, for a guest who switches the typing language to English (marks and tones do not matter here, plain words do). */
export const GUEST_PASSAGES_EN: readonly { title: string; text: string }[] = [
  { title: 'Morning run', text: 'Every morning I wake up early and run around the lake. The fresh air makes me feel awake and ready for the day.' },
  { title: 'Autumn in the city', text: 'In autumn the sky is clear and the wind is cool. The sweet smell of flowers fills the quiet streets of the old town.' },
  { title: 'The old tree', text: 'There is an old tree in front of our house. In summer its wide branches open like an umbrella and shade the children.' },
  { title: 'First summer rain', text: 'The first summer rain came very fast. A few minutes later it was pouring on the tin roof and the air turned cool and soft.' },
  { title: 'Family dinner', text: 'Every evening the whole family sits around the table and tells each other about school and work, and the day ends warmly.' },
];

/** The fixed passages of a typing language. */
export const guestPassagesOf = (language: TypingLanguage = 'vi') => (language === 'en' ? GUEST_PASSAGES_EN : GUEST_PASSAGES);

/** The guest test lasts one minute. */
export const GUEST_TIME_LIMIT_SECONDS = 60;

/** A random passage of `language` other than `not` (the one just typed), as its words; `only` picks that passage instead (the Manual menu of the guest Typing page). */
export const pickGuestPassage = (not?: number, only?: number, language: TypingLanguage = 'vi'): { index: number; title: string; words: string[] } => {
  const passages = guestPassagesOf(language);
  const choices = passages.map((_, index) => index).filter((index) => index !== not);
  const index = only ?? choices[Math.floor(Math.random() * choices.length)];
  return { index, title: passages[index].title, words: passages[index].text.split(/\s+/).filter(Boolean) };
};
