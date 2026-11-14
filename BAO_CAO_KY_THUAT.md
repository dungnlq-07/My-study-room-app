# BÁO CÁO KỸ THUẬT NGẮN VỀ DỰ ÁN

**Khóa học:** Phát triển ứng dụng di động đa nền tảng (VKU)  
**Tên tiểu dự án:** [Điền Tiểu dự án 1 / 2 / 3]  
**Tên dự án:** Study Room Booking — Ứng dụng đặt phòng học  
**Tên đội / Sinh viên:** [Điền tên đội hoặc họ tên sinh viên]  
**Ngày nộp:** 14/11/2026

---

## 1. THÔNG TIN CHUNG VÀ LIÊN KẾT SẢN PHẨM

### Thành viên nhóm

1. [Họ và tên] — MSSV: [Mã số sinh viên] — Vai trò: [Vai trò] — Đóng góp: [%]
2. [Họ và tên] — MSSV: [Mã số sinh viên] — Vai trò: [Vai trò] — Đóng góp: [%]

> Bổ sung hoặc xóa thành viên cho phù hợp với nhóm thực tế.

- **Demo trực tiếp / Expo:** [Điền liên kết nếu đã triển khai]
- **Kho GitHub:** [Điền URL kho mã nguồn]
- **Video minh họa:** [Điền URL video nếu có]
- **Bản Android debug:** `android/app/build/outputs/apk/debug/app-debug.apk` (bản build cục bộ; cần tải lên nơi chia sẻ trước khi gửi liên kết cho giảng viên).

### Giới thiệu

Study Room Booking là ứng dụng di động hỗ trợ đăng nhập, tra cứu phòng học theo ngày và khung giờ, tạo và quản lý lượt đặt phòng. Ứng dụng có mã QR để check-in, nhận diện thông tin trên giấy tờ bằng OCR trên thiết bị, hỗ trợ lưu booking cục bộ khi mất mạng và đồng bộ dữ liệu với Firestore khi kết nối được khôi phục.

### Danh sách kiểm tra tính năng

| # | Tính năng | Trạng thái | Cách triển khai / ghi chú |
|:---:|---|:---:|---|
| 1 | Giao diện ứng dụng di động và chế độ tối | Đã triển khai | Ứng dụng React Native/Expo, bố cục có Safe Area và thanh điều hướng tab. Hỗ trợ giao diện sáng, tối hoặc theo thiết lập hệ thống; tùy chọn được lưu bằng AsyncStorage. |
| 2 | Đăng ký, đăng nhập và khôi phục mật khẩu | Đã triển khai | Firebase Authentication với email/mật khẩu; xử lý các lỗi đăng nhập phổ biến và trạng thái tải. |
| 3 | Tìm phòng và đặt phòng theo lịch | Đã triển khai | Đọc danh sách phòng từ Firestore; kiểm tra khung giờ, sức chứa và booking trùng khi đồng bộ/ghi lên Firestore. Booking tạo ngoại tuyến được kiểm tra khi đồng bộ lại. |
| 4 | Lưu booking ngoại tuyến | Đã triển khai | Booking mới được ghi vào SQLite với trạng thái `pending`, sau đó có thể xem từ dữ liệu cục bộ khi không có mạng. |
| 5 | Đồng bộ booking khi có mạng | Đã triển khai | NetInfo phát hiện kết nối trở lại để gửi booking đang chờ lên Firestore. Khi tải dữ liệu, ứng dụng cũng cập nhật cache cục bộ từ Firestore; lỗi đồng bộ được lưu để hỗ trợ xử lý lại. |
| 6 | Check-in bằng QR và nhắc lịch | Đã triển khai | Booking có QR để check-in; Expo Notifications lên lịch nhắc trước giờ bắt đầu/kết thúc trên môi trường native được hỗ trợ. |
| 7 | Quét giấy tờ để điền thông tin hồ sơ | Đã triển khai | Người dùng chụp ảnh hoặc chọn ảnh; ML Kit OCR nhận diện trên thiết bị và đưa kết quả vào biểu mẫu để kiểm tra trước khi lưu. |

> Khả năng hiển thị trên mọi kích thước màn hình và hoạt động thực tế của thông báo nên được kiểm tra trên thiết bị mục tiêu trước khi ghi nhận là đã nghiệm thu.

---

## 2. KIẾN TRÚC KỸ THUẬT VÀ CẤU TRÚC DỰ ÁN

Ứng dụng được viết bằng **React Native, TypeScript và Expo**. Firebase cung cấp xác thực và dữ liệu từ xa; SQLite lưu booking tại thiết bị để hỗ trợ truy cập ngoại tuyến.

### Cấu trúc thư mục chính

