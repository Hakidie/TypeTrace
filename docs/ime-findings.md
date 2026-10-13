# Kết quả đo: bộ gõ tiếng Việt gửi sự kiện input như thế nào

Ngày đo: 13/10/2026. Trang đo: `/lab/input` (`FE/src/modules/input-lab/`). Phương pháp và câu mẫu:
[spikes/ime-input-events.md](spikes/ime-input-events.md). Log gốc: [spikes/ime-logs/](spikes/ime-logs/).

## Tóm tắt

- **Thiết kế màn hình gõ khả thi**, với điều kiện chấm **theo từ đã chốt**, đọc từ giá trị ô gõ, không chấm theo phím.
- **"Đã gõ xong một từ"** = trong giá trị ô gõ đã chốt (sau `input` không composition, hoặc sau `compositionend`) có dấu cách
  hoặc dấu câu đứng ngay sau từ đó. Luật này chốt đúng **17/17 lượt đo**: 13/13 từ ở câu ngắn và 136/136 từ ở đoạn dài,
  với cả Unikey và EVKey, trên cả `input`, `textarea` và `contenteditable`.
- **Đo tin cậy được:** nội dung từ đã chốt, độ chính xác theo từ, WPM, thời gian gõ từng từ.
  **Không tin cậy:** số phím, KPM, số lần Backspace, lỗi theo từng ký tự khi đang gõ dở. Cụ thể, khoảng 23% số phím đã bấm
  không tới trình duyệt dưới dạng phím thật, và trình duyệt nhận số `keydown` gấp khoảng 2 lần số phím thật.
- **Chưa đo:** bộ gõ macOS (cần máy Mac), Firefox và Safari. Hai trình duyệt đã đo (Chrome 155, Edge 155) đều là Chromium và cho
  ra **chuỗi sự kiện giống hệt nhau**. Vì vậy kết luận về trình duyệt mới chỉ đúng cho Chromium (xem "Giới hạn").

## Ma trận đã đo

Câu ngắn có 13 từ, đoạn dài có 136 từ. **Chốt** = số từ luật phát hiện được. **Khớp** = số từ trùng đúng chữ với câu mẫu.
**Khớp\*** = số từ trùng sau khi chuẩn hóa kiểu đặt dấu (`hoà` = `hòa`).

| Bộ gõ (cấu hình) | Trình duyệt | Ô gõ | Mẫu | Sự kiện | Composition | `deleteContentBackward` | Chốt | Khớp | Khớp\* | Log |
|---|---|---|---|---|---|---|---|---|---|---|
| Unikey, Telex, mặc định | Chrome 155 | input | ngắn, **gõ tay** | 877 | 0 | 70 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-chrome-input-short.json) |
| Unikey | Chrome 155 | input | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-chrome-input-short-auto.json) |
| Unikey | Chrome 155 | textarea | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-chrome-textarea-short-auto.json) |
| Unikey | Chrome 155 | contenteditable | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-chrome-contenteditable-short-auto.json) |
| Unikey | Chrome 155 | textarea | dài | 5000 (bị cắt¹) | 0 | 356 | 136/136 | 134 | 136 | [log](spikes/ime-logs/2026-10-13-unikey-telex-chrome-textarea-long-auto.json) |
| Unikey | Edge 155 | input | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-edge-input-short-auto.json) |
| Unikey | Edge 155 | textarea | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-edge-textarea-short-auto.json) |
| Unikey | Edge 155 | contenteditable | ngắn | 760 | 0 | 55 | 13/13 | 11 | 13 | [log](spikes/ime-logs/2026-10-13-unikey-telex-edge-contenteditable-short-auto.json) |
| Unikey | Edge 155 | textarea | dài | 5000 (bị cắt¹) | 0 | 356 | 136/136 | 134 | 136 | [log](spikes/ime-logs/2026-10-13-unikey-telex-edge-textarea-long-auto.json) |
| EVKey 6.0.5, Telex, mặc định | Chrome 155 | input | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-chrome-input-short-auto.json) |
| EVKey | Chrome 155 | textarea | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-chrome-textarea-short-auto.json) |
| EVKey | Chrome 155 | contenteditable | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-chrome-contenteditable-short-auto.json) |
| EVKey | Chrome 155 | textarea | dài | 5733 | 0 | 255 | 136/136 | 135 | 135 | [log](spikes/ime-logs/2026-10-13-evkey-telex-chrome-textarea-long-auto.json) |
| EVKey | Edge 155 | input | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-edge-input-short-auto.json) |
| EVKey | Edge 155 | textarea | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-edge-textarea-short-auto.json) |
| EVKey | Edge 155 | contenteditable | ngắn | 665 | 0 | 28 | 13/13 | 12 | 12 | [log](spikes/ime-logs/2026-10-13-evkey-telex-edge-contenteditable-short-auto.json) |
| EVKey | Edge 155 | textarea | dài | 5733 | 0 | 255 | 136/136 | 135 | 135 | [log](spikes/ime-logs/2026-10-13-evkey-telex-edge-textarea-long-auto.json) |
| macOS Vietnamese, Telex | Safari | | | _chưa đo_ | | | | | | |
| macOS Vietnamese, Telex | Chrome | | | _chưa đo_ | | | | | | |

