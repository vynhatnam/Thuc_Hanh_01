# SunCare — React + ASP.NET Core Web API

Kết hợp bài thực hành 1 và 2: giao diện React, API ASP.NET Core, CRUD bác sĩ và luồng đăng ký/đăng nhập hoàn chỉnh. Frontend gọi Axios; Entity Framework Core lưu user, phiên đăng nhập và bác sĩ vào SQLite.

## Chạy project

Yêu cầu: .NET SDK 10 và Node.js tương thích với Vite đã khai báo trong `package.json` (máy hiện tại dùng Node.js 24).

Mở terminal tại thư mục `suncare-react`, cài dependency nếu chưa có:

```powershell
npm install
dotnet restore backend/SunCareApi/SunCareApi.csproj
```

Terminal thứ nhất — chạy backend:

```powershell
npm run dev:api
```

API chạy tại `http://localhost:5275/api/doctors`.

Terminal thứ hai — chạy frontend:

```powershell
npm run dev
```

Mở **http://localhost:5173/doctors** hoặc chọn **Bác sĩ** trên thanh điều hướng. Trang này hỗ trợ xem danh sách, xem chi tiết, tìm kiếm, thêm, sửa và xác nhận xóa bác sĩ, kèm trạng thái đang tải và thông báo lỗi/thành công.

## Luồng đăng ký và đăng nhập

1. Mở `http://localhost:5173/register`, nhập email, mật khẩu và nhập lại mật khẩu.
2. React kiểm tra dữ liệu trước khi gửi `POST /api/auth/register`. API kiểm tra lại dữ liệu và email trùng (không phân biệt hoa/thường), hash mật khẩu bằng ASP.NET Core `PasswordHasher`, rồi lưu vào bảng `Users`.
3. Đăng ký thành công chuyển đến `/login` kèm thông báo. Mật khẩu không được lưu trong state điều hướng hoặc localStorage.
4. Đăng nhập gửi `POST /api/auth/login`. API query user theo email, xác minh password hash và trả token phiên có hiệu lực 8 giờ cùng thông tin user.
5. `AuthProvider` cập nhật React Context và lưu `{ token, expiresAt, user }` dưới khóa **`suncare.auth`** trong localStorage. Axios tự gắn `Authorization: Bearer <token>` vào request cần phiên.
6. Khi tải lại trình duyệt, frontend đọc phiên đã lưu và gọi `GET /api/auth/me` để xác thực lại với database. Thông tin localStorage không được dùng để tự cấp quyền truy cập API.
7. Header hiển thị email, liên kết **Tài khoản** và nút **Đăng xuất**. Trang `/account` hiển thị user hiện tại; truy cập khi chưa đăng nhập sẽ chuyển về `/login` và quay lại trang đã chọn sau khi đăng nhập.
8. Đăng xuất gọi API thu hồi token trong DB, đồng thời xóa Context/localStorage. Phiên hết hạn hoặc API trả `401` cũng được xóa; đăng xuất ở một tab cập nhật các tab cùng origin.

Email bắt buộc, đúng định dạng, tối đa 254 ký tự. Mật khẩu có 8–128 ký tự, không chỉ gồm khoảng trắng; không tự trim mật khẩu. Đăng ký trùng email trả `409`, sai thông tin đăng nhập trả `401`, dữ liệu không hợp lệ trả `400`.

Danh sách/chi tiết bác sĩ vẫn công khai; **thêm, sửa, xóa yêu cầu đăng nhập ở cả giao diện và API**. Bài tập chưa phân quyền vai trò: mọi tài khoản đã đăng nhập đều có thể thực hiện CRUD bác sĩ. Trang đặt lịch yêu cầu đăng nhập nhưng vẫn giữ nội dung tạm của bài trước.

### API tài khoản

