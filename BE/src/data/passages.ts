// Starter passages for the passage bank (SCRUM-95, US6.2). Every text is written for TypeTrace, so it is free to reuse.
// Add passages here and run `npm run import:passages`: passages already in the bank (same title) are left untouched.
import type { PassageLanguage } from '../models/passage.model';

export const PASSAGE_SOURCE = 'Tự biên soạn cho TypeTrace';

export interface PassageSeed {
  title: string;
  content: string;
  source: string;
  isPlacement?: boolean;
  /** Missing = Vietnamese. The English passages (for ranked duels) are in `passages-en.ts`. */
  language?: PassageLanguage;
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
    title: 'Cây bàng trước ngõ',
    content:
      'Trước ngõ nhà em có một cây bàng già. Mùa đông, lá bàng đỏ rực rồi rụng hết, chỉ còn những cành khẳng khiu. Sang xuân, cây lại nảy chồi non xanh mướt. Mùa hè, tán bàng xòe rộng như chiếc ô che nắng cho lũ trẻ ngồi chơi.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Chiếc xe đạp cũ',
    content:
      'Chiếc xe đạp cũ của bố đã theo em suốt những năm cấp hai. Sơn xe bong tróc, yên xe hơi cứng, nhưng mỗi sáng nó vẫn chở em đến trường đúng giờ. Em lau xe sạch sẽ, tra dầu cẩn thận và coi nó như một người bạn thân.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Cơn mưa đầu hạ',
    content:
      'Cơn mưa đầu hạ đến rất nhanh. Bầu trời đang nắng bỗng tối sầm, gió thổi mạnh làm lá cây xào xạc. Chỉ vài phút sau, mưa rơi ào ào trên mái tôn. Khi mưa tạnh, không khí mát dịu và đường phố sạch bong.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Chợ nổi Cái Răng',
    content:
      'Từ bốn giờ sáng, chợ nổi Cái Răng ở Cần Thơ đã tấp nập ghe thuyền. Mỗi chiếc ghe treo một cây sào cao, trên đó buộc thứ hàng mà ghe bán: bí đỏ, khoai lang, dưa hấu hay thanh long. Người mua chèo xuồng nhỏ len lỏi giữa các ghe lớn để trả giá. Mặt trời lên dần, tiếng gọi nhau í ới hòa cùng tiếng máy nổ, tạo nên một bức tranh rất riêng của miền Tây sông nước.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Phở bò buổi sớm',
    content:
      'Sáng chủ nhật, ông nội dắt em ra quán phở đầu phố. Nồi nước dùng ninh từ đêm hôm trước tỏa mùi quế, hồi và gừng nướng thơm lừng. Bác chủ quán thoăn thoắt trụng bánh, xếp thịt bò tái lên trên rồi chan nước dùng nóng hổi. Em rắc thêm hành lá, vắt một miếng chanh và húp thử một thìa. Vị ngọt thanh làm em nhớ mãi.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Bà ngoại kể chuyện',
    content:
      'Những tối mất điện, cả nhà quây quần bên ngọn đèn dầu nghe bà ngoại kể chuyện. Bà kể về cây khế ăn một quả trả cục vàng, về Thạch Sanh hiền lành chém chằn tinh, về cô Tấm dịu dàng bước ra từ quả thị. Giọng bà chậm rãi, lúc trầm lúc bổng, khiến chúng em nín thở lắng nghe. Lớn lên, em đã đọc lại những câu chuyện ấy trong sách, nhưng chẳng trang sách nào ấm áp bằng giọng kể của bà.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Đội bóng của lớp',
    content:
      'Chiều thứ bảy nào đội bóng của lớp cũng ra sân tập. Đội trưởng Minh hô to để cả đội khởi động, chạy ba vòng quanh sân rồi tập chuyền bóng theo cặp. Có hôm trời nắng gắt, mồ hôi ướt đẫm áo, nhưng không ai bỏ về sớm. Ở trận chung kết của trường năm nay, đội em thua sát nút. Thầy chủ nhiệm vỗ vai từng bạn và nói: thắng thua không quan trọng bằng việc các em đã cố gắng hết mình.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Ruộng bậc thang',
    content:
      'Tháng chín, ruộng bậc thang ở Mù Cang Chải chuyển sang màu vàng óng. Từ trên đỉnh đèo nhìn xuống, những thửa ruộng uốn lượn nối nhau như những bậc cầu thang khổng lồ dẫn lên trời. Người dân tộc Mông đã khai phá sườn núi qua bao thế hệ, giữ nước từ khe suối để trồng lúa. Mỗi mùa gặt, du khách khắp nơi lại tìm về để ngắm cảnh và chụp những bức ảnh thật đẹp.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Tết đoàn viên',
    content:
      'Những ngày cuối năm, phố phường rộn ràng hơn hẳn. Mẹ dọn dẹp nhà cửa, lau bàn thờ và cắm một bình hoa đào thật đẹp. Bố cùng em đi chợ hoa, chọn một cây quất sai trĩu quả để bày ở phòng khách. Chiều ba mươi Tết, cả nhà quây quần gói bánh chưng. Lá dong được rửa sạch, gạo nếp ngâm từ tối hôm trước, đỗ xanh và thịt lợn đã chuẩn bị sẵn. Ông nội gói khéo nhất, chiếc bánh nào cũng vuông vức. Đêm giao thừa, nồi bánh sôi lục bục bên bếp lửa hồng, mọi người ngồi kể cho nhau nghe chuyện cũ. Khi pháo hoa rực sáng trên bầu trời, em chúc ông bà mạnh khỏe, chúc bố mẹ một năm mới an lành. Với em, Tết là lúc được ở bên những người mình thương yêu nhất.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Học lập trình',
    content:
      'Năm lớp mười, em bắt đầu tự học lập trình qua các bài giảng miễn phí trên mạng. Lúc đầu, em chỉ viết được vài dòng lệnh để in ra màn hình một câu chào. Có những lỗi nhỏ như thiếu một dấu chấm phẩy khiến em mất cả buổi tối để tìm. Dần dần, em học cách chia bài toán lớn thành nhiều phần nhỏ, đặt tên biến rõ ràng và viết chú thích cho người khác dễ hiểu. Em còn tham gia một nhóm bạn cùng sở thích, mỗi tuần làm chung một dự án nhỏ. Điều quý giá nhất em nhận được không phải là những dòng mã chạy đúng, mà là sự kiên nhẫn và thói quen suy nghĩ cẩn thận trước khi bắt tay vào làm.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Vịnh Hạ Long',
    content:
      'Vịnh Hạ Long nằm ở tỉnh Quảng Ninh, nổi tiếng với hàng nghìn hòn đảo đá vôi nhô lên giữa làn nước xanh ngọc. Mỗi hòn đảo mang một dáng vẻ riêng: có hòn giống hai con gà đang chọi nhau, có hòn trông như chiếc lư hương. Du khách thường đi thuyền ngắm cảnh, ghé thăm các hang động rộng lớn với những khối thạch nhũ lấp lánh. Buổi chiều, mặt trời lặn dần sau dãy núi, nhuộm cả mặt vịnh một màu cam đỏ. Năm 1994, nơi đây được công nhận là di sản thiên nhiên thế giới. Giữ gìn vẻ đẹp ấy là trách nhiệm của mỗi chúng ta.',
    source: PASSAGE_SOURCE
  },
  {
    title: 'Lời khuyên của thầy',
    content:
      'Ngày cuối cấp, thầy giáo dạy văn gửi cả lớp vài lời khuyên. Thầy bảo đừng vội nản lòng khi gặp chuyện khó, vì ai cũng có lúc vấp ngã. Hãy nghĩ kỹ trước khi nói, giữ lời hứa dù là việc nhỏ, và biết nói lời cảm ơn, xin lỗi đúng lúc. Mỗi ngày đọc thêm vài trang sách, ngủ đủ giấc và dành thời gian cho gia đình. Thầy cũng nhắc chúng em giữ gìn sự trong sáng của tiếng Việt, viết đúng chính tả và phân biệt rõ dấu hỏi, dấu ngã. Những lời dặn giản dị ấy, đến bây giờ em vẫn nhớ như in.',
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
