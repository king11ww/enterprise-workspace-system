# BẢNG ĐẶC TẢ KIỂM THỬ TOÀN DIỆN (TEST CASE SPECIFICATION)
## Enterprise Workspace & Asset Management System

Tài liệu này cung cấp bộ kịch bản kiểm thử hoàn chỉnh bao gồm **Kiểm thử Hộp Đen (Black-box Testing)** và **Kiểm thử Hộp Trắng (White-box Testing)** nhằm phục vụ quá trình tự review, đánh giá chất lượng mã nguồn, kiểm tra an toàn dữ liệu và khả năng chịu tải đồng thời của hệ thống.

---

## MỤC LỤC
1. [Phương Pháp Tiếp Cận & Quy Ước](#1-phương-pháp-tiếp-cận--quy-ước)
2. [Bộ Test Case Hộp Đen (Black-Box Test Cases)](#2-bộ-test-case-hộp-đen-black-box-test-cases)
   - [2.1 Phân hệ Xác Thực & Phân Quyền (Auth & RBAC)](#21-phân-hệ-xác-thực--phân-quyền-auth--rbac)
   - [2.2 Phân hệ Quản Lý Tài Nguyên (Resource Management)](#22-phân-hệ-quản-lý-tài-nguyên-resource-management)
   - [2.3 Phân hệ Đặt Chỗ & Hủy Chỗ (Booking API)](#23-phân-hệ-đặt-chỗ--hủy-chỗ-booking-api)
   - [2.4 Phân hệ Trợ Lý Trí Tuệ Nhân Tạo (Gemini NLP Assistant)](#24-phân-hệ-trợ-lý-trí-tuệ-nhân-tạo-gemini-nlp-assistant)
   - [2.5 Phân hệ Giao Diện & Trình Mô Phỏng Đồng Thời (Frontend & Simulator)](#25-phân-hệ-giao-diện--trình-mô-phỏng-đồng-thời-frontend--simulator)
3. [Bộ Test Case Hộp Trắng (White-Box Test Cases)](#3-bộ-test-case-hộp-trắng-white-box-test-cases)
   - [3.1 Cơ Chế Khóa Phân Tán Redis (Redlock Mutex & Lua Script)](#31-cơ-chế-khóa-phân-tán-redis-redlock-mutex--lua-script)
   - [3.2 Ràng Buộc Loại Trừ Cơ Sở Dữ Liệu (PostgreSQL btree_gist Constraint)](#32-ràng-buộc-loại-trừ-cơ-sở-dữ-liệu-postgresql-btree_gist-constraint)
   - [3.3 Hàng Đợi Bất Đồng Bộ & Xử Lý Tác Vụ Ngầm (BullMQ Queue & Worker)](#33-hàng-đợi-bất-đồng-bộ--xử-lý-tác-vụ-ngầm-bullmq-queue--worker)
   - [3.4 Cơ Chế Fallback Thông Minh Của AI (Gemini Structured Outputs & Regex Engine)](#34-cơ-chế-fallback-thông-minh-của-ai-gemini-structured-outputs--regex-engine)
   - [3.5 Hệ Thống Decorator & Guard Phân Quyền (NestJS Execution Context & Reflection)](#35-hệ-thống-decorator--guard-phân-quyền-nestjs-execution-context--reflection)
4. [Hướng Dẫn Tự Chạy Kịch Bản Review Nhanh](#4-hướng-dẫn-tự-chạy-kịch-bản-review-nhanh)

---

## 1. PHƯƠNG PHÁP TIẾP CẬN & QUY ƯỚC

### 1.1 Kỹ thuật áp dụng
* **Kiểm thử Hộp Đen (Black-box):**
  * *Phân vùng tương đương (Equivalence Partitioning)*: Chia dữ liệu đầu vào thành các lớp hợp lệ và không hợp lệ.
  * *Phân tích giá trị biên (Boundary Value Analysis)*: Kiểm tra độ dài mật khẩu (7, 8, 9 ký tự), khoảng thời gian đặt phòng (start = end, start > end).
  * *Kiểm thử bảo mật & phân quyền (Role Boundary Testing)*: Thử nghiệm đặc quyền chéo giữa Admin, Manager và Employee.
* **Kiểm thử Hộp Trắng (White-box):**
  * *Bao phủ nhánh (Branch Coverage)*: Kiểm tra mọi nhánh rẽ `if-else` trong mã nguồn (vd: nhánh lấy được Lock vs không lấy được Lock; Gemini trả về hợp lệ vs lỗi quota fallback).
  * *Kiểm tra tính toàn vẹn vòng đời Lock (Lock Invariant Testing)*: Đảm bảo Redis token validation an toàn và không bao giờ xảy ra mở khóa chéo (cross-process release).
  * *Bẫy lỗi vi phạm tầng Database (Constraint Violation Handling)*: Kiểm tra mã lỗi ngoại lệ PostgreSQL `23P01`.

### 1.2 Mức độ ưu tiên (Severity / Priority)
* **P1 (Critical):** Các chức năng cốt lõi bắt buộc phải vượt qua (Concurrency Lock, Auth Token, Database Integrity).
* **P2 (High):** Các luồng nghiệp vụ quan trọng (CRUD Resource, Gemini NLP Extraction, Queue Worker).
* **P3 (Medium):** Giao diện, trải nghiệm người dùng, thông báo lỗi thân thiện.

---

## 2. BỘ TEST CASE HỘP ĐEN (BLACK-BOX TEST CASES)

### 2.1 Phân hệ Xác Thực & Phân Quyền (Auth & RBAC)

| ID | Chức năng / Kịch bản | Tiền điều kiện | Dữ liệu đầu vào (Input) | Kết quả kỳ vọng (Expected Output) | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BB-AUTH-01** | Đăng ký tài khoản mới thành công | Email chưa tồn tại trong hệ thống | `POST /api/auth/register`<br>Payload: `{"email": "new.user@corp.com", "password": "SecurePassword123!", "fullName": "Nguyễn Văn A"}` | **201 Created**<br>Trả về thông tin User (id, email, fullName, role: `EMPLOYEE`), không lộ `passwordHash`. | **P1** |
| **TC-BB-AUTH-02** | Đăng ký thất bại do trùng Email | Email `admin@enterprise.local` đã tồn tại | `POST /api/auth/register`<br>Payload email trùng | **409 Conflict**<br>`{"message": "Email already registered"}`. | **P1** |
| **TC-BB-AUTH-03** | Đăng ký thất bại do mật khẩu yếu (Giá trị biên) | Hệ thống yêu cầu password >= 8 ký tự | `password: "1234567"` (7 ký tự) | **400 Bad Request**<br>Validation pipe chặn lại kèm thông báo lỗi cụ thể. | **P2** |
| **TC-BB-AUTH-04** | Đăng nhập thành công với tài khoản hợp lệ | Tài khoản đã được kích hoạt | `POST /api/auth/login`<br>`email: "admin@enterprise.local"`<br>`password: "AdminPassword123!"` | **200 OK**<br>Trả về `accessToken`, `refreshToken`, `expiresIn: 86400` và thông tin User. | **P1** |
| **TC-BB-AUTH-05** | Đăng nhập thất bại do sai mật khẩu | Email hợp lệ | `password: "WrongPassword!"` | **401 Unauthorized**<br>`{"message": "Invalid email or password"}`. | **P1** |
| **TC-BB-AUTH-06** | Làm mới Access Token (Refresh Token) | Đã có `refreshToken` hợp lệ | `POST /api/auth/refresh`<br>`{"refreshToken": "<valid_token>"}` | **200 OK**<br>Cấp phát `accessToken` mới hợp lệ. | **P1** |
| **TC-BB-AUTH-07** | Phân quyền endpoint: Employee truy cập route của Admin | Đăng nhập với role `EMPLOYEE` | Gửi request có Bearer token Employee tới `GET /api/auth/admin-test` | **403 Forbidden**<br>`{"message": "Forbidden resource"}`. | **P1** |
| **TC-BB-AUTH-08** | Truy cập endpoint bảo vệ mà không truyền Token | Không có Header Authorization | `GET /api/resources` | **401 Unauthorized**<br>`{"message": "Unauthorized"}`. | **P1** |

---

### 2.2 Phân hệ Quản Lý Tài Nguyên (Resource Management)

| ID | Chức năng / Kịch bản | Tiền điều kiện | Dữ liệu đầu vào (Input) | Kết quả kỳ vọng (Expected Output) | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BB-RES-01** | Lấy danh sách tài nguyên kèm phân trang | Đã đăng nhập (bất kỳ role nào) | `GET /api/resources?page=1&limit=5` | **200 OK**<br>Mảng chứa tối đa 5 phần tử; object `meta` có `page: 1, limit: 5, total, totalPages`. | **P2** |
| **TC-BB-RES-02** | Lọc tài nguyên theo loại (Type Filter) | Đã có tài nguyên loại `MEETING_ROOM` | `GET /api/resources?type=MEETING_ROOM` | **200 OK**<br>100% tài nguyên trả về đều có `type === "MEETING_ROOM"`. | **P2** |
| **TC-BB-RES-03** | Lọc tài nguyên theo sức chứa tối thiểu (Capacity) | Đã có phòng sức chứa đa dạng | `GET /api/resources?minCapacity=15` | **200 OK**<br>Tất cả tài nguyên trả về đều có `capacity >= 15`. | **P2** |
| **TC-BB-RES-04** | Tìm kiếm theo từ khóa (Keyword Search) | Đã có phòng "Hội đồng" | `GET /api/resources?search=hội đồng` | **200 OK**<br>Trả về chính xác "Phòng hội đồng (Executive Boardroom)". | **P2** |
| **TC-BB-RES-05** | Admin tạo tài nguyên mới hợp lệ | Đăng nhập với role `ADMIN` | `POST /api/resources`<br>`{"name": "Studio Podcast Tầng 1", "type": "DEVICE", "capacity": 3, "location": "Tầng 1"}` | **201 Created**<br>Tạo thành công, tự động gán status `AVAILABLE`, ghi nhận Audit Log. | **P2** |
| **TC-BB-RES-06** | Employee cố gắng tạo tài nguyên | Đăng nhập với role `EMPLOYEE` | `POST /api/resources` | **403 Forbidden** (Chỉ Admin/Manager được tạo). | **P1** |
| **TC-BB-RES-07** | Tạo tài nguyên thất bại do trùng tên | Đã có phòng tên "Phòng họp A" | `POST /api/resources` với tên trùng | **409 Conflict**<br>`{"message": "Resource name already exists"}`. | **P2** |
| **TC-BB-RES-08** | Ngăn chặn xóa tài nguyên đang có lịch đặt sắp tới | Tài nguyên đang gắn với 1 booking `CONFIRMED` | `DELETE /api/resources/:id` | **400 Bad Request**<br>Báo lỗi an toàn: Không thể xóa tài nguyên đang có booking hoạt động. | **P1** |

---

### 2.3 Phân hệ Đặt Chỗ & Hủy Chỗ (Booking API)

| ID | Chức năng / Kịch bản | Tiền điều kiện | Dữ liệu đầu vào (Input) | Kết quả kỳ vọng (Expected Output) | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BB-BOOK-01** | Đặt phòng thành công trong khung giờ trống | Tài nguyên đang `AVAILABLE`, giờ chưa ai đặt | `POST /api/bookings`<br>`resourceId: <valid_id>`<br>`startTime: "2026-10-30T09:00:00Z"`<br>`endTime: "2026-10-30T11:00:00Z"` | **201 Created**<br>Booking có status `CONFIRMED`, gán đúng `userId`. | **P1** |
| **TC-BB-BOOK-02** | Đặt phòng thất bại: Thời gian bắt đầu lớn hơn kết thúc | Tài nguyên hợp lệ | `startTime: 11:00`, `endTime: 09:00` | **400 Bad Request**<br>`{"message": "End time must be after start time"}`. | **P1** |
| **TC-BB-BOOK-03** | Đặt phòng thất bại: Thời gian trong quá khứ | Ngày gửi là năm 2026 | `startTime: "2025-01-01T08:00:00Z"` | **400 Bad Request**<br>`{"message": "Start time must be in the future"}`. | **P1** |
| **TC-BB-BOOK-04** | Đặt trùng 100% khung giờ với booking đã có | Đã có booking từ 09:00 - 11:00 | Gửi request đặt từ 09:00 - 11:00 | **409 Conflict**<br>`{"message": "Resource is already booked for the selected time range"}`. | **P1** |
| **TC-BB-BOOK-05** | Đặt trùng giao nhau một phần (Overlap đầu/cuối) | Đã có booking từ 09:00 - 11:00 | Gửi request đặt từ 10:00 - 12:00 (giao nhau 1 tiếng) | **409 Conflict**<br>Phát hiện xung đột lịch và từ chối. | **P1** |
| **TC-BB-BOOK-06** | Đặt khung giờ liền kề sát nút (Touching boundaries) | Đã có booking 09:00 - 10:00 | Gửi request đặt từ 10:00 - 11:00 | **201 Created**<br>Thành công! Khung giờ nửa đóng nửa mở `[start, end)` cho phép bắt đầu ngay khi phiên trước kết thúc. | **P1** |
| **TC-BB-BOOK-07** | Người dùng hủy booking của chính mình | Booking đang ở trạng thái `CONFIRMED` | `PATCH /api/bookings/:id/cancel` bởi người tạo | **200 OK**<br>Status chuyển thành `CANCELLED`. Khung giờ được giải phóng. | **P2** |
| **TC-BB-BOOK-08** | Employee cố gắng hủy booking của người khác | Booking thuộc sở hữu của User B | User A (`EMPLOYEE`) gửi request hủy | **403 Forbidden**<br>`{"message": "You can only cancel your own bookings"}`. | **P1** |

---

### 2.4 Phân hệ Trợ Lý Trí Tuệ Nhân Tạo (Gemini NLP Assistant)

| ID | Chức năng / Kịch bản | Tiền điều kiện | Dữ liệu đầu vào (Input) | Kết quả kỳ vọng (Expected Output) | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BB-AI-01** | Trích xuất câu lệnh tiếng Việt chuẩn | Backend có kết nối API Gemini | `POST /api/ai/parse-intent`<br>`{"prompt": "Đặt cho tôi phòng họp A vào lúc 14:00 chiều mai trong 2 tiếng"}` | **200 OK**<br>`extracted.resourceName: "Phòng họp A"`<br>`extracted.durationMinutes: 120`<br>`startTime` là chuỗi ISO chính xác 14:00 ngày mai. | **P2** |
| **TC-BB-AI-02** | Trích xuất câu lệnh tiếng Anh chuẩn | Backend có kết nối API Gemini | `prompt: "Book Hot Desk 101 on Friday at 9am for 3 hours"` | **200 OK**<br>`extracted.resourceName: "Hot Desk 101"`<br>`extracted.durationMinutes: 180`. | **P2** |
| **TC-BB-AI-03** | Khớp tên gần đúng (Fuzzy Resource Matching) | Có tài nguyên "Phòng hội đồng (Executive Boardroom)" | `prompt: "Đặt phòng hội đồng lúc 10h sáng mai"` | **200 OK**<br>Khớp chính xác với tên tài nguyên trong Database. | **P2** |
| **TC-BB-AI-04** | Câu lệnh không chứa thông tin đặt chỗ | Người dùng nhập hội thoại ngẫu nhiên | `prompt: "Thời tiết hôm nay thế nào?"` | **200 OK**<br>`confidence < 0.5`, `explanation` nêu rõ không đủ thông tin đặt chỗ. | **P3** |

---

### 2.5 Phân hệ Giao Diện & Trình Mô Phỏng Đồng Thời (Frontend & Simulator)

| ID | Chức năng / Kịch bản | Tiền điều kiện | Các bước thực hiện (Steps) | Kết quả kỳ vọng (Expected Output) | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-BB-UI-01** | Đăng nhập tài khoản nhanh từ giao diện | Vào `http://localhost:3000` | Click chọn nút tài khoản mẫu `Admin` hoặc `Employee` -> Click **Sign In** | Token được lưu vào `localStorage`, thanh trạng thái hiển thị "System Administrator (ADMIN)", mở khóa các tính năng đặt chỗ. | **P2** |
| **TC-BB-UI-02** | Tương tác với AI Prompt Bar | Đã đăng nhập trên UI | Nhập câu lệnh vào thanh AI -> Click **Analyze with Gemini AI** | Thẻ preview Intent xuất hiện với tên phòng, giờ bắt đầu, thời lượng; form đặt phòng tự động điền giá trị. | **P2** |
| **TC-BB-UI-03** | Chạy mô phỏng kiểm thử 20 request đồng thời (Stress Test Simulator) | Chọn tài nguyên có sẵn trên giao diện | Click nút **"🔥 Run 20 Concurrent Booking Requests"** | Hệ thống kích hoạt 20 asynchronous fetch request cùng 1 millisecond.<br>Bảng thống kê hiển thị: **1 Succeeded (201)** và **19 Conflicts (409)**.<br>Danh sách thẻ phản hồi hiển thị đúng thời gian phản hồi (ms) của từng worker. | **P1** |
| **TC-BB-UI-04** | Lọc động tài nguyên trên Catalog | Giao diện hiển thị danh mục | Bấm nút lọc "Meeting Rooms", "Desks", "Devices" | Danh sách tự động lọc mượt mà mà không tải lại toàn trang. | **P3** |

---

## 3. BỘ TEST CASE HỘP TRẮNG (WHITE-BOX TEST CASES)

### 3.1 Cơ Chế Khóa Phân Tán Redis (Redlock Mutex & Lua Script)

*File nguồn kiểm tra:* [backend/src/redis/redis.service.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/redis/redis.service.ts), [backend/src/bookings/bookings.service.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/bookings/bookings.service.ts)

| ID | Đoạn mã / Hàm kiểm tra | Kịch bản kiểm thử mã nguồn | Logic nội tại cần xác thực | Kết quả kỳ vọng | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WB-LOCK-01** | `RedisService.acquireLock` | Kiểm tra tính nguyên tử (Atomicity) của lệnh `SET NX PX` | Lệnh `this.client.set(key, token, 'PX', ttlMs, 'NX')` phải trả về chuỗi `'OK'` nếu key chưa tồn tại và `null` nếu key đã bị chiếm giữ. | Khi 2 tiến trình gọi đồng thời, Redis đơn luồng chỉ cho phép đúng 1 tiến trình nhận `'OK'`. | **P1** |
| **TC-WB-LOCK-02** | Vòng lặp thử lại với độ trễ ngẫu nhiên (Retry with Jitter) | Kiểm tra nhánh `while (attempt < maxRetries)` | Khi không lấy được lock, mã nguồn phải gọi `await this.sleep(delayMs + jitter)`. Độ lệch ngẫu nhiên tránh hiện tượng Thundering Herd. | Nếu sau 5 lần thử (tổng thời gian vượt quá giới hạn) vẫn không có lock, hàm trả về `null`. | **P1** |
| **TC-WB-LOCK-03** | `RedisService.releaseLock` (Lua Script Validation) | Kịch bản Process A giữ lock quá 5s (TTL expired), Process B chiếm lock, sau đó Process A mới hoàn tất | Script Lua: `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`. | Process A truyền token cũ -> Lua script trả về `0` và KHÔNG xóa key của Process B. Loại bỏ hoàn toàn lỗi xóa nhầm lock chéo. | **P1** |
| **TC-WB-LOCK-04** | Khối `finally` giải phóng tài nguyên | Xảy ra ngoại lệ bất ngờ giữa chừng khi kiểm tra database | `try { ... } finally { await this.redisService.releaseLock(lockKey, lockToken); }`. | Khối `finally` luôn được thực thi trong mọi trường hợp, đảm bảo không bao giờ để lại "Deadlock" trên Redis. | **P1** |

---

### 3.2 Ràng Buộc Loại Trừ Cơ Sở Dữ Liệu (PostgreSQL btree_gist Constraint)

*File nguồn kiểm tra:* [backend/prisma/migrations/20261024131658_booking_no_overlap/migration.sql](file:///c:/Users/ADMIN/Downloads/project/backend/prisma/migrations/20261024131658_booking_no_overlap/migration.sql)

| ID | Đoạn mã / Ràng buộc | Kịch bản kiểm thử mã nguồn | Logic nội tại cần xác thực | Kết quả kỳ vọng | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WB-DB-01** | Extension `btree_gist` & Constraint `bookings_no_overlap` | Cố tình chạy lệnh Raw SQL chèn trực tiếp 2 booking trùng giờ mà KHÔNG thông qua tầng NestJS API | Lệnh: `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'CONFIRMED')`. | PostgreSQL từ chối câu lệnh thứ 2 và ném ra mã lỗi `23P01 (exclusion_violation)`. | **P1** |
| **TC-WB-DB-02** | Bỏ qua các booking đã bị hủy (`CANCELLED`) | Booking A bị `CANCELLED`, chèn Booking B có cùng khung giờ | Mệnh đề `WHERE (status = 'CONFIRMED')` chỉ áp dụng exclusion constraint cho các bản ghi đang hoạt động. | Câu lệnh chèn Booking B thành công mỹ mãn mà không bị chặn bởi bản ghi đã hủy. | **P1** |
| **TC-WB-DB-03** | Bẫy lỗi `PrismaClientKnownRequestError` (`P2010` / `23P01`) | Kịch bản cực đoan: Redis gặp sự cố nhưng Postgres vẫn bảo vệ hệ thống | Trong `bookings.service.ts`, khối `catch` kiểm tra mã lỗi cơ sở dữ liệu nếu có vi phạm xung đột đồng thời. | API bắt được lỗi từ DB và chuyển đổi thành `ConflictException` (409) thân thiện với client. | **P1** |

---

### 3.3 Hàng Đợi Bất Đồng Bộ & Xử Lý Tác Vụ Ngầm (BullMQ Queue & Worker)

*File nguồn kiểm tra:* [backend/src/notifications/notifications.processor.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/notifications/notifications.processor.ts), [backend/src/notifications/notifications-producer.service.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/notifications/notifications-producer.service.ts)

| ID | Đoạn mã / Hàm kiểm tra | Kịch bản kiểm thử mã nguồn | Logic nội tại cần xác thực | Kết quả kỳ vọng | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WB-QUEUE-01** | `NotificationsProducerService.sendBookingCreated` | Đo lường độ trễ (Latency) của API `POST /api/bookings` | Hàm gọi `this.notificationsQueue.add('BOOKING_CREATED', payload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })`. | Hàm đẩy job vào Redis Queue mất < 5ms. API trả về ngay cho client mà không phải chờ quá trình gửi email hoàn tất. | **P1** |
| **TC-WB-QUEUE-02** | `NotificationsProcessor.process` | Worker nhận job từ Redis Stream/List | Phương thức `@Processor('notifications')` tự động kích hoạt khi có event mới. | Worker bóc tách payload, in log xác nhận email thành công và tạo 1 bản ghi `AuditLog` với action `NOTIFICATION_DISPATCHED`. | **P2** |
| **TC-WB-QUEUE-03** | Cơ chế Retry khi dịch vụ email bên thứ ba bị gián đoạn | Giả lập exception ném ra trong hàm gửi email của Worker | Cấu hình `attempts: 3`. | BullMQ đánh dấu job thất bại tạm thời, giữ job trong trạng thái `delayed` và thực hiện thử lại lần 2, lần 3 theo thuật toán exponential backoff. | **P2** |

---

### 3.4 Cơ Chế Fallback Thông Minh Của AI (Gemini Structured Outputs & Regex Engine)

*File nguồn kiểm tra:* [backend/src/ai/ai.service.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/ai/ai.service.ts)

| ID | Đoạn mã / Hàm kiểm tra | Kịch bản kiểm thử mã nguồn | Logic nội tại cần xác thực | Kết quả kỳ vọng | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WB-AI-01** | `responseSchema` validation | Kiểm tra cấu hình SDK `@google/genai` | Cấu hình `responseMimeType: 'application/json'` và Schema ép buộc các trường: `resourceName`, `startTime`, `durationMinutes`, `confidence`, `explanation`. | Gemini 2.5 Flash luôn trả về định dạng JSON hợp lệ, an toàn khi gọi `JSON.parse()`. | **P2** |
| **TC-WB-AI-02** | Nhánh lỗi `catch (error)` -> `fallbackRuleBasedExtractor` | Xóa `GEMINI_API_KEY` trong file `.env` hoặc tắt mạng Internet | Khối `try` ném lỗi kết nối/xác thực -> luồng chạy nhảy vào hàm `fallbackRuleBasedExtractor(prompt)`. | Hệ thống KHÔNG sập với mã lỗi 500, mà dùng Regular Expressions bóc tách giờ, ngày mai, phòng họp, trả về kết quả 200 OK với cờ `isFallback: true`. | **P1** |
| **TC-WB-AI-03** | Chuẩn hóa thời gian tương đối (Relative Date Resolver) | Nhập từ khóa: "chiều mai", "thứ hai tuần tới" | Thuật toán tính toán ngày dựa trên `new Date()` hiện tại cộng thêm số ngày tương ứng và đặt giờ chính xác. | Timestamp ISO tạo ra có ngày trùng với ngày mai thực tế và múi giờ hợp lệ. | **P2** |

---

### 3.5 Hệ Thống Decorator & Guard Phân Quyền (NestJS Execution Context & Reflection)

*File nguồn kiểm tra:* [backend/src/auth/guards/roles.guard.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/auth/guards/roles.guard.ts), [backend/src/auth/guards/jwt-auth.guard.ts](file:///c:/Users/ADMIN/Downloads/project/backend/src/auth/guards/jwt-auth.guard.ts)

| ID | Đoạn mã / Hàm kiểm tra | Kịch bản kiểm thử mã nguồn | Logic nội tại cần xác thực | Kết quả kỳ vọng | Ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WB-GUARD-01** | `@Public()` Decorator Reflector | Gọi endpoint có gắn `@Public()` (như `/api/auth/login`) | `this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])`. | Trả về `true`, `JwtAuthGuard` lập tức cho phép request đi qua mà không parse Bearer token. | **P1** |
| **TC-WB-GUARD-02** | Quyền tối cao của vai trò `ADMIN` | User có role `ADMIN` gọi bất kỳ endpoint nào yêu cầu `@Roles('MANAGER')` | Biểu thức kiểm tra: `user.role === 'ADMIN' || requiredRoles.includes(user.role)`. | Quyền Admin luôn trả về `true`, bypass qua các kiểm tra vai trò đơn lẻ mà không cần khai báo lặp lại. | **P1** |
| **TC-WB-GUARD-03** | `@CurrentUser()` Custom Parameter Decorator | Kiểm tra việc gắn thông tin giải mã từ JWT vào Controller | Decorator `createParamDecorator((data, ctx) => ctx.switchToHttp().getRequest().user)`. | Controller nhận đúng instance object của `AuthenticatedUser` (id, email, role, permissions) một cách an toàn. | **P2** |

---

## 4. HƯỚNG DẪN TỰ CHẠY KỊCH BẢN REVIEW NHANH

Bạn có thể tự chạy nhanh các kịch bản kiểm thử then chốt này trên máy tính bằng các lệnh sau:

### 4.1 Kiểm thử Concurrency & Redlock (50 requests song song)
Mở PowerShell tại thư mục dự án và chạy:
```powershell
node backend/scratch/test-bookings.mjs
```
*Kết quả chuẩn:*
* `Request 1: 201 Created`
* `Request 2..50: 409 Conflict` (Chính xác 1 request thành công, 49 request bị khóa chặn an toàn).

### 4.2 Kiểm thử Message Queue & Background Worker
```powershell
node backend/scratch/test-queue.mjs
```
*Kết quả chuẩn:*
* Job được đưa vào queue trong ~5ms.
* Worker in ra log mô phỏng gửi email và ghi Audit Log vào PostgreSQL.

### 4.3 Kiểm thử Full Bộ API Resources (13 test cases tự động)
```powershell
powershell -ExecutionPolicy Bypass -File scratch/test-resources.ps1
```
*Kết quả chuẩn:* 13/13 test cases PASSED (100%).

### 4.4 Kiểm thử Trực Quan Trên Web Dashboard
1. Truy cập [http://localhost:3000](http://localhost:3000).
2. Click đăng nhập tài khoản **Admin** (`AdminPassword123!`).
3. Nhập vào AI Prompt Bar: `"Đặt phòng hội đồng lúc 9:00 sáng mai trong 2 tiếng"` -> Bấm **Analyze with Gemini AI**.
4. Bấm nút **"🔥 Run 20 Concurrent Booking Requests"** để tận mắt chứng kiến 20 luồng đồng thời tranh chấp tài nguyên trên giao diện Dark Glassmorphism.
