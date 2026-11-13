# SCRUM-304: Thiết kế lại tab và menu chọn đoạn văn (Typing, Leaderboard-Placement)

## Ý định

Learner muốn thấy đủ tên đoạn văn trong tab và menu chọn, tìm nhanh bằng tìm kiếm, lọc nguồn, sắp xếp, và biết đoạn nào của hệ thống, đoạn nào của người khác. Hiện menu là danh sách thả xuống bị cắt tên (`max-w-64` + `truncate`) và chỉ lấy 100 đoạn đầu theo tên.

## Mục tiêu

- Trigger và menu tự giãn theo tên dài nhất; trên điện thoại vẫn nằm trong màn hình, tên quá dài xuống dòng.
- Menu có ô tìm kiếm (theo tên, không phân biệt dấu) và Sort (mặc định mới nhất).
- Typing có thêm Filter nguồn: Hệ thống (mặc định), Của tôi, Của người khác, Tất cả.
- Mỗi dòng có nhãn nguồn: "System" (giao diện hiện còn tiếng Anh, US8.3 sẽ dịch) hoặc tên hiển thị của người tạo (`publicOwnerName`, không bao giờ email). Đoạn bị khóa theo gói Free hiện như hiện nay.
- Leaderboard-Placement: chỉ đoạn của hệ thống, có tìm kiếm và Sort, không có Filter nguồn.

## Không làm (non-goals)

- Không đổi luật chọn đoạn văn, luật gói Free/Premium, xếp hạng, và mặc định sắp xếp của trang Passages.
- Không phân trang trong menu: mỗi lần hiện tối đa 100 đoạn khớp (tìm kiếm và lọc là cách thu hẹp).
- Không dịch giao diện (US8.3).

## Cách làm (đã chọn)

Các cách đã xem xét:

1. **Lọc ở server (đã chọn).** Thêm tham số vào `GET /api/passages`, menu gửi `q`, `sort`, `origin`. Không bị chặn ở 100 đoạn, đúng với việc "tìm".
2. Lọc ở client trên 100 đoạn đã tải. Không đụng API nhưng đoạn thứ 101 trở đi không bao giờ hiện; bỏ vì trái ý "tìm".

### Backend

- `listPassagesQuerySchema` (`validators/passage.validator.ts`): thêm `origin: z.enum(['system', 'mine', 'others']).optional()` (thiếu = tất cả). Tên là `origin` vì `source` đã là trường nguồn văn bản của đoạn.
  - `system`: không có chủ, hoặc chủ là admin, hoặc tài khoản đã xóa (cùng định nghĩa với `learnerOwnerIds` trong `passage.service.ts`).
  - `mine`: đoạn của chính learner có thể gõ (khác `mine=true` của trang Passages, vốn gồm cả đoạn lưu trữ).
  - `others`: đoạn công khai của learner khác.
  - Đi qua `learnerPassageFilter` hiện có, nên luật hiển thị, khóa theo gói và `hidden` không đổi.
- Mỗi mục trong danh sách thêm cờ `isSystem` (cạnh `isOwn`, `ownerName`); `ownerName` đã là tên công khai.
- Test tích hợp BE: từng giá trị `origin`, kết hợp với `q`, `sort`, `language`, mode placement; không lộ email; đoạn bị khóa vẫn đúng.

### Frontend

- `typing.types.ts`: `PassageOption` thêm `isSystem`, `isOwn`, `ownerName`.
- `typing.api.ts`, `use-typing.ts`: `passages` và `usePassageOptions` nhận `{ q, sort, origin }`, khóa query có đủ ba giá trị; `q` đi qua `useDebounce`.
- Một component menu dùng chung cho cả hai nơi (tìm kiếm + Sort + Filter nguồn tùy chọn + danh sách), dựng từ `SearchInput`, `FilterSelect`/menu Sort-Filter kiểu `CompactToolbar`, đúng token màu và hình dạng menu hiện có. `PassageMenu` (Typing) và `PlacementPassageMenu` dùng lại nó; Placement cố định `origin=system` và không hiện Filter.
- Trigger bỏ `max-w-64`; menu rộng theo nội dung (`w-max`, `max-w-[calc(100vw-2rem)]`), tên xuống dòng khi tới mép.
- Nhãn nguồn là `LabeledTag`/badge nhỏ trên mỗi dòng; trạng thái đang tải, lỗi, rỗng (có thông báo khi tìm không ra).
- Sort mặc định `-createdAt`, chỉ menu gửi; mặc định chung của API (`title`) không đổi.
- Test FE: tìm kiếm, đổi Sort và Filter gọi API đúng tham số, nhãn nguồn, không hiện email, Placement không có Filter, các trạng thái.

### Tài liệu

`AGENTS.md` (mục `GET /api/passages`/menu) và `BE/docs/architecture.md`, `FE/docs/architecture.md`: ghi `origin`, `isSystem` và component menu dùng chung (golden rule 7).

## Giao cho người làm

- Cách viết truy vấn `system` (owner null hoặc admin hoặc đã xóa) sao cho dùng được chỉ mục hiện có.
- Danh sách tùy chọn Sort cụ thể (đề xuất: Mới nhất, Tên A–Z, Số từ).
- Vị trí chính xác của thanh tìm kiếm trong menu trên điện thoại.

## Kiểm tra cuối

`npm test`, `npm run lint`, `npm run build` từ thư mục gốc.
