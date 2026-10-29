# Thiết kế: Mưa chữ đấu đôi xếp hạng (Rain duel)

Ngày: 2026-10-29 · Trạng thái: chờ duyệt · Dựa trên: `2026-10-28-ranked-duel-design.md` (Ranked), mưa chữ một người
(`FE/src/modules/rain`, plans `2026-10-29-word-rain-*`).

## 1. Mục đích

Một chế độ đấu 1v1 thứ hai trong Ranked: hai người chơi mưa chữ cùng lúc, gõ trúng một từ thì từ đó bị ném sang sân
đối thủ. Ai để từ chạm đầu avatar 3 lần trước thì thua. Trận tính Elo và xu như đấu Ranked hiện có.

Điều người dùng đặt ra: **công bằng cho mọi bên**. Mọi quyết định bên dưới phục vụ điều đó: cùng một trận mưa cho hai
người, server là trọng tài duy nhất, độ trễ mạng không cho ai lợi thế đáng kể.

## 2. Mục tiêu, không làm, không được xảy ra

**Mục tiêu**
- Tạo phòng / vào phòng bằng mã / sẵn sàng / đếm ngược / đấu lại như Ranked hiện có, có chọn kiểu trận "Race" (đua
  gõ đoạn văn, như cũ) hoặc "Rain" (mới) khi tạo phòng.
- Màn đấu bố cục B (đã chọn): sân của mình lớn (`RainStage`), sân đối thủ thu nhỏ bên phải; trên điện thoại sân đối
  thủ là một dải mỏng phía trên.
- Bốn khoảnh khắc chuyển động (đã duyệt): ném từ, bị ném từ, mất mạng, K.O. rồi màn kết quả Ranked (rating, xu).
- **Elo riêng cho từng kiểu trận** (người dùng chọn): Race và Rain mỗi kiểu một rating, một bậc và một bảng xếp hạng trong cùng mùa giải; xu và mùa giải dùng lại `rating.service.ts` và `season.service.ts`.

**Không làm (lúc này)**
- Ghép trận tự động với người lạ, khán giả, phòng hơn 2 người.
- Âm thanh, power-up, chọn độ khó.
- Mưa chữ đấu bằng tiếng Việt.

**Không được xảy ra (dù chạy được vẫn là hỏng)**
- Một người sửa code trình duyệt mà không mất mạng, hoặc ném từ không có thật.
- Người có mạng nhanh thắng chỉ vì mạng nhanh.
- Một trận treo mãi (không ai chạm đất, server khởi động lại giữa trận) hoặc phát Elo / xu hai lần.

## 3. Ràng buộc

- Backend chạy **một tiến trình** (AGENTS.md): trạng thái trận đang đấu được giữ trong bộ nhớ như `match-hub`; luồng
  sự kiện là SSE + REST như Ranked, `fetch` với header `Authorization`, không đặt token trong URL.
- Theo spec Ranked: **thi đấu chỉ dùng tiếng Anh** (không có vấn đề bộ gõ, công bằng cho mọi người). Từ của mưa chữ đấu
  đôi lấy từ các đoạn tiếng Anh (`passages-en`), không từ kho từ tiếng Việt.
- Không thêm thư viện. Dùng lại `withMatchLock`, `schedule`, `cancelTimer`, `publish`, `publishTo` của `match-hub.ts`.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Đánh đổi |
|---|---|---|
| 1. Vòng lặp server | Mỗi trận một đồng hồ 100 ms chạy luật cho cả hai người, gửi toàn bộ trạng thái | Chống gian lận tuyệt đối; 10 lần xử lý / giây mỗi trận trên một tiến trình, nhiều sự kiện |
| **2. Server giữ lịch, theo sự kiện (đã chọn)** | Server quyết định từ nào sinh, khi nào, ở đâu, rơi bao lâu; mỗi từ một hẹn giờ chạm đất; trúng thì hủy hẹn giờ | Chống gian lận như cách 1, server chỉ làm việc khi có chuyện; cần bù độ trễ |
| 3. Trình duyệt tự chạy, server kiểm tra sau | Nhẹ nhất | Gian lận chỉ lộ sau khi Elo đã cộng: loại |

Người dùng giao lựa chọn cho Claude với điều kiện "công bằng mọi bên"; Claude chọn cách 2.

## 5. Luật chơi

**Một trận chung cho hai người.** Server dựng sẵn một **lịch mưa** khi trận bắt đầu: danh sách từ (cùng thứ tự), làn,
thời điểm sinh và thời gian rơi. Hai người nhận **cùng một lịch**. Khác biệt duy nhất giữa hai sân là các từ đối thủ
ném sang.

