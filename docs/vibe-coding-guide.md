# Hướng dẫn vibe coding với base project

Tài liệu này dành cho học sinh dùng **Google Antigravity** (hoặc công cụ AI khác) để làm dự án trên base này.

## 1. Chạy project lần đầu

Cần cài sẵn Node.js 22.12+ và Docker Desktop (hoặc có sẵn một MongoDB, ví dụ MongoDB Atlas).

```bash
npm run setup          # cài thư viện cho shared, BE và FE (một lần ở thư mục gốc), tạo file .env
docker compose up -d   # bật MongoDB ở cổng 27017
npm run seed           # tạo tài khoản mẫu
npm run dev            # chạy BE (cổng 5003) và FE (cổng 5173) cùng lúc
```

Mở http://localhost:5173 và đăng nhập bằng `demo@example.com` / `demo1234`, hoặc `admin@example.com` / `admin1234` (tài khoản admin). Lệnh seed cũng tạo thêm 12 tài khoản học sinh mẫu `student01..12@example.com` / `student1234`.

- **Không cần cấu hình email.** Khi đăng ký, mã OTP được in ra terminal của backend, trong khung `DEV EMAIL`.
- **Không cần Cloudinary** nếu chưa dùng ảnh. Thiếu cấu hình thì chỉ chức năng upload ảnh báo lỗi, phần còn lại vẫn chạy.
- Mặc định đăng nhập **không** hỏi mã OTP. Muốn bật thì vào trang **Profile → Security → Email code at login**.

Dùng MongoDB Atlas thay cho Docker: sửa `MONGO_URI` trong `BE/.env`.

Cài thêm thư viện cho một app: chạy ở thư mục gốc `npm install <tên-thư-viện> -w BE` (hoặc `-w FE`). Code mà cả BE và FE
cùng cần (ví dụ độ dài mật khẩu tối thiểu) đặt trong thư mục `shared/` và import bằng `@typetrace/shared`.

## 2. AI đọc quy ước ở đâu?

Antigravity tự đọc file `AGENTS.md` ở thư mục gốc. File này mô tả cấu trúc, các hàm có sẵn và cách thêm tính năng, nên bạn **không cần** giải thích lại cho AI mỗi lần.

Có sẵn hai workflow, gõ trong khung chat của Antigravity:

| Lệnh | Tác dụng |
|---|---|
| `/new-module` | Tạo một tính năng mới (API + trang + test) từ module mẫu `notes`, rồi đổi field theo yêu cầu |
| `/check` | Chạy test, lint, build và giải thích lỗi nếu có |

## 3. Module mẫu `notes`

