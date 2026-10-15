// Starter passages for the passage bank (SCRUM-95, US6.2). Every text is written for TypeTrace, so it is free to reuse.
// Add passages here and run `npm run import:passages`: passages already in the bank (same title) are left untouched.
export const PASSAGE_SOURCE = 'Tự biên soạn cho TypeTrace';

export interface PassageSeed {
  title: string;
  content: string;
  source: string;
  isPlacement?: boolean;
}

export const PASSAGE_LIST: readonly PassageSeed[] = [
  {
    title: 'Tiếng Việt rất đẹp',
    content: 'Tiếng Việt rất đẹp. Người trường quốc khuỷu nghiêng hoà thuỷ text, xong. Hôm nay trời đẹp, chúng ta cùng đi chơi nhé.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Buổi sáng chạy bộ',
    content: 'Mỗi buổi sáng, em thức dậy thật sớm để chạy bộ quanh hồ. Không khí trong lành giúp em tỉnh táo hơn, rồi em về nhà ăn sáng cùng gia đình.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Hà Nội vào thu',
    content:
      'Hà Nội vào thu, trời trong và gió se lạnh. Trên những con phố nhỏ, hoa sữa nở thơm ngát khắp nơi. Người dân đi dạo quanh hồ, uống cốc cà phê nóng và ngắm lá vàng rơi.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Bữa cơm gia đình',
    content:
      'Chiều nào cũng vậy, mẹ nấu cơm còn bố đi chợ mua thêm rau. Cả nhà ngồi quanh mâm, kể cho nhau nghe chuyện ở trường và ở cơ quan. Bữa cơm giản dị nhưng ấm áp, và ai cũng mong đến ngày mai.',
    source: PASSAGE_SOURCE
  },
  {
    // The placement test (US2.3): it needs at least 20 opportunities for every error type (checked in a test).
    title: 'Bài kiểm tra đầu vào',
    isPlacement: true,
    content:
      'Hôm nay, đứa trẻ nhỏ đi dạo quanh đồng quê để ngắm cảnh đẹp. Ở đó, nước sông chảy đều, gió thổi nhẹ trên những cánh đồng rộng lớn. Mỗi buổi sáng, cô bé thường dậy sớm, chải mái tóc dài rồi đến trường cùng bạn bè. Sau giờ học, các bạn cùng nhau đọc truyện, vẽ tranh và kể chuyện cổ tích. Đến chiều, mẹ nấu bữa cơm ngon, cả nhà quây quần bên mâm cơm đầm ấm. Đôi khi, cơn mưa bất chợt đổ xuống, mọi người phải chạy vội để tránh ướt. Nhưng niềm vui vẫn đầy ắp trong lòng, bởi ai cũng nghĩ đến ngày mai sẽ đẹp hơn. Người dân quê thường nhớ mãi những kỷ niệm đáng quý đó, và họ luôn giữ gìn truyền thống đoàn kết, yêu thương nhau suốt đời.',
    source: PASSAGE_SOURCE
  }
];