| Method | Endpoint | Request / kết quả |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ "email": "ban@example.com", "password": "MatKhau123!" }` → `201` + user |
| POST | `/api/auth/login` | Email/password → `200` + `{ token, expiresAt, user }` |
| GET | `/api/auth/me` | Bearer token → `200` + user; thiếu/hết hạn → `401` |
| POST | `/api/auth/logout` | Bearer token → `204`, token bị thu hồi |

User trả về gồm `id`, `email`, `createdAt`; API không trả password hash. DB lưu hash của token phiên, không lưu token gốc. Đây là phiên opaque có thể thu hồi, không phải JWT.

Các file chính:

- `src/auth/AuthProvider.jsx`: Context, xác thực lại phiên, đăng ký/đăng nhập/đăng xuất.
- `src/auth/sessionStore.js`: localStorage, dữ liệu phiên, đồng bộ nhiều tab.
- `src/auth/RequireAuth.jsx`: bảo vệ route và giữ địa chỉ cần quay lại.
- `src/api/client.js`: Axios interceptors thêm bearer token và xử lý `401`.
- `src/pages/AuthPage.jsx`, `src/pages/AccountPage.jsx`: giao diện tài khoản.
- `backend/SunCareApi/Controllers/AuthController.cs`: validation, query DB, hash/verify mật khẩu.
- `backend/SunCareApi/Auth/SessionAuthenticationHandler.cs`: kiểm tra token/expiry từ DB.

LocalStorage được dùng theo yêu cầu bài tập và chứa token truy cập; khi triển khai thực tế cần HTTPS và bảo vệ XSS. Luồng hiện tại không bao gồm xác minh email, quên mật khẩu hoặc phân quyền quản trị.

## Các endpoint

| Method | Endpoint | Chức năng | Kết quả thành công |
| --- | --- | --- | --- |
| GET | `/api/doctors` | Danh sách bác sĩ | `200` + mảng JSON |
| GET | `/api/doctors/{id}` | Chi tiết bác sĩ | `200` + JSON |
| POST | `/api/doctors` | Thêm bác sĩ | `201` + JSON + header `Location` |
| PUT | `/api/doctors/{id}` | Sửa tên và chuyên khoa | `200` + JSON đã cập nhật |
| DELETE | `/api/doctors/{id}` | Xóa bác sĩ | `204`, không có body |

POST, PUT, DELETE yêu cầu header `Authorization: Bearer <token>` nhận từ đăng nhập; thiếu hoặc token không hợp lệ trả `401`.

Body cho POST và PUT:

```json
{
  "name": "Nguyễn Văn An",
  "specialty": "Tim mạch"
}
```

Tên và chuyên khoa bắt buộc, tối đa 100 ký tự, không chấp nhận chuỗi toàn khoảng trắng. Backend loại bỏ khoảng trắng ở đầu/cuối trước khi lưu. Dữ liệu không hợp lệ trả `400` với thông tin lỗi; ID không tồn tại trả `404`.

File `backend/SunCareApi/SunCareApi.http` chứa request mẫu để thử API trong trình soạn thảo hỗ trợ HTTP requests. Khi thử request sửa/xóa, sử dụng ID nhận từ request thêm mới.

## Axios và kết nối frontend/backend

Các hàm Axios nằm trong `src/api/doctorApi.js`; trang quản lý nằm trong `src/pages/DoctorsPage.jsx`.

```js
getDoctors()                 // GET /api/doctors
getDoctor(id)                // GET /api/doctors/{id}
createDoctor(data)           // POST /api/doctors
updateDoctor(id, data)       // PUT /api/doctors/{id}
deleteDoctor(id)             // DELETE /api/doctors/{id}
```

Mặc định Axios dùng `/api`, Vite chuyển tiếp request đến `http://localhost:5275`, nên frontend và backend dùng chung cấu hình cổng. Vite cố định cổng 5173 để tránh tự đổi cổng khi đang bận.

Khi cần gọi backend ở địa chỉ khác, sao chép `.env.example` thành `.env.local`, đổi `VITE_API_BASE_URL` thành URL kết thúc bằng `/api`, rồi khởi động lại Vite. Nếu gọi khác origin, thêm địa chỉ frontend vào `Cors:AllowedOrigins` trong cấu hình backend.

## Lưu dữ liệu

SQLite được tạo tự động tại `backend/SunCareApi/App_Data/suncare.db` khi chạy backend. Database mới có dữ liệu mẫu; dữ liệu thêm/sửa/xóa được giữ sau khi khởi động lại. Không cần cài SQL Server.

Có thể đổi database bằng connection string `ConnectionStrings:SunCare` hoặc biến môi trường `ConnectionStrings__SunCare`. Backend tự áp dụng **EF migrations** khi khởi động. Migration đầu tiên tiếp nhận bảng `Doctors` của bài 2 rồi tạo thêm bảng `Users`, `AuthSessions` và unique index cho email; không xóa database cũ. SQLite dùng WAL để hỗ trợ các request đồng thời. Khi phát triển cấu trúc bảng tiếp theo, bổ sung migration và cập nhật model snapshot.

## Kiểm tra

```powershell
npm run lint
npm run build
npm run test:api
```

`test:api` build backend, tự chạy API ở cổng tạm bằng database thử nghiệm riêng. Script kiểm tra nâng cấp DB bài 2 không mất dữ liệu, đăng ký, validation, email trùng/đăng ký đồng thời, hash mật khẩu, đăng nhập đúng/sai, phiên qua restart, quyền CRUD, logout/thu hồi token, expiry, CRUD bác sĩ, 404 và CORS. Đồng thời kiểm tra khởi tạo database hoàn toàn mới. Script dừng tiến trình thử nghiệm và dọn dữ liệu tạm khi hoàn tất; không dùng database đang chạy của bạn. Smoke test dùng `node:sqlite`, cần Node.js 24 trở lên.

Để xem bản frontend build:

```powershell
npm run build
npm run preview
```

Giữ backend chạy và mở `http://localhost:4173/doctors`.

Các trang giới thiệu, liên hệ và đặt lịch giữ nội dung có sẵn; phạm vi chức năng hoàn chỉnh là CRUD bác sĩ và xác thực tài khoản.

Tài liệu: [ASP.NET Core Web API](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-10.0), [Axios](https://axios-http.com/docs/api_intro), [Vite proxy](https://vite.dev/config/server-options#server-proxy).
