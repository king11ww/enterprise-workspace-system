# **Kế Hoạch Triển Khai Dự Án Enterprise Workspace & Asset Management System**

Dự án phát triển hệ thống quản lý tài sản và không gian làm việc doanh nghiệp tích hợp trí tuệ nhân tạo, cơ chế xử lý bất đồng bộ và kiểm soát đồng thời.

# **Tổng Quan Tiến Độ Dự Án (8 \- 10 Tuần)**

| Giai đoạn | Tên Phase | Thời gian | Trọng tâm chính |
| :---- | :---- | :---- | :---- |
| **Phase 1** | Setup & Database Design | Tuần 1 \- 2 | Khoi tạo môi trường, thiết kế Database Schema & Migration |
| **Phase 2** | Core API & Concurrency | Tuần 3 \- 5 | Authentication, CRUD Resource, Booking Engine & Lock |
| **Phase 3** | Async Processing & AI Integration | Tuần 6 \- 7 | Message Queue, Background Worker & Gemini AI NLP |
| **Phase 4** | Frontend, CI/CD & Documentation | Tuần 8 \- 10 | Next.js Dashboard, Dockerize, GitHub Actions & Technical Docs |

---

# **Chi Tiết Triển Khai Theo Giai Đoạn**

# **Phase 1: Setup & Database Design**

**Thời gian:** Tuần 1 – Tuần 2  
**Mục tiêu:** Thiết lập hạ tầng phát triển ban đầu và chuẩn hóa mô hình dữ liệu quan hệ.

## **1\. Cài Đặt Môi Trường Phát Triển**

* Thiết lập **Git** cho quản lý mã nguồn, cấu hình `.gitignore` chuẩn cho backend/frontend.  
* Cài đặt **Node.js** (LTS) / **Java** (JDK 17+) / **.NET Core** tùy thuộc vào stack được chọn.  
* Cài đặt **Docker Desktop** để container hóa các dịch vụ phụ trợ.  
* Thiết lập container **PostgreSQL** (chứa dữ liệu chính) và **Redis** (cơ chế caching/locking).

## **2\. Khởi Tạo Dự Án & Cấu Trúc Thư Mục**

* Khởi tạo cấu trúc dự án chuẩn (Clean Architecture hoặc Layered Architecture):  
  * `src/config`: Cấu hình môi trường và biến toàn cục.  
  * `src/controllers` & `src/routes`: Xử lý HTTP request và định tuyến.  
  * `src/services`: Chứa business logic chính.  
  * `src/models` / `src/entities`: Khai báo các đối tượng dữ liệu.  
  * `src/middlewares`: Xử lý xác thực, phân quyền, logging và error handling.

## **3\. Thiết Kế Cơ Sở Dữ Liệu (ERD)**

Xây dựng mô hình quan hệ cho các bảng cốt lõi:

* **User**: `id`, `email`, `password_hash`, `full_name`, `role_id`, `created_at`  
* **Role**: `id`, `name` (Admin, Manager, Employee), `permissions`  
* **Resource**: `id`, `name`, `type` (Meeting Room, Desk, Device), `capacity`, `status`, `location`  
* **Booking**: `id`, `user_id`, `resource_id`, `start_time`, `end_time`, `status` (PENDING, CONFIRMED, CANCELLED)  
* **AuditLog**: `id`, `user_id`, `action`, `entity_type`, `entity_id`, `payload`, `created_at`

## **4\. Tự Động Hóa Dữ Liệu (Migration & Seeding)**

* Viết các file script **Migration** (Sử dụng Prisma, TypeORM, Flyway hoặc EF Core Migrations) để quản lý phiên bản cơ sở dữ liệu.  
* Tạo script **Seeder** để khởi tạo dữ liệu mẫu cho Role, Admin user và một số Resource mặc định.

---

# **Phase 2: Core API & Concurrency Control**