Các từ không khớp:
- **Unikey:** `hoà`→`hòa`, `thuỷ`→`thủy`, `khoẻ`→`khỏe`. Unikey mặc định đặt dấu kiểu cũ. Sau khi chuẩn hóa kiểu đặt dấu thì khớp hết.
- **EVKey:** `text`→`tẽt`. EVKey mặc định **không tự khôi phục** từ tiếng Anh, còn Unikey thì có (ra `text`). Người dùng nhìn thấy
  đúng chữ `tẽt` trên màn hình, nên chấm sai là đúng. Lỗi nằm ở việc đoạn mẫu có từ tiếng Anh, không nằm ở luật phát hiện từ.

¹ Hai log Unikey đoạn dài bị cắt ở 5000 sự kiện, do giới hạn cũ của trang (`MAX_ENTRIES`, nay đã nâng lên 20000). Nội dung
và số từ chốt vẫn đúng, vì luật đọc từ giá trị ô gõ. Nhưng thời gian gõ của những từ đầu tiên trong hai log này **không dùng được**.

## Bộ gõ gửi sự kiện như thế nào

Cả Unikey và EVKey (cấu hình mặc định) đều **không dùng composition**. Không có `compositionstart`, không có `isComposing: true`,
không có keyCode 229. Mỗi thay đổi văn bản là một cặp `beforeinput` → `input` (`insertText` hoặc `deleteContentBackward`),
và giá trị ô gõ chỉ đổi qua sự kiện `input`. Hai bộ gõ khác nhau ở cách sửa chữ đã gõ khi người dùng thêm dấu:

### Unikey: chèn ký tự giả, rồi xóa lùi và gõ lại

Gõ `e` sau `Tie`, sự kiện tới trình duyệt là:

```
keydown "·" keyCode 231   input insertText "·"           value "Tie·"   ← ký tự giả U+00B7, thay cho phím "e" thật
keydown Backspace         input deleteContentBackward    value "Tie"
keydown Backspace         input deleteContentBackward    value "Ti"
keydown "ê" keyCode 231   input insertText "ê"           value "Tiê"
```

- **Phím dấu thật không bao giờ tới trình duyệt.** Unikey nuốt phím đó và gửi `·` thay vào. Ở câu ngắn, 22/93 phím bị
  thay như vậy (`s f r x j w` và chữ thứ hai của `ee aa oo dd`).
- Sau dấu, Unikey **gõ lại cả phần còn lại của từ** (`n`, `g` trong `Tiếng`), cũng bằng keyCode 231.
- Ký tự giả `·` chỉ có mặt trong giá trị ô gõ vài ms. Nó **không phải** dấu phân tách, nên không làm chốt nhầm từ.
  Nhưng nếu màn hình tô màu theo từng ký tự thì sẽ thấy nháy đỏ.
