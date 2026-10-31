# Thiết kế: Hướng dẫn người mới với mascot Ping

## Mục đích

Người mới vào TypeTrace bị ném thẳng vào các màn (Practice, Placement, Rank, Rain, Daily) mà không ai giải thích; ở Rank
họ thua ngay (một người gõ đều 1 từ / 1,2 s vẫn bị K.O. ở Bronze trước khi chỉnh độ khó). Một linh vật, **Ping**, dẫn họ đi
qua từng màn, giải thích luật, cách cộng điểm và bậc Rank, cho họ **đấu tập với Ping-bot** trước khi vào trận thật, rồi
nhận xét trận đấu bằng AI.

## Mục tiêu, không làm, phản mục tiêu

- **Mục tiêu:** người mới hiểu mỗi màn chơi thế nào; trước trận Rank đầu tiên họ đã chơi thử một trận Rain với bot và
  biết điểm được cộng trừ ra sao.
- **Không làm (lần này):** bot đấu trong phòng Rank thật trên server; đấu tập Race với bot; thưởng xu cho việc học xong;
  Ping trong khung chat AI.
- **Phản mục tiêu:** hướng dẫn chặn người chơi (không bỏ qua được); hiện lại cho người đã biết chơi; trận đấu tập làm
  đổi Elo hay bảng xếp hạng; Ping che mất đúng thứ đang được giải thích.

## Người dùng đã quyết định

- **Mascot Ping:** cậu nhóc cyberpunk chibi, hình riêng (không ghép layer avatar): tai nghe trùm đầu có micro, visor đỏ
  hiện mắt, tóc bạc chỏm đỏ neon, hoodie đen chữ T, tay robot, giày cổ cao. Đã có trong repo: `minigame-sprites/draw-ping.mjs`
  vẽ `FE/public/mascot/ping-<move>.png`, mỗi động tác 4 khung 64×88: idle, talk, happy, sad, point, typing.
- **Một chuyến hướng dẫn ngay sau khi đăng ký**, đi lần lượt các màn, **bỏ qua được**.
- **Hướng dẫn từng màn** cũng có, cho ai chưa học màn đó, và cũng **bỏ qua được**.
- **Tài khoản đã có từ trước** coi như đã biết chơi: không hiện gì (vẫn xem lại được, xem dưới).
- Phần mở đầu của Rank: Ping **giới thiệu luật, cách cộng điểm, các bậc**.
- Cảnh mẫu đã duyệt: mưa chữ **dừng lại**, chữ cần gõ được khoanh, **Ping chỉ tay vào chữ** và giải thích.
- Có **màn đấu thử với bot**.

## Các cách đã cân nhắc

- **A. Hướng dẫn phủ lên chính các màn thật, đấu tập chạy trong trình duyệt (chọn).** Một bộ chạy bước dùng chung cộng danh
  sách bước của từng màn; Mưa chữ một người vốn chạy ở trình duyệt nên dừng mưa dễ; trận với Ping-bot dựng từ luật mưa
  chữ có sẵn, không tạo phòng, không đụng Elo, chạy được cả khi backend là Vercel serverless.
- **B. Ping-bot đấu trong phòng Rank thật trên server.** Đúng sảnh và đếm ngược thật, nhưng cần tài khoản bot, loại bot
  khỏi Elo và bảng xếp hạng, và một server chạy liên tục (Vercel hiện tại không chạy được).
- **C. Trang hướng dẫn riêng `/tutorial/...`.** Tách biệt nhưng dựng lại giao diện lần nữa, và người mới học trên một màn
  không giống màn họ sẽ chơi.

Người dùng để Claude chọn: **A**.

## Trải nghiệm

### Chuyến hướng dẫn (6 bước lớn)

1. **Chào** (trang Typing, tab Practice): Ping vui, lời mời, nút "Đi thôi" và "Bỏ qua hướng dẫn".
2. **Practice:** khoanh đoạn văn, giải thích chữ sai tô đỏ, Backspace, WPM và độ chính xác; người chơi gõ thử vài từ rồi
   bấm "Hiểu rồi" (không bắt gõ hết đoạn).
3. **Placement:** Ping mời làm bài xếp lớp, nói nó chọn đoạn văn vừa sức. Bước này **thay** câu hỏi xếp lớp hiện có sau
   đăng ký (SCRUM-157) cho tài khoản mới; "Để sau" thì đi tiếp.
4. **Rain:** mưa dừng, chữ khoanh đỏ, Ping chỉ vào: gõ chữ rồi Space; chạm đất mất một ♥. Mưa chạy tiếp khi gõ đúng.
5. **Daily:** nhiệm vụ mỗi ngày, chuỗi ngày, xu.
6. **Rank:** thẻ giải thích (thắng cộng, thua trừ, đối thủ mạnh hơn được nhiều hơn; thang Bronze 1000 → Legend 1700; Race
   và Rain là hai rating riêng) rồi **đấu tập Rain với Ping-bot**, rồi nhận xét AI, rồi "Vào Rank thật" / "Đấu lại với Ping".

Thanh tiến trình và nhãn "Chuyến hướng dẫn · n/6" ở mọi bước. Bản mẫu giao diện: phiên brainstorm
`.superpowers/brainstorm/…/tutorial-screens.html` (5 màn: chào, một bước trên màn thật, giới thiệu Rank, đấu tập, sau trận).