Trang **Notes** (http://localhost:5173/notes) là ví dụ đầy đủ một tính năng: danh sách có phân trang, tìm kiếm, lọc theo tag, tạo/sửa/xoá, mỗi người chỉ thấy ghi chú của mình, admin xem được tất cả. Mọi tính năng mới nên làm giống nó.

Tự tạo module bằng lệnh:

```bash
npm run gen:module -- product          # tạo /api/products và trang /products
npm run gen:module -- lesson-plan      # tên nhiều từ dùng dấu "-"
npm run gen:module -- product --remove # lỡ tạo sai thì xoá đi
```

Sau khi tạo, module có sẵn field `title`, `content`, `tags`. Bạn (hoặc AI) đổi chúng thành field thật của mình.

Lệnh sẽ từ chối những tên trùng với code có sẵn, ví dụ `class`, `page`, `query`, `math`, hay tên chứa chữ `note`. Khi đó chỉ cần chọn tên khác, như `classroom` hoặc `math-lesson`. Lệnh `--remove` chỉ xoá những file do chính lệnh tạo ra, và giữ lại file bạn tự thêm vào.

## 4. Trang quản trị (admin) mẫu

Đăng nhập bằng `admin@example.com` / `admin1234`, rồi bấm **Admin** trên thanh menu để vào http://localhost:5173/admin.

> ⚠️ Trong base này, **tài khoản nào đăng nhập cũng vào được trang admin** để các bạn dễ thử. Như vậy ai cũng sửa hoặc xoá được người dùng khác. Trước khi cho người thật dùng, hãy khoá lại cho riêng admin bằng prompt: *"Chỉ cho admin vào trang admin: dùng `requireRole('admin')` trong `BE/src/routes/admin.route.ts` và `roles={['admin']}` cho route admin trong `FE/src/App.tsx`, cập nhật test."*

- **Dashboard**: các con số tổng quan (số người dùng, admin, đã xác thực email, số ghi chú) và danh sách người dùng mới.
- **Users**: quản lý người dùng. Có tìm theo email hoặc tên, lọc theo role và trạng thái xác thực, sắp xếp khi bấm tiêu đề cột, phân trang, sửa (tên, role, xác thực, OTP khi đăng nhập), xoá từng người hoặc chọn nhiều người để xoá cùng lúc. Admin không thể tự xoá mình hay tự bỏ quyền admin của mình.
- Tìm kiếm, bộ lọc và trang hiện tại được lưu trên URL, nên tải lại trang hay gửi link cho người khác vẫn giữ nguyên.

Các thành phần dùng lại được cho mọi trang quản trị: `DataTable` (bảng), `SearchInput` (ô tìm kiếm), `FilterSelect` (bộ lọc), `TableToolbar`, `StatCard` (ô thống kê) và hook `useListParams`.

**Prompt mẫu:**

- > Thêm trang admin quản lý `product`: bảng có tìm theo tên, lọc theo `inStock`, sắp xếp theo giá, sửa và xoá, chọn nhiều để xoá. Làm giống `AdminUsersPage` và theo mục "Admin area" trong `AGENTS.md`.
- > Thêm một ô thống kê "Số sản phẩm hết hàng" vào Dashboard của admin.
- > Thêm nút "Xuất CSV" trên trang admin Users để tải danh sách người dùng đang lọc.

## 5. AI chat bot mẫu (Gemini miễn phí)

Ở **góc dưới bên phải** mọi trang có nút chat tròn. Bấm vào sẽ mở một khung chat nhỏ ngay ở góc đó; đóng lại thì cuộc trò chuyện vẫn còn. Đây là chatbot mẫu dùng Google Gemini, gói miễn phí. Nó được viết đơn giản để bạn sửa thành bot của dự án mình, ví dụ gia sư toán, trợ lý bán hàng hay bot đố vui.

**Bật chatbot:**

1. Vào https://aistudio.google.com/apikey, đăng nhập Google và bấm **Create API key**. Không cần thẻ thanh toán.
2. Dán key vào `BE/.env`: `GEMINI_API_KEY=...` (giữ nguyên `GEMINI_MODEL=gemini-3.5-flash-lite`).
3. Tắt rồi chạy lại `npm run dev`.

> ⚠️ Không đưa API key vào code frontend, lên GitHub, hay gửi cho người khác. Key chỉ nằm trong `BE/.env`, và file này không được commit.

**Sửa bot cho đúng dự án:**

| Muốn đổi | Sửa file |
|---|---|
| Bot là ai, trả lời thế nào, được/không được làm gì | `BE/src/config/chatbot.ts` → `systemPrompt` |
| Bot suy nghĩ kỹ đến đâu trước khi trả lời | `BE/src/config/chatbot.ts` → `thinkingLevel` (`LOW` nhanh, tiết kiệm lượt miễn phí; `MEDIUM`/`HIGH` trả lời câu khó tốt hơn nhưng chậm hơn) |
| Bot nhớ bao nhiêu tin nhắn gần nhất | `BE/src/config/chatbot.ts` → `historyLimit` |
| Tên bot, lời chào, câu hỏi gợi ý | `FE/src/modules/chat/chat.config.ts` |
| Giao diện nút chat và khung chat | `FE/src/modules/chat/components/ChatWidget.tsx` (vị trí, kích thước), `ChatPanel.tsx` (nội dung) |

**Giới hạn của gói miễn phí:** Google chỉ cho một số request mỗi phút và mỗi ngày, con số này thay đổi theo thời gian. Khi hết lượt, bot báo *"The free AI quota is used up for now"*, chỉ cần đợi một lúc. Mỗi người dùng cũng chỉ được gửi 10 tin mỗi phút để không ai dùng hết lượt của cả nhóm.

**Prompt mẫu để nhờ AI sửa chatbot:**

- > Đổi chatbot thành gia sư Toán lớp 10: chỉ trả lời câu hỏi về Toán, giải thích từng bước, không đưa đáp án ngay mà gợi ý trước. Sửa `systemPrompt` trong `BE/src/config/chatbot.ts`, đổi tên bot và câu hỏi gợi ý trong `chat.config.ts`.
- > Cho chatbot trả lời dựa trên danh sách `product` trong database: trước khi gọi Gemini, lấy tối đa 20 sản phẩm và đưa vào system prompt. Thêm test.
- > Lưu lịch sử chat vào MongoDB cho từng người dùng, để tải lại trang vẫn còn. Làm theo cách module `notes` làm (model, service, route, test).
- > Hiển thị câu trả lời của bot dạng Markdown (in đậm, danh sách) thay vì chữ thường.

## 6. Prompt mẫu

Copy rồi sửa phần trong ngoặc cho đúng dự án của bạn.

1. **Tạo tính năng mới**
   > /new-module Tạo module `product` với các field: `name` (chuỗi, bắt buộc, tối đa 100 ký tự), `price` (số, bắt buộc, ≥ 0), `inStock` (true/false, mặc định true). Bỏ field `content` và `tags`.

2. **Thêm field cho tính năng đã có**
   > Thêm field `dueDate` (ngày, không bắt buộc) cho module `notes`: model, validator, type, form và hiển thị trên card. Cập nhật test.

3. **Thêm ảnh cho một tính năng**
   > Cho phép upload một ảnh bìa cho `product`, làm giống cách upload avatar trong `profile` (dùng `imageUpload` và `uploadImage`). Hiển thị ảnh trên card.

4. **Trang chỉ dành cho admin**
   > Tạo trang `/admin/reports` chỉ admin xem được. Dùng `requireRole('admin')` ở backend và `roles: ['admin']` cho route trong module frontend.

5. **Lọc và sắp xếp**
   > Thêm bộ lọc `inStock` và sắp xếp theo giá (tăng/giảm) cho trang danh sách `product`, làm giống cách `notes` lọc theo tag.

6. **Sửa lỗi**
   > Khi tôi bấm "Create" trên trang `product` thì hiện lỗi "[dán nguyên văn lỗi]". Tìm nguyên nhân trước rồi mới sửa, sau đó chạy /check.

7. **Viết test**
   > Viết thêm test cho trường hợp tạo `product` với giá âm phải trả về lỗi 400.

8. **Giải thích code**
   > Giải thích cho tôi luồng từ lúc bấm "New note" tới lúc dữ liệu được lưu vào MongoDB, đi qua những file nào.

## 7. Mẹo khi vibe coding

- **Mỗi lần chỉ nhờ một việc nhỏ.** Ví dụ "thêm field price", đừng gộp kiểu "làm cả trang bán hàng".
- **Luôn kết thúc bằng `/check`.** Đừng tin AI nói "xong rồi" khi test chưa chạy.
- **Đưa lỗi nguyên văn** cho AI, gồm thông báo lỗi và tên file, thay vì tự tóm tắt.
- **Commit thường xuyên** (`git add -A && git commit -m "..."`) để lỡ AI làm hỏng thì quay lại được.
- **Kiểm tra dữ liệu trả về**: API không bao giờ được trả mật khẩu hay mã OTP. Nếu thấy thì báo lỗi ngay.
- Khi AI định viết lại `App.tsx`, tự gọi API bằng `useEffect`, hoặc tự viết `try/catch` trả lỗi, nhắc nó: *"Làm theo AGENTS.md"*.

## 8. Tự kiểm tra trước khi nộp

- [ ] `npm test` chạy xanh
- [ ] `npm run lint` không còn lỗi
- [ ] `npm run build` thành công
- [ ] Đăng nhập bằng hai tài khoản khác nhau: người này không thấy dữ liệu của người kia
- [ ] Không có file `.env` nào trong commit (`git status` không hiện `.env`)
