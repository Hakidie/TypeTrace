# Gói Free / Premium và hạn mức do Admin quản lý (US11.1, SCRUM-276)

## Ý định

TypeTrace sắp bán Premium (US11.2 PayOS, US11.3 VNPay). Trước khi bán cần có "gói" là gì: Admin chỉnh được giá, hạn mức
passage và quyền của từng gói; mỗi user có gói và hạn; hệ thống áp quyền và hạn mức đó. Learner cần biết gói của mình cho
phép gì và giới hạn đến đâu.

Story đầy đủ và tiêu chí chấp nhận: https://tronghuan1007.atlassian.net/browse/SCRUM-276

## Mục tiêu

- Hai gói cố định, Free và Premium. Admin sửa giá theo tháng, hạn mức passage và hai quyền của từng gói.
- Mỗi user luôn có gói; mặc định Free. Hết hạn thì về Free.
- Mọi thay đổi gói của user được lưu thành lịch sử (subscription).
- Hạn mức passage lấy từ gói, thay hằng `MAX_USER_PASSAGES`.
- Vượt hạn mức thì khóa phần cũ, không mất dữ liệu; mua lại thì mở.
- Free chỉ luyện passage hệ thống và của mình; Premium luyện thêm passage công khai đã duyệt của người khác.
- Admin cấp / thu hồi Premium thủ công, ghi lại ai làm.
- Learner thấy gói, quyền, hạn mức trên Profile.

## Không làm (non-goals)

- Thanh toán (US11.2, US11.3). Giá chỉ được lưu và sửa ở đây; việc nối thanh toán vào gói là của các story đó.
- Tạo thêm gói ngoài Free và Premium.
- Job nền chạy định kỳ.
- Màn hình xem lịch sử subscription (chỉ lưu).
- Chính US3.2 (bài luyện theo lỗi). Ở đây chỉ có sẵn quyền trong cấu hình gói; US3.2 sẽ kiểm tra quyền khi làm.
- Thay đổi Placement và ranked.

## Điều không được xảy ra (anti-goals)

- Mất dữ liệu passage khi vượt hạn mức hoặc hết Premium.
- Chỉ chặn ở giao diện: các quyền và khóa phải được server kiểm tra.
- Lộ email hoặc thông tin riêng của user qua gói, subscription hay thông tin Admin.
- Thêm màu mới (vàng cho Premium...) hoặc kiến trúc mới trái `AGENTS.md`.

## Các quyết định đã chốt với người yêu cầu

**Gói và cấu hình**
- Tên gói: Free và Premium (không dùng "Pro"; SCRUM-303 đang ghi "pro" và sẽ phải đổi).
- Admin sửa: giá theo tháng, hạn mức passage, quyền "tạo bài luyện theo lỗi" và quyền "chọn passage công khai của người khác".
- Khi Admin giảm hạn mức làm nhiều user bị khóa passage, trang Admin tính trước và cảnh báo (ví dụ "N user sẽ bị khóa passage") trước khi lưu.

**Subscription**
- Đăng ký tài khoản thì user có một subscription Free; mua thì thêm Premium; mọi thay đổi đều lưu lại.
- Mỗi bản ghi lưu ai đổi: hệ thống tự đổi thì ghi "auto"; Admin cấp / thu hồi thì ghi thông tin Admin và thời điểm.
- Hết hạn tính khi đọc, không có job nền.
- Admin cấp thêm cho user còn hạn thì cộng nối vào ngày hết hạn hiện tại; user đã hết hạn thì tính từ lúc cấp. Thu hồi đặt hạn về hiện tại.

**Hạn mức và khóa passage**
- Vượt hạn mức: giữ N passage mới nhất, khóa phần cũ hơn. Passage bị khóa không luyện, không chọn, không thi được ở đâu trong hệ thống và ẩn với người khác.
- Learner vẫn thấy đủ danh sách của mình; passage khóa bị mờ và vẫn xóa được. Xóa thì hạn mức được tính lại.
- Mua lại Premium hoặc Admin tăng hạn mức thì passage được mở lại.

**Quyền chọn passage**
- Passage công khai của người khác với user Free vẫn hiện trong bộ chọn nhưng bị khóa, có gợi ý Premium. Premium thì chọn được.

**Giao diện**
- Profile: huy hiệu gói (Free hoặc Premium) bên cạnh username. Bấm vào mở modal có gói hiện tại, quyền, hạn mức (ví dụ "8/20"); Premium có thêm ngày hết hạn.
- Admin: trang quản lý gói với hai thẻ Free và Premium.
- Mọi view có trạng thái đang tải, lỗi và rỗng.
- Cấp Premium thủ công nằm trong tiêu chí gốc với ghi chú "đề xuất, chờ xác nhận"; người yêu cầu đã xác nhận là làm.

## Đoán của tôi, chưa được xác nhận (người yêu cầu hãy kiểm tra)