| Thông số (trong `rainDuelSettings`, chỉnh được, test dùng giá trị nhỏ) | Giá trị |
|---|---|
| Mạng | 3 |
| Làn | 6 trên máy tính; sân hẹp chỉ thu nhỏ hình vẽ, không đổi số làn (hai người phải cùng luật) |
| Thời gian rơi | 7000 → 3500 ms, giảm tuyến tính theo thời gian trận |
| Khoảng sinh từ | 1800 → 700 ms |
| Thời lượng tối đa | 120 s; hết giờ mà chưa ai K.O. thì xem §5 "Kết thúc" |
| Từ bị ném | rơi bằng tốc độ hiện tại của trận × 1,15, viền đứt nét |
| Trần từ bị ném | tối đa 3 từ bị ném đang rơi trên một sân; từ thứ 4 xếp hàng, rơi khi có chỗ |
| Ân hạn độ trễ | 150 ms (xem §6) |

- **Gõ trúng** (cách hoặc Enter, như mưa chữ một người; so khớp chính xác, chữ thường): từ biến mất khỏi sân mình và
  một bản sao rơi ở sân đối thủ, làn ngẫu nhiên do server chọn trong các làn trống. Một từ bị ném sang mình, khi mình
  gõ trúng, **không** ném ngược lại (chặn vòng ném qua ném lại vô tận); nó chỉ tính điểm.
- **Nhắm từ** chạy ở trình duyệt như mưa chữ một người (chỉ để tô chữ); server tự tìm từ khớp khi nhận lần gửi.
- **Chạm đất:** hẹn giờ của từ trên server kêu → mất một mạng. Hết mạng → thua.
- **Kết thúc:** K.O. ngay khi một người hết mạng. Hết 120 s: nhiều mạng hơn thắng; bằng mạng thì nhiều từ trúng hơn
  thắng; vẫn bằng thì hòa. Rời phòng hoặc mất kết nối quá `disconnectGraceMs` → thua forfeit như Ranked.
- **Hai người chạm đất 3 lần trong cùng ân hạn:** hòa.

## 6. Công bằng và độ trễ

- **Đồng hồ:** server là nguồn thời gian. Mọi sự kiện mang `serverNow`; trình duyệt giữ độ lệch nhỏ nhất đo được
  (`offset = serverNow - (sentAt + rtt/2)` theo mẫu có RTT nhỏ nhất) để vẽ vị trí từ theo `bornAt` / `fallMs`.
- **Chấm trúng:** server dùng **thời điểm nó nhận** lần gửi, không tin thời gian trình duyệt gửi. Một từ được tính trúng
  nếu `nhận ≤ landsAt + 150 ms`. Hẹn giờ chạm đất vì vậy kêu ở `landsAt + 150 ms`, nên ân hạn như nhau cho cả hai người
  bất kể mạng nhanh hay chậm (người mạng chậm hơn 150 ms một chiều chịu thiệt; đó là trần được chấp nhận).
- **Ném sang:** bản sao bắt đầu rơi ở thời điểm server chấm trúng; đối thủ nhận sự kiện trễ đúng bằng độ trễ của họ,
  vẽ từ theo `bornAt` nên vị trí vẫn khớp.
- **Không tin trình duyệt:** chỉ có hai việc trình duyệt được làm: gửi từ đã gõ, và báo sẵn sàng / rời. Lần gửi phải là
  một từ đang rơi trên sân mình (không thì bỏ qua, không phạt), giới hạn tốc độ như `progressLimiter` của Ranked.
- **Kết nối lại:** mở lại luồng → server gửi ngay một `snapshot` đủ (hai sân, mạng, điểm, lịch còn lại, `serverNow`);
  trình duyệt vẽ lại từ đó, không trông vào việc nhận đủ từng sự kiện.
- **Server khởi động lại giữa trận:** trạng thái trong bộ nhớ mất; khi đọc lại trận `playing` không còn trạng thái, trận
  kết thúc không tính hạng (`unratedReason: 'interrupted'`), như cách Ranked xử lý trận treo.

## 7. Phần xây dựng

**Backend**
- `Match` thêm `kind: 'race' | 'rain'` (mặc định `race`, trận cũ không đổi). Trận `rain` không dùng `targetWords` / WPM;
  `MatchPlayer` thêm `lives`, `hits` (số từ trúng), `thrown` (số từ đã ném) để lưu kết quả và chấm kết thúc.
- `services/rain-duel.service.ts`: dựng lịch mưa (từ tiếng Anh từ `passages-en`, xáo một lần cho trận), trạng thái trong
  bộ nhớ theo mã phòng (`Map`), `submitWord(userId, code, text)`, hẹn giờ sinh và chạm đất qua `schedule`, kết thúc trận
  gọi luồng kết thúc / `rateMatch` / thưởng xu sẵn có. Mọi thay đổi qua `withMatchLock`. Kết thúc dọn mọi hẹn giờ
  (`cancelTimer`) và xóa trạng thái trong bộ nhớ.
