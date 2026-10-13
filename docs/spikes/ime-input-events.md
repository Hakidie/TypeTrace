# Spike: bộ gõ tiếng Việt gửi sự kiện input như thế nào

> **User story:** Là developer, tôi muốn kiểm chứng sớm cách các bộ gõ gửi sự kiện input để biết thiết kế màn hình gõ có khả thi không.
>
> **Trạng thái (13/10/2026):** đã đo Unikey và EVKey trên Chrome 155 và Edge 155 (17 lượt, cả 3 loại ô gõ). Luật phát hiện từ
> chốt đúng mọi từ ở cả 17 lượt. **Kết quả đầy đủ: [../ime-findings.md](../ime-findings.md).** Chưa đo: macOS, Firefox, Safari.
> Kết luận ở mục 4 đã được xác nhận cho Unikey/EVKey trên Chromium, còn với macOS vẫn là giả thuyết.

## 1. Trang thử nghiệm

- URL: `http://localhost:5173/lab/input` (link **Input lab** trên thanh menu, cần đăng nhập).
- Code: `FE/src/modules/input-lab/`. Trang gắn listener **native** (không dùng synthetic event của React, vì `onBeforeInput`
  của React là polyfill, không có `inputType`) cho `keydown`, `keyup`, `beforeinput`, `input`, `compositionstart`,
  `compositionupdate`, `compositionend`.
- Mỗi dòng log có: thời gian (ms), `key` / `code` / `keyCode`, `inputType`, `data`, `isComposing`, giá trị ô gõ và vị trí con trỏ.
  Giá trị ô gõ và con trỏ được đọc **ngay trong listener** (chính xác tại thời điểm sự kiện); chỉ việc vẽ lại log là được gom
  mỗi khung hình một lần (`requestAnimationFrame` + `startTransition`), vì một phím bắn 4+ sự kiện và vẽ lại sau mỗi sự kiện
  làm ô gõ bị lag. Bảng chỉ vẽ **300 sự kiện mới nhất**; bộ nhớ giữ tối đa 20000 (5000 cũ cắt mất đầu đoạn dài) và file Download có đủ.
- Ô gõ đổi được giữa `input`, `textarea`, `contenteditable`, vì màn hình gõ thật có thể dùng một trong ba loại này.
- Panel **Finished words** chạy luật "đã gõ xong một từ" (mục 4.1) ngay trên log, để thấy luật có đúng với từng bộ gõ không.
- **Download** xuất JSON gồm `meta` (bộ gõ, kiểu gõ, user agent), `summary`, `words`, `finalText` và toàn bộ `entries`.

## 2. Cách test

1. Chạy app (`npm run dev` từ thư mục gốc). Trên macOS cũng chạy app trên chính máy Mac, vì trang cần đăng nhập
   và frontend gọi backend ở `localhost`.
2. Mở `/lab/input`, chọn **IME**, **Method** và ghi phiên bản bộ gõ cùng các tùy chọn đang bật vào ô **Note**.
3. Bấm vào ô gõ và gõ **đúng một lần, không sửa lỗi** câu mẫu, kết thúc bằng dấu cách:

   `Tiếng Việt rất đẹp. Người trường quốc khuỷu nghiêng hoà thuỷ text, xong.`

   Câu này có dấu thanh, ư/ơ, kiểu đặt dấu (`hoà`/`hòa`) và từ `text` mà bộ gõ có thể tự khôi phục thành tiếng Anh.
   Bảng ở mục 3 tính trên câu ngắn này. Nút **Long** có thêm một đoạn 136 từ (nhiều câu, dấu ngoặc kép, số `2024` và từ
   tiếng Anh) để thử độ ổn định và độ trễ khi gõ lâu. Nên chọn ô gõ `textarea` khi dùng đoạn dài.
4. Gõ thêm các tình huống: (a) gõ sai rồi Backspace giữa từ; (b) gõ dấu sau cả từ (`tiengs` → `tiếng`); (c) xóa lùi qua
   dấu cách rồi sửa từ trước.