- Subscription là một collection riêng, mỗi lần đổi gói một dòng; gói hiện tại là dòng mới nhất còn hiệu lực.
- Dòng "auto" khi hết hạn được ghi một lần vào lần đầu server đọc gói thấy đã hết hạn, với thời điểm là chính ngày hết hạn, và ghi một lần dù đọc nhiều lần.
- Tài khoản có từ trước tính năng này không có dòng nào và được coi là Free; có thể thêm script chạy một lần (kiểu `migrate:*`) để tạo dòng Free cho họ.
- Khóa là kết quả tính khi đọc từ gói hiện tại và số passage, không có cột "đã khóa" trong database.
- Cấu hình gói nằm trong `AppSetting` (`AGENTS.md` yêu cầu setting do Admin đổi nằm ở đó).
- Bấm passage khóa vì gói thì mở modal gói thay vì bắt đầu luyện; server từ chối (403) khi Free cố bắt đầu phiên với passage công khai của người khác.
- Passage bị khóa trong danh sách của user có nhãn "Bị khóa" cùng việc mờ đi.
- Trang Admin quản lý user: huy hiệu gói và hạn, bộ lọc theo gói, mục "Cấp Premium" (nhập số tháng) và "Thu hồi Premium" trong menu của user, có hộp xác nhận.
- Màu huy hiệu dùng token theme sẵn có; modal chưa hiện giá.

## Ràng buộc

- Làm theo `AGENTS.md`: sao theo mẫu có sẵn, dùng shared helper, đăng ký module, không thêm thư viện.
- Giữ nguyên các hàm OTP.
- Không làm lộ field riêng tư của User qua `toJSON`.
- Xong khi `npm test`, `npm run lint`, `npm run build` đều qua; cập nhật `AGENTS.md` và `BE/docs/architecture.md` / `FE/docs/architecture.md` cùng lúc.
- Backend chạy một process (đã là giả định của dự án).

## Điểm cần lưu ý trong mã hiện tại

- `countUsableOwnPassages` (`BE/src/services/passage.service.ts`) đang đếm passage riêng tư của user, và comment nói passage đã được Admin duyệt công khai thì không chiếm chỗ. Story lại yêu cầu đếm cả passage công khai. Builder cần chốt cách đếm cho khớp tiêu chí chấp nhận và nói rõ nếu hành vi cũ đổi.
- `MAX_USER_PASSAGES` còn xuất hiện ở `BE/src/models/passage.model.ts`, `passage.service.ts`, `FE/src/modules/passages/passages.config.ts` và test passages; FE nên lấy hạn mức từ server, không giữ bản sao.

## Việc để builder quyết

- Hình dạng schema cụ thể của gói, subscription và API.
- Chỗ đặt điều kiện "bị khóa" để mọi truy vấn passage (luyện, chọn, thi, danh sách, hiển thị cho người khác) dùng chung một nơi.
- Cách chống hai lần đọc đồng thời cùng ghi dòng "auto".
- Giá trị mặc định ban đầu của hạn mức và giá (đề xuất: Free giữ 20 như hằng hiện tại; Premium và giá do builder đề xuất, Admin sửa được).
- Tên route, cấu trúc file, nội dung văn bản tiếng Việt của huy hiệu, modal, cảnh báo.

## Các quyết định của tôi sau khi reviewer đọc (người yêu cầu kiểm tra)

- Khóa chỉ áp cho passage do learner tạo. Passage hệ thống (kể cả do Admin tạo, vì thuộc TypeTrace), passage placement và passage ranked không bao giờ bị khóa, và bộ chọn của placement và ranked không đổi.
- "Mới nhất" xếp theo `createdAt`, mới nhất giữ lại.
- Server kiểm tra quyền "passage công khai của người khác cần Premium" ở mọi chỗ bắt đầu luyện hoặc thi bằng passage từ kho công khai; builder tìm đủ các chỗ này (typing session, practice, các chế độ dùng passage) và test từng chỗ. Chế độ chỉ dùng từ vựng hay passage của chính mình không bị ảnh hưởng.
- Subscription: Admin cấp thêm cho người còn hạn thì thêm một dòng mới nối hạn (không sửa dòng cũ), để lịch sử đủ. Thu hồi thì thêm một dòng Free do Admin ghi. Gói hiện tại là dòng mới nhất còn hiệu lực.
- Không có role nào được bỏ qua hạn mức, nhưng passage của Admin là passage hệ thống nên không bị đếm.
- Tài khoản cũ: "không có dòng = Free" là đủ để chạy đúng; script `migrate:subscriptions` chạy một lần để tạo dòng Free cho tài khoản cũ, an toàn khi chạy nhiều lần.
- Seed: demo, admin và các học viên vẫn Free; thêm một học viên Premium (còn hạn) để thử.
- Ràng buộc nhập của Admin: hạn mức là số nguyên từ 0 trở lên và không có "không giới hạn"; giá là số nguyên VND từ 0 trở lên; mỗi lần cấp tối đa 36 tháng; số tháng nguyên.
- Tháng là tháng lịch tính theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), cộng vào ngày hết hạn.
- Cảnh báo "N user sẽ bị khóa" tính chính xác bằng một truy vấn tổng hợp; đây là thao tác Admin hiếm, không cần bộ nhớ đệm.

## Đã xác nhận sau khi reviewer đọc

1. Hạn mức đếm mọi passage do user tạo, kể cả passage đã được duyệt công khai (đúng như story; đổi so với code hiện tại). User đang có passage công khai sẽ thấy số đếm tăng và có thể bị khóa passage cũ ngay khi tính năng ra mắt. Builder ghi điều này vào mô tả thay đổi và `AGENTS.md`.
2. Passage đã được duyệt công khai mà bị khóa (chủ đã vượt hạn mức) thì biến mất với mọi người khác, kể cả Premium đang luyện. Mở lại khi chủ mua lại Premium, Admin tăng hạn mức, hoặc chủ xóa bớt passage.