- Route: `POST /api/matches` nhận `{ kind }`; `POST /api/matches/:code/rain` `{ text }` (gửi một từ).
- Sự kiện SSE mới: `rain:spawn` (một từ mới trên một sân: `id`, `side`, `text`, `lane`, `bornAt`, `fallMs`, `thrown`),
  `rain:hit` (`id`, `side`, có ném sang không), `rain:land` (`id`, `side`, `lives`), `rain:snapshot`, kèm `serverNow`.
  `result` dùng chung với Ranked.

**Frontend** (`modules/ranked`, dùng lại `modules/rain`)
- Lobby Rank: chọn Race / Rain khi tạo phòng; phòng hiện kiểu trận.
- `RainDuelView`: sân lớn `RainStage` (thêm prop `clockOffset` và nhận `bornAt` thay vì để CSS quyết định), sân nhỏ
  `RainStage` thu gọn (`compact`: không ô gõ, không trang trí, chữ nhỏ), HUD hai bên (mạng, số từ).
- Chuyển động mới (CSS, theo các class `rain-*` và `duel-*` có sẵn):
  - `rain-throw`: bản sao bay theo đường cong từ sân mình sang sân nhỏ (0,45 s), làm bằng một phần tử phủ toàn màn,
    `offset-path` hoặc transform hai bước.
  - `rain-incoming`: viền trên sân lóe đỏ và dải "Lan ném sang: trăng" (1,2 s).
  - `rain-opponent-hit`: sân nhỏ lóe đỏ, rung, trái tim vỡ.
  - K.O.: dùng lại `duel-slam` và tư thế `win` / `lose`, rồi `MatchResult` có sẵn.
  - Giảm chuyển động: bỏ đường bay và rung, giữ màu lóe và dải chữ (đó là thông tin).
- Trong trận đấu đôi, **lượt mất mạng chỉ đến từ sự kiện server**; `onLand` của CSS không còn trừ mạng.

## 8. Quyết định nhỏ Claude tự chọn (người dùng kiểm khi đọc)

- **Từ:** gộp chữ của mọi đoạn tiếng Anh đã xuất bản, chữ thường, bỏ dấu câu, giữ từ 3–10 chữ cái, bỏ trùng; mỗi trận xáo
  ra đủ cho 120 s (khoảng 120 từ), cùng thứ tự cho hai người.
- **Không truyền chữ đang gõ dở của đối thủ** (mockup có dòng "đang gõ cầ"): chỉ gửi từ đã trúng, để ít sự kiện và không
  lộ ý định. Sân nhỏ chỉ cho thấy vị trí các từ, mạng và số từ.
- **Xu và giới hạn ngày** như Ranked: `MATCH_COINS` và `DAILY_COIN_LIMIT` dùng chung cho cả hai kiểu trận.
- **Đấu lại** giữ nguyên kiểu trận; luật "một người một phòng" áp dụng chung cho cả hai kiểu.
- **Sân hẹp:** giữ 6 làn cho cả hai người (cùng luật); chữ trên điện thoại nhỏ lại và sân cao hơn.

## 9. Phần để người xây quyết

Tên hàm, cấu trúc file nhỏ, cách vẽ đường cong (`offset-path` hay hai transform), cách đo RTT (từ `ping` có sẵn hay từ
phản hồi `POST .../rain`), cách chia task trong plan.

## 10. Elo riêng từng kiểu trận (đã chốt)

- `SeasonRating` thêm `kind: 'race' | 'rain'` (mặc định `race`: các rating hiện có là Race). Index duy nhất thành `{ season, user, kind }`, bảng xếp hạng `{ season, kind, rating: -1 }`. `rateMatch` đọc và ghi rating theo `match.kind`.
- Mỗi kiểu có điểm khởi đầu mùa và soft reset riêng khi đóng mùa; người chưa đấu Rain lần nào bắt đầu Rain ở điểm khởi đầu như người mới.
- `GET /api/ranked/me` và `/leaderboard` nhận `kind` (mặc định `race`, nên FE cũ không đổi); trang Leaderboard có hai tab Race / Rain; sảnh Rank hiện rating và bậc của kiểu đang chọn.
- **Thưởng bậc khi đóng mùa:** mỗi kiểu trao thưởng theo bậc của nó; món đã có (vì kiểu kia đã cho) đổi thành xu như hiện nay (`OWNED_REWARD_COINS`). Đây là lựa chọn của Claude: chơi giỏi cả hai thì được thưởng cả hai.