5. Bấm **Download**, lưu file vào `docs/spikes/ime-logs/` và điền một dòng vào bảng ở mục 3.
6. Lặp lại với `textarea` và `contenteditable` nếu có thời gian (ít nhất làm `input`).

## 3. Kết quả

Ít nhất 3 bộ gõ × 2 trình duyệt. Cột **Từ đúng** = số từ trong panel *Finished words* khớp câu mẫu / 13.

| # | Bộ gõ (phiên bản, kiểu gõ) | OS | Trình duyệt | Composition? | `deleteContentBackward` | `keydown` key / keyCode thường gặp | Từ đúng | Ghi chú | Log |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Unikey, Telex | Windows 10 | Chrome 155 | Không (0 composition) | 70 / 212 `input` | Phím thường: key thật / keyCode thật. Ký tự do Unikey gửi: keydown `key` = chính ký tự (`ế`, `·`), keyCode **231**; keyup `Unidentified` / 231. Không có 229. | 13/13 chốt, 11/13 khớp | 2 từ lệch chỉ vì kiểu đặt dấu (`hoà`→`hòa`, `thuỷ`→`thủy`). Chi tiết: mục "Quan sát Unikey". | [log](ime-logs/2026-10-13-unikey-telex-chrome-input-short.json) |
| 2 | Unikey, Telex | Windows 10 | Edge 155 | Không | 55 / 183 `input` | Giống dòng 1 | 13/13 chốt, 11/13 khớp | Đo tự động, cả 3 ô gõ + đoạn dài. Chuỗi sự kiện giống hệt Chrome. | [kết quả](../ime-findings.md) |
| 3 | EVKey 6.0.5, Telex | Windows 10 | Chrome 155 | Không | 28 / 128 `input` | Ký tự gửi: keyCode 231. Phím dấu bị thay bằng Shift + ArrowLeft (bôi đen) rồi Backspace. | 13/13 chốt, 12/13 khớp | `text`→`tẽt`: EVKey mặc định không khôi phục từ tiếng Anh. | [kết quả](../ime-findings.md) |
| 4 | EVKey 6.0.5, Telex | Windows 10 | Edge 155 | Không | 28 / 128 `input` | Giống dòng 3 | 13/13 chốt, 12/13 khớp | Chuỗi sự kiện giống hệt Chrome. | [kết quả](../ime-findings.md) |
| 5 | Unikey / EVKey, Telex | Windows | Firefox | _chưa đo (máy đo chưa cài Firefox)_ | | | | | |
| 6 | macOS Vietnamese, Telex | macOS | Safari | _chưa đo_ | | | | | |
| 7 | macOS Vietnamese, Telex | macOS | Chrome | _chưa đo_ | | | | | |

### Dự đoán trước khi đo (để đối chiếu)

| Bộ gõ | Dự đoán | Cần kiểm tra |
|---|---|---|
| Unikey, EVKey (Windows) | Không có composition. Khi thêm dấu, bộ gõ gửi Backspace giả rồi gõ lại ký tự có dấu: log có `deleteContentBackward` xen giữa `insertText`. `keydown` của ký tự Unicode có thể là `Unidentified` / keyCode 231 hoặc 0. | Thứ tự backspace và chèn; key/keyCode thực tế; bật "sửa lỗi gợi ý trên trình duyệt" (EVKey) hay tùy chọn clipboard có làm khác đi không; từ `text` có bị khôi phục khi gõ dấu cách không. |
| macOS Vietnamese | Có composition: `compositionstart` → nhiều `compositionupdate` + `input` (`insertCompositionText`, `isComposing: true`) → `compositionend` khi gõ dấu cách, sau đó mới chèn dấu cách. `keydown` trong lúc composition có keyCode 229. | Safari: `compositionend` có thể đến **trước** `keydown` của phím kết thúc, và `keydown` đó có `isComposing: false`. Giá trị ô gõ trong lúc composition đã chứa chữ đang soạn chưa. |

### Quan sát Unikey, Telex, Chrome 155, Windows 10 (13/10/2026, gõ tay, 877 sự kiện)