### Hướng dẫn từng màn

Mở một màn mà tài khoản có trạng thái hướng dẫn và màn đó chưa `done`/`skipped` thì chạy các bước của riêng màn đó. Chuyến
chung chỉ là xâu các danh sách bước theo thứ tự trên: **một nội dung, hai cách chạy**.

### Đấu tập với Ping-bot

- Bố cục như trận Rain thật (`RainDuelView`): sân mình lớn, sân Ping nhỏ với sprite Ping thay avatar, nhãn luôn hiện
  **"Đấu tập · không tính điểm"**, độ khó Bronze (`rainDuelSettings.paces.Bronze`).
- Ping-bot: thấy chữ rồi gõ sau 2,5–6 s, bỏ sót khoảng 1/6 số chữ (như bot đã thử trong phiên trước, người ~40 WPM thắng
  K.O. với 3 ♥). Gõ trúng thì ném một **chữ khác** sang (luật đã có trên server, viết lại phía trình duyệt).
- Ping phản ứng: `typing` khi nó gõ, `sad` khi nó mất mạng, `happy` khi nó ném trúng bạn, một câu ngắn trong bong bóng
  ở sân nhỏ khi bạn ném chữ sang ("Ối, chữ bay tới kìa!").
- Không gửi gì lên server trong trận; xong trận chỉ gửi số liệu để lấy nhận xét.

### Nhận xét AI

Sau trận gửi `{ result, hits, thrown, livesLeft, missedWords (tối đa 10), seconds }` lên backend; backend gọi OpenAI qua
`generateChatReply` với lời nhắc riêng "bạn là Ping…", 2–3 câu, tiếng Việt. AI lỗi (503/429/502) thì hiện một mẹo viết sẵn
chọn theo số liệu, không bao giờ để trống.

## Phần Claude quyết định (người dùng giao)

- **Lưu trạng thái trên tài khoản**, không ở `localStorage`: `user.tutorial = { tour: 'active' | 'done' | 'skipped',
  modes: { practice?, placement?, rain?, daily?, rank?: 'done' | 'skipped' } }`. **Không có trường này = tài khoản cũ** =
  không hiện gì. Không sửa `createUserWithOtp` (luật OTP): sau đăng ký, frontend đã biết `newAccount` và gọi
  `POST /api/tutorial/start`, server tạo trạng thái nếu chưa có.
- **Endpoint** (đều `authGuard`, `validate`): `POST /api/tutorial/start`; `PATCH /api/tutorial { mode, status }` và
  `{ tour }`; `POST /api/tutorial/reset` (Settings "Xem lại hướng dẫn": tạo lại trạng thái, tour `active`);
  `POST /api/tutorial/coach` (nhận xét, giới hạn như chat: 10/phút/người). Trạng thái trả về trong user hiện tại.
- **Bỏ qua** chỉ cho màn đó (hoặc cả chuyến nếu bỏ ở chuyến chung): ghi `skipped`, không hiện lại; Settings mở lại.
- **Bỏ qua chuyến chung** cũng bỏ câu hỏi xếp lớp sau đăng ký (một lần bỏ là đủ); tab Placement vẫn hỏi như cũ.
- **Frontend:** module mới `FE/src/modules/tutorial/` theo khuôn module: `Ping` (một `div` chạy dải 4 khung bằng CSS
  `steps(4)`, khung đứng yên khi giảm chuyển động), `TutorialBubble` (kiểu `Panel`), `Spotlight` (khoanh phần tử có
  `data-tutorial="<id>"`), `useTutorial` (trạng thái từ server, bước hiện tại), danh sách bước mỗi màn, `PracticeDuel`.
  Đăng ký trong `FE/src/app/modules.ts` (widget), không sửa `App.tsx`.
- **Bot và luật trận đấu tập** là hàm thuần (dễ test): bước của bot theo thời gian và số ngẫu nhiên truyền vào.
- **Bàn phím:** Enter = tiếp, nút Bỏ qua bấm được bằng Tab. Không dùng Esc cho bỏ qua vì Esc đang là tạm dừng Mưa chữ.
- **Màu:** Ping giữ màu sprite (như avatar, đã ghi ngoại lệ trong AGENTS.md); bong bóng, khoanh, nút dùng token theme.

## Để lại cho người làm

Nội dung chữ từng bước (giọng Ping: nhanh nhảu, kiểu game thủ, tiếng Việt); vị trí bong bóng trên điện thoại; cách khoanh
từng phần tử cụ thể; lời nhắc AI chi tiết; số bước trong mỗi màn (3–5).

## Kiểm thử

Backend: trạng thái không có với tài khoản cũ; start/patch/reset; coach gọi OpenAI (ghi lại qua `openai-recorder`) và lỗi
trả mẹo dự phòng. Frontend: chuyến chung chạy và bỏ qua; hướng dẫn màn hiện đúng lúc và không hiện cho tài khoản cũ; bot và
luật trận đấu tập (hàm thuần); trận đấu tập không gọi API Rank.

## Phụ thuộc

Nhận xét AI cần OpenAI (nhánh `feat/openai-chat`, PR #38); độ khó Bronze cần `feat/rain-duel`. Làm sau khi hai nhánh đó vào
`main`, hoặc dựa trên chúng.
