# Thiết kế: Đấu xếp hạng 1v1 (Rank) và avatar thay đồ

Ngày: 2026-10-28 · Trạng thái: đã duyệt · Sprite: nhánh `feat/minigame-sprites` (thư mục `minigame-sprites/`)

## 1. Mục đích

TypeTrace hiện là app luyện gõ tiếng Việt (chấm lỗi dấu thanh, đ, hỏi/ngã). Phần này thêm **một chế độ thi đấu cạnh
tranh**: hai người vào cùng một phòng bằng mã, gõ đua cùng một đoạn tiếng Anh, người thắng được cộng điểm Elo. Điểm
xếp hạng theo mùa và phần thưởng là **đồ trang trí cho avatar pixel** (bộ sprite thay đồ đã vẽ). Mục tiêu là cho người
học lý do quay lại và so tài với bạn bè.

Người dùng chốt trong buổi brainstorm:

- Thi đấu là trọng tâm: thắng thua và thứ hạng là chính, không phải luyện lỗi.
- **Chỉ một chế độ có tính Elo**: đấu 1v1 xếp hạng. Không làm đấu thường, đột tử, mưa chữ hay thử thách hằng ngày lúc
  này.
- Thi đấu **chỉ dùng tiếng Anh** cho công bằng (bỏ qua vấn đề dấu tiếng Việt).
- Phần thưởng là **sprite avatar, đồ, phụ kiện, nền...** Avatar dùng bộ lớp trong `minigame-sprites/layers/`.
- Giao diện minigame và avatar **không cần theo bảng màu của `AGENTS.md`** (đỏ máu, không thêm màu nhấn).
- Kênh realtime: **SSE + REST** (cách A bên dưới).
- Build theo **6 giai đoạn**, mỗi giai đoạn một PR chạy được độc lập.

## 2. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu**

- Hai người đã đăng nhập đấu với nhau bằng mã phòng 6 ký tự, thấy tiến độ của nhau gần như tức thời.
- Server là nơi quyết định: giữ đoạn văn, chấm điểm, quyết định thắng thua, cập nhật Elo.
- Mỗi người có avatar ghép từ các lớp sprite, đổi đồ được, thấy avatar trên hồ sơ, header và trong trận.
- Có mùa giải, bậc hạng, bảng xếp hạng; phần thưởng mở khóa đồ.

**Không làm (lúc này)**

- Ghép trận tự động với người lạ, bot lấp phòng, phòng nhiều hơn 2 người, khán giả.
- Các minigame khác (đột tử, mưa chữ, thử thách ngày), đấu thường không tính Elo.
- Mua đồ bằng tiền thật. Thứ gì làm người chơi gõ nhanh hơn (chỉ có đồ trang trí).
- Đấu bằng tiếng Việt.

**Phản mục tiêu (làm ra mà dính những điều này là hỏng)**

- Gian lận được: client tự báo WPM, tự báo thắng, hay cày Elo bằng cách đấu đi đấu lại với bạn.
- Lộ dữ liệu riêng: email của đối thủ, bảng xếp hạng hiện email (golden rule 4 của `AGENTS.md`).
- Trận đấu làm hỏng phần luyện tập: trận không được tính vào hồ sơ lỗi tiếng Việt.

## 3. Ràng buộc từ code hiện có

- Theo `AGENTS.md`: tầng `routes → middlewares → controllers → services → models`, `validate()` cho mọi input,
  `paginate` cho danh sách, lỗi bằng `AppError`, module FE đăng ký trong `FE/src/app/modules.ts`, mọi thay đổi có test,
  `npm test`, `npm run lint`, `npm run build` phải qua, cập nhật tài liệu khi đổi quy tắc.
- Trang Typing đã có tab **Rank** bị khóa (`FE/src/modules/typing/pages/TypingPage.tsx:20-25`). Chế độ đấu vào đúng chỗ
  này.
- Server đã chấm từng chữ (`gradeWords`, `computeWpm`, `typedAtMs`, giới hạn `MAX_SESSION_MS` = 3 phút, chặn WPM > 200
  trong `BE/src/services/typing-session.service.ts`). Trận đấu dùng lại các hàm này.