- **Không có composition.** Mọi thay đổi văn bản đều là `input` với `isComposing: false`; giá trị ô gõ không bao giờ đổi ngoài sự kiện `input`.
- **Mỗi lần thêm hoặc đổi dấu, Unikey làm 3 bước, tất cả trong ~2 ms:** (1) chèn ký tự giả `·` (U+00B7) bằng `insertText`;
  (2) gửi N lần Backspace thật (`keydown Backspace` + `deleteContentBackward`), N = 1 cho ký tự giả + số ký tự cần gõ lại;
  (3) chèn lại từng ký tự (`insertText` từng chữ, keyCode 231). Ví dụ `Tie` + `e` → `Tie·` → `Tie` → `Ti` → `Tiê`.
  Gõ `s` sau `Tiêng` xóa lùi 4 ký tự rồi gõ lại `ế n g`. Vì vậy có 70 `deleteContentBackward` cho một câu gõ không sửa lỗi,
  và 23 lần `·` xuất hiện thoáng qua trong giá trị ô gõ.
- **keydown của ký tự do Unikey gửi** có `key` là chính ký tự đó (`ế`, `đ`, `·`), `code` rỗng, `keyCode` 231; `keyup` tương ứng
  là `Unidentified` / 231. Phím bấm thật vẫn có `key`/`code`/`keyCode` bình thường (`e` / `KeyE` / 69), nhưng `keyup` của phím
  thật đến **sau** toàn bộ chuỗi giả.
- **Từ `text`:** gõ `t e x` → Unikey cho `tẽ`; gõ tiếp `t` → Unikey nhận ra không phải tiếng Việt, xóa lùi và gõ lại `tex`
  **ngay ở phím `t`**, rồi chèn `t`: giá trị `text` đã ở dạng cuối trước khi gõ `,`. Khôi phục xảy ra trước dấu phân tách, đúng giả thuyết.
- **Luật 4.1 đúng:** 13/13 từ chốt đúng lúc, thời gian mỗi từ 0,5 đến 3,3 s. 2 từ không khớp câu mẫu (`hòa`, `thủy`) do tùy chọn
  kiểu đặt dấu của Unikey (cũ/mới), không phải lỗi của luật. Màn hình gõ phải chuẩn hóa kiểu đặt dấu trước khi so sánh (mục 4.3).
- Bảng log 877 sự kiện, gõ 23 s: không lag (sau khi gom cập nhật theo frame, xem mục 1).

## 4. Kết luận (giả thuyết, xác nhận khi bảng mục 3 đủ dữ liệu)

### 4.1 Cách xác định "đã gõ xong một từ"

**Không dựa vào phím.** Chỉ dựa vào *văn bản đã chốt* của ô gõ:

1. Văn bản đã chốt là giá trị của ô gõ sau một sự kiện `input` có `isComposing === false`, hoặc sau `compositionend`.
   Bỏ qua mọi `input` có `isComposing === true`, vì đó là chữ đang soạn và có thể còn đổi.
2. Một từ **xong** khi trong văn bản đã chốt có một ký tự phân tách (khoảng trắng, kể cả ` ` của contenteditable,
   hoặc dấu câu `. , ; : ! ? …`) đứng ngay sau nó. Từ được lấy từ văn bản lúc đó, không ghép từ các phím.
3. Nếu người dùng xóa lùi qua dấu phân tách, từ đó **mở lại**. Khi dấu phân tách xuất hiện lại, từ được chốt lần nữa với nội dung mới.
4. **Từ cuối cùng** không có dấu phân tách phía sau: chốt khi nhấn Enter lúc **không** composition
   (`keydown` Enter với `isComposing === false` và `keyCode !== 229`), hoặc khi văn bản đã chốt bằng đúng toàn bộ đoạn mẫu.
   Đơn giản nhất là yêu cầu người dùng gõ dấu cách hoặc Enter sau từ cuối.