- Từ `text`: `tex` → `tẽ`. Khi gõ tiếp `t`, Unikey xóa lùi và gõ lại `text` **ngay ở phím đó**, trước khi có dấu phân tách.

### EVKey: bôi đen bằng Shift+ArrowLeft, rồi xóa và gõ lại

```
keydown Shift (code rỗng) / Shift / ArrowLeft            value "Tie"    ← bôi đen "e", thay cho phím "e" thật
keydown Backspace         input deleteContentBackward    value "Ti"
keydown "ê" keyCode 231   input insertText "ê"           value "Tiê"
```

- Phím dấu thật cũng bị nuốt (21/93 phím), thay bằng **Shift+ArrowLeft** để chọn ký tự cuối, sau đó là Backspace và các ký tự gõ lại (keyCode 231).
- Không có ký tự giả, nên số sự kiện ít hơn Unikey (665 so với 760, câu ngắn).
- **Hệ quả:** EVKey cần trình duyệt **di chuyển con trỏ và bôi đen** được. Nếu màn hình gõ chặn phím mũi tên, ép con trỏ
  về cuối, hoặc `preventDefault` trên `keydown`/`beforeinput`, EVKey sẽ gõ sai.

### Số liệu chung (câu ngắn, 93 phím chữ + 5 Shift)

| | Unikey | EVKey |
|---|---|---|
| `keydown` trình duyệt nhận | 186 | 194 |
| Phím thật tới trình duyệt với `code` thật | 71 | 72 |
| `keydown` keyCode 231 (ký tự do bộ gõ gửi) | 57 | 28 |
| `deleteContentBackward` (không có Backspace thật nào) | 55 | 28 |
| Số lượt sửa chữ (= số phím bị nuốt) | 22 | 21 |
| Một lượt sửa chữ kéo dài: trung vị / p95 / lâu nhất (mọi lượt đo) | 3–12 / ≤ 20 / 42 ms | 5–10 / ≤ 15 / 38 ms |

### Chrome và Edge

Với cùng bộ gõ và cùng cách gõ, Chrome 155 và Edge 155 cho **cùng số sự kiện, cùng thứ tự**, ở cả ba loại ô gõ. Điểm khác duy nhất
giữa các loại ô gõ: `contenteditable` lưu dấu cách cuối dòng thành ` `. Luật phát hiện từ đã coi ký tự này là dấu phân tách.

## Kết luận

### Cách xác định "đã gõ xong một từ"

1. Chỉ đọc giá trị ô gõ **sau** sự kiện `input` có `isComposing === false`, hoặc sau `compositionend`. Không dùng `keydown` để biết chữ gì đã được gõ.
2. Một từ xong khi ngay sau nó có dấu phân tách: khoảng trắng (kể cả ` `) hoặc `. , ; : ! ? … " ( )`. Lấy chữ của từ từ giá trị lúc đó.
3. Xóa lùi qua dấu phân tách thì mở lại từ đó; từ được chốt lại khi dấu phân tách xuất hiện lại.
4. Từ cuối cùng: yêu cầu gõ dấu cách hoặc Enter (`keydown` Enter với `isComposing === false`).

Kết quả đo: luật chốt đúng mọi từ trong 17/17 lượt. Bộ gõ chỉ sửa chữ **bên trong** từ, kể cả khi khôi phục từ tiếng Anh, và luôn sửa xong
trước khi dấu phân tách vào ô gõ. Luật đã có trong `detectWordCommits` (`FE/src/modules/input-lab/utils/input-log.ts`).
Với macOS (composition) luật vẫn là **giả thuyết**, vì đã có unit test giả lập nhưng chưa đo thật.

### Chỉ số nào đo tin cậy được