| Thư mục / tệp | Trách nhiệm |
|---|---|
| `App.tsx` | Khởi tạo các provider, theo dõi trạng thái đăng nhập và hiển thị luồng xác thực hoặc ứng dụng chính. |
| `src/screens/` | Các màn hình đăng nhập, duyệt phòng, booking, thông báo, hồ sơ và quét QR. |
| `src/components/` | Các thành phần giao diện dùng lại như thẻ phòng, thanh tìm kiếm và huy hiệu thông báo. |
| `src/navigation/` | Điều hướng chính bằng bottom tabs. |
| `src/context/` | `AppStateContext` quản lý danh sách phòng, booking, trạng thái tải/lỗi và các thao tác chính của ứng dụng. |
| `src/domain/` | Entity, repository interface và use case, tách quy tắc nghiệp vụ khỏi giao diện. |
| `src/data/` | DTO, mapper và `LocalBookingRepositoryImpl` kết nối SQLite với Firestore. |
| `src/services/` | Các dịch vụ Firestore cho phòng/booking và dịch vụ thông báo. |
| `src/presentation/theme/` | Quản lý giao diện sáng/tối và lưu lựa chọn giao diện. |
| `src/config/` | Khởi tạo Firebase Authentication và Firestore. |

### Luồng dữ liệu và trạng thái

1. Firebase Authentication xác định người dùng hiện tại; `App.tsx` chỉ hiển thị phần ứng dụng sau khi trạng thái đăng nhập được xác định.
2. `AppStateProvider` tải booking của người dùng và danh sách phòng, cung cấp dữ liệu cùng các thao tác cho màn hình qua `useAppState`.
3. Use case tạo booking gọi `BookingRepository`. `LocalBookingRepositoryImpl` ghi booking vào SQLite trước với trạng thái đồng bộ `pending`.
4. Khi có mạng, repository kiểm tra booking và đồng bộ lên Firestore; dữ liệu từ xa được tải về cập nhật cache cục bộ. Các thay đổi booking từ Firestore cũng được theo dõi để làm mới trạng thái.
5. Dịch vụ thông báo đối chiếu booking đang hoạt động, lưu thông tin nhắc cục bộ và lên lịch thông báo native nếu được cấp quyền.

### Xử lý ngoại lệ

- Kiểm tra dữ liệu đầu vào như ngày, khung giờ, thời lượng gia hạn và quyền sở hữu booking trước khi thực hiện thao tác.
- Lỗi tải dữ liệu được đưa vào trạng thái ứng dụng để màn hình hiển thị và cho phép thử lại.
- Nếu không tải được dữ liệu từ xa, repository booking có thể trả về dữ liệu SQLite đã lưu; lỗi đồng bộ được lưu cùng booking đang chờ.
- Các xung đột về sức chứa, thời gian đặt trùng, quyền truy cập và check-in được từ chối, đồng thời hiển thị thông báo phù hợp.

---

## 3. BẰNG CHỨNG THỰC NGHIỆM VÀ ẢNH CHỤP MÀN HÌNH

Chưa tìm thấy ảnh chụp màn hình ứng dụng trong dự án. Chụp ảnh từ emulator hoặc thiết bị thật, lưu vào `docs/screenshots/`, rồi thay các dòng gợi ý bên dưới bằng ảnh thực tế trước khi nộp.

1. **Màn hình đăng nhập / đăng ký:** [Chèn ảnh chụp màn hình tại đây]
2. **Danh sách phòng và chọn khung giờ:** [Chèn ảnh chụp màn hình tại đây]
3. **Chi tiết booking hoặc mã QR check-in:** [Chèn ảnh chụp màn hình tại đây]
4. **Quét QR hoặc giao diện tối:** [Chèn ảnh chụp màn hình tại đây]

---

## 4. THÁCH THỨC VÀ GIẢI PHÁP KỸ THUẬT

1. **Duy trì dữ liệu booking khi kết nối mạng không ổn định:** Nếu chỉ phụ thuộc vào Firestore, người dùng khó xem hoặc lưu booking khi ngoại tuyến. Ứng dụng dùng SQLite làm bản lưu cục bộ, đánh dấu booking chưa đồng bộ là `pending`, rồi dùng NetInfo để thử đồng bộ khi có mạng trở lại. Lỗi đồng bộ được lưu để tránh coi booking chưa gửi thành công là đã đồng bộ.
2. **Ngăn đặt vượt sức chứa hoặc đặt trùng khung giờ:** Trạng thái khả dụng có thể thay đổi khi nhiều người thao tác gần như đồng thời. Ứng dụng kiểm tra booking đang chiếm phòng, khoảng thời gian giao nhau và sức chứa trong luồng giao dịch Firestore. Booking được tạo ngoại tuyến vẫn ở trạng thái chờ; nếu phát hiện xung đột khi đồng bộ, lỗi được ghi nhận thay vì đánh dấu booking là đã đồng bộ.

---

## 5. THÔNG TIN CẦN HOÀN THIỆN TRƯỚC KHI NỘP

- Điền mã tiểu dự án, tên thành viên, MSSV, vai trò và tỷ lệ đóng góp.
- Thêm URL GitHub, demo và video nếu có.
- Chụp và chèn 3–4 ảnh ứng dụng đang chạy; không dùng ảnh tài nguyên mặc định của build thay cho ảnh giao diện.
- Xác nhận các tính năng trên đúng emulator/thiết bị mục tiêu, đặc biệt là đồng bộ ngoại tuyến và thông báo native.