Luật này đúng cho cả hai kiểu bộ gõ. Bộ gõ chèn Backspace giả (Unikey/EVKey) chỉ đổi văn bản bên trong từ. Bộ gõ
composition (macOS) chỉ chốt khi gõ dấu cách. Khi bộ gõ tự khôi phục từ tiếng Anh lúc gõ dấu cách, việc thay chữ xảy ra
trước hoặc cùng lúc với dấu cách, nên lúc dấu cách vào văn bản thì từ đã ở dạng cuối. Với Unikey đã xác nhận: khôi phục `tẽ` → `tex`
xảy ra ngay ở phím `t` tiếp theo (mục 3, từ `text`). Còn EVKey và macOS chưa đo.
Luật đã được cài trong `detectWordCommits` (`FE/src/modules/input-lab/utils/input-log.ts`) và có test cho cả hai kiểu.

### 4.2 Chỉ số đo tin cậy được

| Chỉ số | Tin cậy? | Lý do |
|---|---|---|
| Nội dung từng từ đã chốt, so với từ mẫu (đúng/sai) | **Có** | Lấy từ văn bản cuối, không phụ thuộc bộ gõ. |
| Độ chính xác theo từ = từ đúng / từ đã chốt | **Có** | Dựa trên chỉ số trên. |
| Tốc độ từ/phút (WPM) theo từ đúng đã chốt | **Có** | Cần thời điểm chốt từ và thời điểm bắt đầu, cả hai đều lấy từ thay đổi văn bản. |
| Thời gian gõ mỗi từ (từ lần đổi văn bản đầu tiên đến lúc chốt) | **Có**, sai số vài ms | Thời điểm bắt đầu là `input` hoặc `compositionstart` đầu tiên của từ. |
| Số phím đã bấm, phím/phút (KPM) | **Không** | Bộ gõ chèn Backspace giả, composition giấu phím (keyCode 229, key `Process`/`Unidentified`), và Telex/VNI cần số phím khác nhau cho cùng một chữ. |
| Số lần sửa lỗi (đếm Backspace) | **Không** | Không phân biệt được Backspace thật với Backspace bộ gõ chèn vào. |
| Lỗi theo từng ký tự trong lúc đang gõ dở một từ | **Không** | Trạng thái trung gian không phải tiền tố của từ đúng (`tiengs` → `tiéng` → `tiếng`) và khác nhau giữa Telex/VNI. |

### 4.3 Hệ quả cho thiết kế màn hình gõ

- **Khả thi**, với điều kiện chấm điểm **theo từ** khi từ được chốt, không chấm theo phím.
- Khi đang gõ dở một từ chỉ nên tô màu nhẹ: so khớp **sau khi bỏ dấu** với tiền tố của từ mẫu, không báo lỗi cứng. Chỉ chấm đúng/sai khi từ đã chốt.
  Phải bỏ qua ký tự giả `·` (U+00B7) mà Unikey chèn thoáng qua, nếu không sẽ nháy đỏ mỗi lần gõ dấu.
- So sánh từ đã chốt với từ mẫu sau khi **chuẩn hóa kiểu đặt dấu** (`hoà` = `hòa`, `thuỷ` = `thủy`), hoặc chấp nhận cả hai dạng
  trong đoạn mẫu. Nếu không, người dùng Unikey bật "bỏ dấu kiểu mới" sẽ bị chấm sai dù gõ đúng.
- Đọc giá trị ô gõ trong `input`/`compositionend`, không tự chặn hay sửa nội dung trong `keydown`/`beforeinput`, vì làm vậy sẽ phá bộ gõ.
- Luôn để bộ gõ gõ vào một ô nhập thật (`input`, `textarea` hoặc `contenteditable`), không vẽ chữ từ `keydown`.

## 5. Việc còn lại

- [ ] Điền bảng mục 3 (tối thiểu Unikey, EVKey, macOS × 2 trình duyệt) và đính kèm log JSON. Đã có: Unikey và EVKey × Chrome, Edge
  (dòng 1–4, chi tiết trong [../ime-findings.md](../ime-findings.md)). Còn: macOS (dòng 6–7), Firefox (dòng 5).
- [ ] Đối chiếu với mục 4. Nếu có trường hợp luật 4.1 sai (ví dụ cột *Từ đúng* < 13 mà người test gõ đúng), ghi lại và sửa luật.
- [ ] Sau khi chốt thiết kế, xóa module `input-lab` hoặc giữ lại làm trang chẩn đoán cho admin.