**Thời gian:** Tuần 3 – Tuần 5  
**Mục tiêu:** Xây dựng hệ thống API phục vụ các thao tác cốt lõi và giải quyết triệt để bài toán Race Condition trong đặt tài nguyên.

## **1\. Hệ Thống Xác Thực & Phân Quyền (Auth & RBAC)**

* Triển khai API `/api/auth/register` và `/api/auth/login`.  
* Mã hóa mật khẩu an toàn với **Bcrypt/Argon2**.  
* Phát hành **JWT Token** (Access Token & Refresh Token).  
* Xây dựng Middleware **RBAC (Role-Based Access Control)** để kiểm tra quyền truy cập của từng endpoint dựa trên Role của User.

## **2\. Quản Lý Tài Nguyên (CRUD Resource)**

* Xây dựng bộ API chuẩn RESTful cho Resource:  
  * `GET /api/resources`: Lấy danh sách tài nguyên (hỗ trợ phân trang, lọc theo type/capacity).  
  * `POST /api/resources`: Tạo tài nguyên mới (Chỉ Admin/Manager).  
  * `PUT /api/resources/:id`: Cập nhật thông tin tài nguyên.  
  * `DELETE /api/resources/:id`: Xóa/Soft-delete tài nguyên.

## **3\. Engine Đặt Chỗ & Xử Lý Đồng Thời (Booking API)**

* **Thách thức:** Tránh tình trạng tranh chấp tài nguyên (Double-booking/Race condition) khi nhiều người dùng cùng bấm đặt một phòng/thiết bị tại một khung giờ.  
* **Giải pháp:** Tích hợp **Redis Distributed Lock** (sử dụng thuật toán Redlock hoặc thư viện Redlock-node/Redisson).  
* **Luồng xử lý:**  
  1. Yêu cầu tạo Booking gửi lên Endpoint `/api/bookings`.  
  2. Tạo Lock key duy nhất trên Redis theo dạng: `lock:resource:{resource_id}:{time_slot}`.  
  3. Nếu lấy được Lock: Kiểm tra xung đột lịch trong PostgreSQL \-\> Tạo bản ghi Booking \-\> Giải phóng Lock.  
  4. Nếu không lấy được Lock: Trả về lỗi `409 Conflict` (Tài nguyên đang được xử lý bởi giao dịch khác).  
* **Unit & Integration Test:** Viết kịch bản test đồng thời (Concurrency Test) với **Jest/JUnit** giả lập 50-100 request gửi đến cùng một millisecond để đảm bảo chỉ có 1 booking thành công.

## **4\. Hệ Thống Audit Logs**

* Thiết lập Middleware/Interceptor ghi log toàn bộ các hành vi thay đổi dữ liệu (CREATE, UPDATE, DELETE).  
* Lưu vết chi tiết ai (`user_id`), làm gì (`action`), trên đối tượng nào (`entity_type`, `entity_id`) và dữ liệu trước/sau khi thay đổi (`payload`).

---

# **Phase 3: Async Processing & AI Integration**

**Thời gian:** Tuần 6 – Tuần 7  
**Mục tiêu:** Tối ưu hóa thời gian phản hồi API bằng hàng chờ xử lý bất đồng bộ và tích hợp trợ lý AI xử lý ngôn ngữ tự nhiên.

## **1\. Thiết Lập Hàng Chờ Xử Lý (Message Queue)**

* Cấu hình dịch vụ Message Queue dựa trên **BullMQ / Redis Streams** hoặc **RabbitMQ**.  
* Tách rời luồng xử lý chính (tạo booking) khỏi các tác vụ phụ trợ tốn thời gian.

## **2\. Xử Lý Tác Vụ Ngầm (Background Worker)**

* Khi API Booking tạo bản ghi thành công trong database, đẩy một Event `BOOKING_CREATED` vào Queue.  
* Đội ngũ **Background Worker** tiếp nhận công việc từ Queue và thực hiện gửi Email xác nhận (Mock Service/Nodemailer).  
* Giảm latency phản hồi của API Booking từ vài trăm milliseconds xuống còn dưới 50ms.