| Chỉ số | Tin cậy? | Bằng chứng |
|---|---|---|
| Nội dung từ đã chốt, đúng/sai so với từ mẫu | **Có** (sau khi chuẩn hóa kiểu đặt dấu) | 17/17 lượt chốt đủ từ, chữ đúng như người dùng thấy |
| Độ chính xác theo từ, WPM theo từ đúng | **Có** | Tính từ hai chỉ số trên và thời điểm chốt |
| Thời gian gõ mỗi từ | **Có**, sai số thường dưới 20 ms | Một lượt sửa chữ của bộ gõ: p95 ≤ 20 ms, lâu nhất 42 ms |
| Số phím, KPM | **Không** | Trình duyệt nhận khoảng 2 lần số phím thật (186–194 so với 98); khoảng 23% phím thật không tới trình duyệt |
| Số lần sửa lỗi (đếm Backspace) | **Không** | 28–55 Backspace giả trong một câu không sửa lỗi nào. Lọc theo thời gian ("Backspace cách lượt chèn hơn 5 ms là thật") báo nhầm tới 27 lần |
| Lỗi theo từng ký tự khi đang gõ dở | **Không** | Có giá trị trung gian không phải tiền tố của từ đúng (`Tie·`, `tẽ` trước khi thành `text`) |

### Yêu cầu cho màn hình gõ

- Dùng ô nhập thật (`input`, `textarea` hoặc `contenteditable`, cả ba đều đã đo và chạy đúng). Không vẽ chữ từ `keydown`.
- **Không** `preventDefault` trên `keydown` hoặc `beforeinput`, không chặn phím mũi tên, không ép vị trí con trỏ, vì EVKey cần Shift+ArrowLeft.
- Chấm theo từ khi từ đã chốt. Trong lúc gõ dở chỉ tô màu nhẹ, và bỏ qua ký tự `·` (U+00B7) của Unikey.
- So sánh sau khi chuẩn hóa Unicode (NFC) **và kiểu đặt dấu** (`hoà`/`hòa`, `thuỷ`/`thủy`, `khoẻ`/`khỏe`).
- Tránh từ tiếng Anh trong đoạn mẫu, hoặc nhắc người dùng EVKey bật tự khôi phục từ tiếng Anh.

## Phương pháp và giới hạn

- **Một lượt gõ tay** (Unikey + Chrome) và **16 lượt tự động.** Script tự động gửi phím thật ở cấp hệ điều hành (`SendInput`
  của Windows, 110 ms/phím) vào cửa sổ trình duyệt, nên Unikey và EVKey xử lý như phím người gõ. Mình kiểm tra lại bằng cách so với lượt
  gõ tay: cùng mẫu sự kiện (ký tự giả, keyCode 231, Backspace giả) và cùng văn bản cuối. Số sự kiện khác nhau (877 so với 760)
  chỉ vì người gõ có sửa một lỗi gõ nhầm. Script chỉ gõ được phím ASCII, nên chỉ đo được kiểu gõ Telex.
- **Cấu hình bộ gõ:** Unikey đang cài trên máy (mặc định: đặt dấu kiểu cũ, có khôi phục từ tiếng Anh). EVKey 6.0.5 bản portable
  từ GitHub `lamquangminh/EVKey`, cấu hình mặc định (đặt dấu kiểu mới, `UseIME=0`, phải bấm Ctrl+Shift để chuyển sang tiếng Việt).
  EVKey còn có chế độ dùng IME (`UseIME=1`), có thể sinh composition như macOS. Chế độ này **chưa đo**.
- **Chưa đo:**
  - **macOS:** cần người có máy Mac. Hãy đo theo [spikes/ime-input-events.md](spikes/ime-input-events.md) mục 2, chú ý thứ tự
    `compositionend` / `keydown` trên Safari.
  - **Firefox:** máy đo chưa cài. Đây là trình duyệt không phải Chromium dễ đo nhất trên Windows, nên đo trước tiên.
  - **VNI:** chưa đo.
  - **Mobile:** ngoài phạm vi.
- Hai log Unikey đoạn dài bị cắt ở 5000 sự kiện (xem chú thích ¹).
