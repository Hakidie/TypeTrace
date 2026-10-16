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
  // Placement test passages (US2.3): a placement session picks one of them at random. Each needs at least 20
  // opportunities for every error type (checked in a test). Spread the đ and hỏi/ngã words over the whole text: a
  // session stops after 3 minutes, so a slow learner only types the beginning.
  {
    title: 'Bài kiểm tra đầu vào',
    isPlacement: true,
    content:
      'Hôm nay, đứa trẻ nhỏ đi dạo quanh đồng quê để ngắm cảnh đẹp. Ở đó, nước sông chảy đều, gió thổi nhẹ trên những cánh đồng rộng lớn. Mỗi buổi sáng, cô bé thường dậy sớm, chải mái tóc dài rồi đến trường cùng bạn bè. Sau giờ học, các bạn cùng nhau đọc truyện, vẽ tranh và kể chuyện cổ tích. Đến chiều, mẹ nấu bữa cơm ngon, cả nhà quây quần bên mâm cơm đầm ấm. Đôi khi, cơn mưa bất chợt đổ xuống, mọi người phải chạy vội để tránh ướt. Nhưng niềm vui vẫn đầy ắp trong lòng, bởi ai cũng nghĩ đến ngày mai sẽ đẹp hơn. Người dân quê thường nhớ mãi những kỷ niệm đáng quý đó, và họ luôn giữ gìn truyền thống đoàn kết, yêu thương nhau suốt đời.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Bài kiểm tra đầu vào: Phiên chợ quê',
    isPlacement: true,
    content:
      'Sáng sớm, bà đã dẫn tôi đi chợ phiên ở đầu làng. Đường đất nhỏ còn đọng sương, hai bên là những thửa ruộng đã chín vàng. Chợ tuy nhỏ nhưng người đến đông đủ, ai cũng muốn chọn đồ tươi ngon. Bà hỏi giá mấy quả đào, rồi mua thêm rau cải, một đôi đũa gỗ và ít bánh đa để đãi khách. Tôi đứng xem chú thợ rèn đập sắt, đôi tay chú vững chãi và dẻo dai. Đến trưa, bà dắt tôi vào quán nhỏ, gọi hai bát bún nóng hổi. Bà kể ngày xưa chợ còn đông hơn, người ta đi bộ cả đêm để kịp bán đồ. Trên đường về, nắng đã lên cao, gió thổi mát rượi. Tôi nghĩ mãi về những điều bà kể, và tự nhủ sẽ giữ gìn kỷ niệm đẹp đẽ ấy.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Bài kiểm tra đầu vào: Ngày đầu đến trường',
    isPlacement: true,
    content:
      'Ngày đầu tiên đến trường, tôi dậy thật sớm, mặc bộ đồ mới mẹ đã để sẵn từ đêm qua. Bố đèo tôi trên chiếc xe đạp cũ, đi qua con đường đất nhỏ vẫn còn đọng sương. Đứng trước cổng trường rộng lớn, tôi hồi hộp đến đỏ cả mặt và chẳng dám nói nửa lời. Cô giáo đứng đợi ở cửa lớp, dịu dàng đón từng đứa trẻ vào phòng học nhỏ. Cô dạy chúng tôi đọc chữ, đếm số và kể những câu chuyện thật dễ hiểu. Giờ ra chơi, đám bạn mới rủ tôi đá cầu dưới gốc phượng đỏ rực. Đến chiều, bố lại đến đón, hỏi tôi có muốn đi học nữa không. Tôi gật đầu thật mạnh, kể mãi không thôi về những điều đã thấy. Đêm ấy tôi ngủ say, mơ thấy mình được điểm mười đỏ chói.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Bài kiểm tra đầu vào: Đêm hội trăng rằm',
    isPlacement: true,
    content:
      'Đêm rằm tháng tám, cả xóm nhỏ của tôi rộn ràng đón trăng. Từ chiều, đám trẻ đã tụ tập ở sân đình để làm đèn ông sao. Chị Hai khéo tay dán giấy đỏ, còn tôi chỉ được giữ hồ và cắt những dải tua nhỏ. Khi mặt trăng đỏ lựng nhô lên khỏi rặng tre, đoàn rước đèn bắt đầu đi quanh xóm. Tiếng trống đập đều, những chiếc đèn đủ màu lung linh soi sáng cả con đường đất. Mẹ bày mâm cỗ với bánh dẻo, bánh nướng, bưởi và đĩa hồng đỏ ngọt lịm. Ông kể chuyện chú Cuội ngồi gốc cây đa, ai cũng chăm chú lắng nghe. Đến khuya, đám trẻ vẫn còn nán lại, chẳng đứa nào muốn về. Tôi nghĩ mãi về đêm hội ấy, mong năm nào cũng được đón trăng đông đủ như thế.',
    source: PASSAGE_SOURCE
  }
];