- Đoạn văn (`BE/src/models/passage.model.ts`) **chưa có trường ngôn ngữ**; `tagCounts` chỉ có nghĩa với tiếng Việt.
- `BE/src/app.ts` có **giới hạn chung 300 request / 15 phút / IP**. Gửi tiến độ vài lần mỗi giây sẽ vượt mức này, nên
  đường gửi tiến độ cần giới hạn riêng.
- Đăng nhập bằng JWT trong header `Authorization`. `EventSource` của trình duyệt **không gửi header được**; không đưa
  token vào URL (bị ghi log, lộ qua lịch sử). FE đọc SSE bằng `fetch` + đọc luồng (`ReadableStream`), gửi header bình
  thường.
- Chỉ chạy **một tiến trình backend**: trạng thái phòng đang đấu và danh sách người nghe SSE giữ trong bộ nhớ. Ghi rõ
  giới hạn này trong code (`ponytail`-style comment) và chỉ cách nâng cấp (Redis pub/sub) khi chạy nhiều tiến trình.

## 4. Các cách làm realtime đã cân nhắc

| Cách | Được | Mất |
|---|---|---|
| **A. SSE + REST (đã chọn)** | Không thêm thư viện, Express làm được; test kiểu `api()` như cũ; hợp tinh thần dự án cho sinh viên | Hai kênh (POST lên, SSE xuống); trạng thái trong bộ nhớ, một tiến trình |
| B. Socket.IO | Phòng và kết nối lại có sẵn | Thêm thư viện cả hai phía, test khác hẳn kiểu hiện có |
| C. Hỏi server định kỳ (~0,5 s) | Đơn giản nhất | Trễ, tốn request, đụng giới hạn request |

Người dùng chọn A theo đề xuất: với game gõ, mỗi phòng 2 người, vài cập nhật mỗi giây, SSE là đủ.

## 5. Luật trận đấu

- **Bắt đầu**: người tạo phòng chờ; khi đủ hai người, **cả hai bấm Sẵn sàng** thì server đếm ngược 3 giây rồi bắt đầu.
  Bỏ Sẵn sàng được cho tới lúc đếm ngược. (Chọn bởi người viết tài liệu: tránh trận bắt đầu bất ngờ khi người kia vừa
  vào.)
- **Gõ sai rồi quay lại sửa**: được. Mỗi lần gửi tiến độ là toàn bộ chữ đã gõ tới hiện tại; server chấm lại toàn bộ, nên
  số chữ đúng có thể giảm khi sửa sai thành sai khác. Chỉ **số chữ đã gửi** không được giảm quá 1 chữ đang gõ dở.
  `TypingArea` giữ nguyên, không khóa chữ đã xong.
- **Hết trận sớm**: trận kết thúc ngay khi người đầu tiên về đích với độ chính xác ≥ 90%; người kia thua (vẫn ghi số
  chữ đúng của họ). Ai về đích dưới 90% thì chờ người kia, rồi so theo luật bên dưới.

- **Đoạn văn**: server chọn ngẫu nhiên một đoạn `language: 'en'`, `status: 'published'`, `visibility: 'public'`, từ 30
  đến 80 chữ. Hai người gõ cùng đoạn. Chữ được chụp vào trận lúc bắt đầu (như `targetWords` của phiên gõ).
- **Thời gian**: tối đa `MAX_SESSION_MS` (3 phút) kể từ lúc bắt đầu.
- **Đồng hồ là của server**: đếm ngược 3 giây do server phát; mốc bắt đầu và mốc về đích lấy giờ server. `typedAtMs` của
  client chỉ dùng để kiểm tra hợp lệ (tăng dần, không vượt thời lượng), không quyết định thắng thua.
- **Về đích** = gõ hết số chữ của đoạn. Độ chính xác = chữ đúng / số chữ của đoạn.
- **Thắng**: người về đích trước **với độ chính xác ≥ 90%**. Người về đích dưới 90% xếp sau người đạt ngưỡng.
  - Cả hai đều không đạt ngưỡng, hoặc hết giờ mà chưa ai về đích: so số chữ đúng; bằng nhau là **hòa**.
- **Bỏ trận**: rời trang, mất kết nối quá 15 giây, hoặc bấm đầu hàng = thua. Ai bỏ trước khi trận bắt đầu thì phòng bị
  hủy, không tính Elo.
- **Chống gian lận**: chặn WPM > 200 như phiên gõ (trận bị đánh dấu không tính Elo, người vượt ngưỡng thua); tiến độ chỉ
  được tăng, không lùi; chữ gửi lên phải khớp thứ tự; một người chỉ ở một phòng đang mở tại một lúc.
