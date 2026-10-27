# SunCare — React + ASP.NET Core Web API

Hoàn thiện bài thực hành CRUD bác sĩ: frontend React gọi backend ASP.NET Core qua Axios bằng GET, POST, PUT và DELETE. Dữ liệu được lưu bằng Entity Framework Core và SQLite.

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

## Các endpoint

| Method | Endpoint | Chức năng | Kết quả thành công |
| --- | --- | --- | --- |
| GET | `/api/doctors` | Danh sách bác sĩ | `200` + mảng JSON |
| GET | `/api/doctors/{id}` | Chi tiết bác sĩ | `200` + JSON |
| POST | `/api/doctors` | Thêm bác sĩ | `201` + JSON + header `Location` |
| PUT | `/api/doctors/{id}` | Sửa tên và chuyên khoa | `200` + JSON đã cập nhật |
| DELETE | `/api/doctors/{id}` | Xóa bác sĩ | `204`, không có body |

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

Có thể đổi database bằng connection string `ConnectionStrings:SunCare` hoặc biến môi trường `ConnectionStrings__SunCare`. Project dùng `EnsureCreated` cho bài thực hành; khi thay đổi cấu trúc bảng trên database có sẵn, cần bổ sung EF migrations trước khi áp dụng thay đổi đó.

## Kiểm tra

```powershell
npm run lint
npm run build
npm run test:api
```

`test:api` build backend, tự chạy API ở cổng tạm bằng database thử nghiệm riêng, kiểm tra CRUD, validation, 404, CORS và dữ liệu sau khi khởi động lại. Script dừng tiến trình thử nghiệm và dọn dữ liệu tạm khi hoàn tất; không dùng database đang chạy của bạn.

Để xem bản frontend build:

```powershell
npm run build
npm run preview
```

Giữ backend chạy và mở `http://localhost:4173/doctors`.

Phạm vi bài thực hành là CRUD bác sĩ. Các trang đặt lịch, đăng nhập và đăng ký vẫn là các trang giao diện tạm có sẵn.

Tài liệu: [ASP.NET Core Web API](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-10.0), [Axios](https://axios-http.com/docs/api_intro), [Vite proxy](https://vite.dev/config/server-options#server-proxy).