## **3\. Tích Hợp Gemini API (AI Natural Language Booking)**

* Tạo Endpoint đặc biệt: `POST /api/ai/parse-intent`.  
* Nhận input là câu lệnh văn bản tự nhiên từ người dùng (Ví dụ: *"Đặt cho tôi phòng họp A vào lúc 14:00 chiều mai trong 2 tiếng"*).  
* Gọi đến **Gemini API** với cấu hình Structured Output (JSON Schema) để trích xuất dữ liệu:  
  * `resource_name`: "Phòng họp A"  
  * `start_time`: ISO Timestamp  
  * `duration`: 120 (phút)  
* Chuẩn hóa kết quả JSON trả về từ AI để Frontend có thể tự động điền (auto-fill) vào form đặt chỗ hoặc gọi trực tiếp API Booking.

---

# **Phase 4: Frontend, CI/CD & Documentation**

**Thời gian:** Tuần 8 – Tuần 10  
**Mục tiêu:** Xây dựng giao diện người dùng, tự động hóa quy trình đóng gói/kiểm thử và hoàn thiện tài liệu kỹ thuật.

## **1\. Phân Hệ Frontend (Next.js / React)**

* Phát triển giao diện người dùng hiện đại, tối ưu UX/UI:  
  * **Trang Auth:** Đăng nhập, Đăng ký, Lưu trữ JWT ở Secure Storage.  
  * **Dashboard Đặt chỗ:** Hiển thị danh sách tài nguyên, bộ lọc, xem lịch theo dạng Calendar/Timeline View.  
  * **AI Prompt Bar:** Ô nhập liệu thông minh cho phép đặt chỗ bằng giọng nói/văn bản qua kết quả xử lý từ Gemini API.  
  * **Trang Quản lý (Admin):** Quản lý tài nguyên và xem Audit Logs.

## **2\. Đóng Gói Ứng Dụng (Containerization)**

* Viết **Dockerfile** tối ưu hóa đa tầng (Multi-stage build) cho cả Backend và Frontend để giảm dung lượng Image.  
* Xây dựng file **`docker-compose.yml`** orchestrate toàn bộ hệ thống gồm: Frontend, Backend, PostgreSQL, Redis và Worker. Chỉ cần chạy 1 câu lệnh `docker compose up -d` là có thể khởi chạy toàn bộ ứng dụng.

## **3\. Tự Động Hóa CI/CD (GitHub Actions)**

* Tạo workflow `.github/workflows/ci.yml` kích hoạt khi có Pull Request hoặc Push vào nhánh `main`.  
* Các bước tự động hóa trong Pipeline:  
  1. Linting mã nguồn để đảm bảo chuẩn Coding Style.  
  2. Chạy toàn bộ Unit Test và Integration Test.  
  3. Build thử Docker Images để đảm bảo không bị lỗi biên dịch.

## **4\. Tài Liệu Kỹ Thuật (README.md)**

Viết file `README.md` hoàn chỉnh bằng **Tiếng Anh** phục vụ bàn giao và đánh giá dự án:

* **Project Architecture Diagram:** Sơ đồ tổng quan kiến trúc hệ thống (Sử dụng Mermaid.js hoặc Image).  
* **Tech Stack:** Danh sách chi tiết các công nghệ và thư viện đã sử dụng.  
* **Getting Started Guide:** Hướng dẫn chi tiết cách clone, thiết lập biến môi trường `.env` và chạy dự án qua Docker.  
* **API Documentation:** Tóm tắt các Endpoint chính hoặc đính kèm file Postman Collection / Swagger Link.  
* **Key Technical Features:** Trình bày chi tiết giải pháp xử lý Distributed Locking với Redis và cách Prompt Engineering cho Gemini API.