- **Chống cày Elo**: một cặp người chơi chỉ tính Elo tối đa **3 trận mỗi ngày** (trận thứ 4 trở đi vẫn chơi được,
  không đổi điểm). Ghi rõ trong màn kết quả.
- **"Ngày"** (giới hạn cặp và giới hạn xu) tính theo **giờ Việt Nam (UTC+7)**, đổi ngày lúc 0:00 giờ Việt Nam.
- **Đấu lại**: nút ở màn kết quả tạo một **phòng mới** và gửi sự kiện `rematch` (kèm mã mới) qua luồng SSE của phòng cũ;
  đối thủ thấy lời mời và bấm để vào. Phòng cũ giữ trạng thái `finished` làm lịch sử. Luồng của phòng cũ đóng sau 2
  phút.

## 6. Elo, mùa giải, bậc hạng

- Điểm khởi đầu mỗi mùa: **1000**. Công thức Elo: `E = 1 / (1 + 10^((Rđối − Rmình) / 400))`,
  `R' = R + K × (S − E)`, `S` = 1 thắng / 0,5 hòa / 0 thua, **K = 32** (10 trận đầu mùa của một người: K = 40 để lên
  đúng hạng nhanh).
- **Mùa** dài 8 tuần. **Luôn có đúng một mùa đang chạy**: mùa 1 tự tạo ở lần đầu cần tới; đóng một mùa thì mùa kế tiếp
  mở ngay. Không cần lịch chạy nền: request xếp hạng đầu tiên sau `endsAt` sẽ đóng mùa (đóng "lười"); admin cũng đóng
  sớm được. Vì vậy trận nào cũng có mùa và trận nào cũng có thể tính Elo.
- **Reset mềm khi đóng mùa**: người đã chơi mùa cũ được tạo sẵn `SeasonRating` ở mùa mới với điểm
  `1000 + (điểm cũ − 1000) / 2`; người mới vào mùa bắt đầu ở 1000. Thưởng theo **bậc cao nhất đạt được trong mùa**.
- Giai đoạn 3–4 ra trước giai đoạn 5: trong khoảng đó trận chơi được nhưng **không tính Elo** (`rated: false`), màn kết
  quả ghi "Xếp hạng sắp có".
- **Bậc**: Đồng < 1100 ≤ Bạc < 1250 ≤ Vàng < 1400 ≤ Bạch kim < 1550 ≤ Kim cương < 1700 ≤ Huyền thoại.
- Bảng xếp hạng mùa: tên hiển thị (hoặc `ANONYMOUS_OWNER_NAME`-kiểu "Người chơi ẩn danh"), avatar, điểm, bậc, số trận,
  tỉ lệ thắng. **Không bao giờ hiện email.** Cần ít nhất 5 trận mới lên bảng.

## 7. Avatar và phần thưởng

- **Ô đồ** (từ `minigame-sprites/layers/manifest.json`): `skin`, `face`, `hair`, `top`, `bottom`, `shoes`, `headwear`,
  `accessory`, `back`, `effect`. Khung ảnh 76×76, thân 64×64 dời 6px phải 12px xuống. Thứ tự chồng lớp và quy tắc chọn
  file theo tư thế (`idle`, `typing`, `win`, `lose`) nằm trong manifest.
- **Đồ khởi đầu miễn phí**: mọi màu da, cả hai kiểu mặt, tóc `short` và `long` mọi màu, áo hoodie mọi màu, quần thường
  mọi màu, `sneakers-brown`. Mọi người mới có avatar mặc định giống preset `rookie`.
- **Xu**: thắng 20, hòa 10, thua 5 (chỉ trận có tính Elo); tối đa 200 xu mỗi ngày. Không mua xu bằng tiền.
- **Cửa hàng**: mỗi món còn lại có giá 50–300 xu (bảng giá đặt trong `BE/src/data/avatar-catalog.ts`).
- **Thưởng bậc cuối mùa**: một số món chỉ mở bằng bậc (ví dụ hào quang = Huyền thoại, vương miện = Kim cương, cánh thiên
  thần = Bạch kim, hiệu ứng sao = Vàng). Món theo mùa giữ mãi sau khi mở.
  - **Cộng dồn**: đạt bậc nào thì nhận món của bậc đó và mọi bậc thấp hơn.
  - Món đã có rồi thì **đổi thành xu** (bằng giá món, hoặc 100 xu nếu món không bán).
  - **Mỗi mùa thêm một món riêng của mùa** (ví dụ một màu hay hiệu ứng mới, khai báo trong `Season.rewardItem`) cho
    bậc Vàng trở lên, để mùa nào cũng có thứ mới. Người dùng duyệt cách này.
