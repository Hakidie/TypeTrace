export interface SampleText {
  id: string;
  label: string;
  text: string;
}

/** Texts testers type. The short one is the reference for the results table in docs/spikes/ime-input-events.md. */
export const SAMPLE_TEXTS: SampleText[] = [
  {
    id: 'short',
    label: 'Short',
    // Tone marks, ư/ơ, tone placement (oà/òa) and a word an IME may auto-restore (text).
    text: 'Tiếng Việt rất đẹp. Người trường quốc khuỷu nghiêng hoà thuỷ text, xong.',
  },
  {
    id: 'long',
    label: 'Long',
    // Several sentences and punctuation marks, hard vowel groups (ươ, uyê, uô, oa, uy),
    // gi/qu/ngh, capital Đ, numbers (VNI uses digits for tones) and English words.
    text:
      'Buổi sáng mùa thu ở Hà Nội thật dịu dàng. Gió heo may khẽ lùa qua những hàng cây, lá vàng rơi xào xạc trên phố. ' +
      'Người bán hàng rong đạp xe chậm rãi, giỏ đầy hoa cúc và quả hồng chín đỏ. Tôi ngồi bên khung cửa sổ, nhâm nhi ' +
      'ly cà phê nóng và đọc quyển sách cũ mà ông nội để lại từ thuở nhỏ. Trang giấy đã ngả màu, nhưng những dòng chữ ' +
      'nghiêng nghiêng vẫn rõ ràng: "Gia đình hoà thuận, khoẻ mạnh là điều quý giá nhất." Khuya hôm ấy, trăng sáng ' +
      'vằng vặc; chúng tôi kể chuyện xưa, cười đùa rộn rã. Đến năm 2024, tôi vẫn gửi email và text cho bạn bè ở khắp ' +
      'nơi. Bạn có nhớ không? Đó là những ngày tháng hạnh phúc nhất!',
  },
];