- Server là nơi kiểm tra: chỉ mặc được món đã sở hữu; mua món phải đủ xu (trừ xu và thêm món trong một lệnh cập nhật
  có điều kiện để không mua trùng hay âm xu).

## 8. Dữ liệu

Tên trường bằng tiếng Anh như code hiện có.

- `Passage` (sửa): thêm `language: 'vi' | 'en'`, mặc định `'vi'`; index `{ language, status, visibility, wordCount }`.
  Đoạn tiếng Anh không có thẻ lỗi (`tagCounts` toàn 0).
- `User` (sửa): `avatar: { skin, face, hair, top, bottom, shoes, headwear?, accessory?, back?, effect? }` (mặc định
  preset `rookie`), `ownedItems: string[]` (dạng `slot:item`, chỉ chứa món không miễn phí), `coins: number`. Các trường
  này là công khai (không vào `PRIVATE_USER_FIELDS`), nhưng chỉ chủ tài khoản thấy `coins` và `ownedItems`.
- `Match` (mới): `code` (6 ký tự in hoa, bỏ các ký tự dễ nhầm `0 O 1 I`), `status: 'waiting' | 'countdown' | 'running' |
  'finished' | 'cancelled'`, `season`, `passageId`, `passageTitle`, `targetWords`, `startedAt`, `endedAt`,
  `players: [{ user, displayName, avatar, ratingBefore, ratingAfter, typedWords, typedAtMs, correctWords, accuracy,
  finishedAt, result: 'win' | 'loss' | 'draw' | 'forfeit' }]`, `rated: boolean`. Phòng `waiting` hết hạn sau 10 phút.
  Index `{ code: 1 }` duy nhất trong các phòng chưa kết thúc (partial index), `{ 'players.user': 1, createdAt: -1 }`.
- `Season` (mới): `number`, `startsAt`, `endsAt`, `status: 'active' | 'closed'`, `rewardItem?` (món riêng của mùa).
  Chỉ một mùa `active`.
- `SeasonRating` (mới): `user`, `season`, `rating`, `peakRating`, `matches`, `wins`, `losses`, `draws`. Index duy nhất
  `{ season, user }`, index `{ season, rating: -1 }` cho bảng xếp hạng.

## 9. API (tất cả cần `authGuard`)

| Phương thức và đường dẫn | Việc |
|---|---|
| `POST /api/matches` | Tạo phòng → `{ code }` |
| `POST /api/matches/:code/join` | Vào phòng bằng mã (404 nếu không có, 409 nếu đủ người hoặc đã bắt đầu, 400 nếu tự vào phòng mình) |
| `GET /api/matches/:code/events` | Luồng SSE: `state` (người chơi, trạng thái), `countdown`, `progress` (số chữ đã gõ và số chữ đúng của từng người), `result`. Gửi `ping` mỗi 15 giây |
| `POST /api/matches/:code/ready` | `{ ready: boolean }`; đủ hai người sẵn sàng thì server đếm ngược (sự kiện `countdown`) |
| `POST /api/matches/:code/rematch` | Chỉ sau khi trận kết thúc: tạo phòng mới, phát `rematch` kèm mã mới trên luồng phòng cũ |
| `POST /api/matches/:code/progress` | `{ typedWords, typedAtMs }` từ đầu tới chữ hiện tại; server chấm lại và phát `progress`. Giới hạn riêng (ví dụ 20 lần/giây mỗi người), không tính vào giới hạn chung |
| `POST /api/matches/:code/leave` | Rời phòng / đầu hàng |
| `GET /api/matches/:code` | Trạng thái phòng (khi tải lại trang) |
| `GET /api/ranked/me` | Điểm, bậc, số trận mùa hiện tại của mình |
| `GET /api/ranked/leaderboard` | Bảng xếp hạng mùa, `paginate` |
| `GET /api/avatar/catalog` | Danh sách món, giá, cách mở khóa, món mình đã có |
| `PUT /api/avatar` | Đổi bộ đồ (chỉ món đã có) |
| `POST /api/avatar/buy` | `{ item }` mua món bằng xu |
| `POST /api/admin/seasons`, `POST /api/admin/seasons/:id/close` | Mở mùa, đóng mùa (phát thưởng bậc) |

## 10. Màn hình

- **Tab Rank** trên trang Typing (bỏ khóa). Khi chọn: ẩn nút chọn đoạn và thời gian, hiện hai nút **Tạo phòng** và
  **Vào phòng** (ô nhập mã), kèm điểm và bậc của mình.
- **Phòng chờ**: mã phòng to, nút sao chép, avatar hai người (người còn trống là khung chờ), trạng thái sẵn sàng.
- **Trận**: vùng gõ như chế độ luyện tập; phía trên là hai làn đua với avatar tư thế `typing` chạy theo tiến độ.
- **Kết quả**: avatar tư thế `win`/`lose`, WPM, độ chính xác, điểm Elo cộng/trừ, xu nhận được, nút đấu lại.
- **Hồ sơ và header**: thay chữ viết tắt bằng avatar (tư thế `idle`), thêm bậc hạng.
- **Tủ đồ**: trang mới (mục trong menu avatar), chia tab theo ô đồ, xem trước avatar, mặc, mua.
- **Bảng xếp hạng**: trang mới trong thanh điều hướng.
- **Admin**: mục Mùa giải trong sidebar admin; bộ lọc ngôn ngữ trong trang Passages.
- Ảnh sprite phóng to bằng `image-rendering: pixelated`.

## 11. Các giai đoạn build

Mỗi giai đoạn là một PR, có test, `npm test`/`lint`/`build` qua.

1. **Đoạn văn tiếng Anh**: trường `language`, cập nhật validator và admin Passages (lọc và chọn ngôn ngữ), `npm run
   import:passages:en` nạp 20–30 đoạn tiếng Anh có nguồn cho phép dùng lại. Practice và Placement vẫn chỉ lấy `vi`.
2. **Avatar và tủ đồ**: đưa `layers/` vào `FE/public/avatar/` (script build ghi thẳng vào đó), component `Avatar`
   (ghép lớp theo manifest), trường `avatar`/`ownedItems`/`coins` trên User, `BE/src/data/avatar-catalog.ts`, API avatar,
   trang Tủ đồ, avatar trên hồ sơ và header. Chưa có xu để kiếm (mọi món ngoài đồ khởi đầu vẫn khóa).
3. **Phòng 1v1 (backend)**: model `Match`, dịch vụ phòng trong bộ nhớ + phát SSE, các API trận, luật thắng, chống gian
   lận, test tích hợp (tạo, vào, đua, về đích, bỏ trận, hết giờ, chặn WPM).
4. **Giao diện đấu**: bỏ khóa tab Rank, phòng chờ, trận, kết quả, đọc SSE bằng `fetch`, kết nối lại khi tải trang.
5. **Elo và mùa giải**: `Season`, `SeasonRating`, cập nhật Elo khi trận kết thúc, chống cày theo cặp, bảng xếp hạng,
   admin mở/đóng mùa.
6. **Phần thưởng**: xu sau trận (có giới hạn ngày), cửa hàng trong Tủ đồ, thưởng bậc khi đóng mùa.

## 12. Tài liệu cần cập nhật (golden rule 7)

- `AGENTS.md` mục Design: ghi ngoại lệ cho avatar và màn đấu (dùng bảng màu riêng của sprite); ghi luật "đọc SSE bằng
  fetch, không token trong URL"; thêm lệnh `import:passages:en`.
- `BE/docs/architecture.md` và `FE/docs/architecture.md`: module mới (matches, ranked, avatar), cách test SSE.

## 13. Để người build quyết

- Tên component, cách chia file trong module, cách vẽ làn đua.
- Cách test SSE (đọc vài sự kiện đầu của luồng trong test tích hợp, hoặc test dịch vụ phát sự kiện riêng).
- Danh sách cụ thể đoạn tiếng Anh (miễn có nguồn cho phép dùng lại, ghi trong `source`).
- Giá từng món trong khoảng 50–300 xu, và món nào là thưởng bậc (theo gợi ý ở mục 7).
